/**
 * /api/diag — Full system diagnostic endpoint
 * Tests every layer (Redis, Gateway, DB, Socket.IO, accounts, prices)
 * in parallel and returns a complete JSON report.
 *
 * Access: GET https://api.onefx.co.in/api/diag
 * No auth required (open endpoint for troubleshooting).
 * REMOVE or SECURE this route before going live to real users.
 */
import express from 'express';
import axios   from 'axios';
import db      from '../config/database.js';
import { redis, sub } from '../redis/client.js';
import { io }  from '../index.js';

const router = express.Router();

/** Run fn within `ms` ms, return { ok, value, error, ms } */
async function timed(label, fn, ms = 8000) {
  const t0 = Date.now();
  try {
    const value = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))
    ]);
    return { label, ok: true, value, ms: Date.now() - t0 };
  } catch (e) {
    return { label, ok: false, error: e.message, ms: Date.now() - t0 };
  }
}

router.get('/', async (req, res) => {
  const gwUrl = process.env.MT5_GATEWAY_URL || null;
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = process.env.REDIS_PORT || 6379;

  // ── Run ALL checks in parallel ──────────────────────────────────────
  const [
    redisPing,
    redisEURUSD,
    redisBTCUSD,
    redisPositions,
    redisPubSubState,
    gwHealth,
    gwSymbols,
    gwTickEURUSD,
    gwTickBTCUSD,
    gwTickXAUUSD,
    dbPing,
    dbAccountCount,
    dbUserCount,
  ] = await Promise.all([
    // Redis: basic ping
    timed('redis.ping', async () => {
      const r = await redis.ping();
      return r;
    }, 4000),

    // Redis: price key for EURUSD
    timed('redis.price:EURUSD', async () => {
      const raw = await redis.get('price:EURUSD');
      return raw ? JSON.parse(raw) : null;
    }, 4000),

    // Redis: price key for BTCUSD
    timed('redis.price:BTCUSD', async () => {
      const raw = await redis.get('price:BTCUSD');
      return raw ? JSON.parse(raw) : null;
    }, 4000),

    // Redis: any positions keys
    timed('redis.positions.keys', async () => {
      const keys = await redis.keys('positions:*');
      return keys;
    }, 4000),

    // Redis: subscriber state
    timed('redis.sub.status', async () => {
      return sub.status;   // 'ready' = subscribed, 'connecting' = not yet
    }, 1000),

    // Gateway: health
    timed('gateway.health', async () => {
      if (!gwUrl) throw new Error('MT5_GATEWAY_URL not set');
      const r = await axios.get(`${gwUrl}/health`, { timeout: 6000 });
      return r.data;
    }, 7000),

    // Gateway: symbols
    timed('gateway.symbols', async () => {
      if (!gwUrl) throw new Error('MT5_GATEWAY_URL not set');
      const r = await axios.get(`${gwUrl}/symbols`, { timeout: 6000 });
      const syms = r.data?.symbols || r.data || [];
      return { count: syms.length, sample: syms.slice(0, 10) };
    }, 7000),

    // Gateway: tick EURUSD
    timed('gateway.tick.EURUSD', async () => {
      if (!gwUrl) throw new Error('MT5_GATEWAY_URL not set');
      const r = await axios.get(`${gwUrl}/tick/EURUSD`, { timeout: 6000 });
      return r.data;
    }, 7000),

    // Gateway: tick BTCUSD
    timed('gateway.tick.BTCUSD', async () => {
      if (!gwUrl) throw new Error('MT5_GATEWAY_URL not set');
      const r = await axios.get(`${gwUrl}/tick/BTCUSD`, { timeout: 6000 });
      return r.data;
    }, 7000),

    // Gateway: tick XAUUSD (Gold)
    timed('gateway.tick.XAUUSD', async () => {
      if (!gwUrl) throw new Error('MT5_GATEWAY_URL not set');
      const r = await axios.get(`${gwUrl}/tick/XAUUSD`, { timeout: 6000 });
      return r.data;
    }, 7000),

    // DB: basic ping
    timed('db.authenticate', async () => {
      await db.authenticate();
      return 'ok';
    }, 5000),

    // DB: count MT5 accounts
    timed('db.mt5_accounts.count', async () => {
      const [rows] = await db.query('SELECT COUNT(*) as cnt FROM mt5_accounts');
      return rows[0]?.cnt;
    }, 5000),

    // DB: count users
    timed('db.users.count', async () => {
      const [rows] = await db.query('SELECT COUNT(*) as cnt FROM users');
      return rows[0]?.cnt;
    }, 5000),
  ]);

  // Socket.IO stats (synchronous)
  let socketStats = {};
  try {
    const sockets = await io.fetchSockets();
    socketStats = {
      connectedClients: sockets.length,
      rooms: [...io.sockets.adapter.rooms.keys()].filter(r => r.startsWith('price:')).slice(0, 20),
    };
  } catch (e) {
    socketStats = { error: e.message };
  }

  // Env snapshot (redact secrets)
  const env = {
    NODE_ENV:           process.env.NODE_ENV,
    PORT:               process.env.PORT,
    REDIS_HOST:         redisHost,
    REDIS_PORT:         redisPort,
    MT5_GATEWAY_URL:    gwUrl || '(not set)',
    PYTHON_BRIDGE_URL:  process.env.PYTHON_BRIDGE_URL ? '(set)' : '(not set)',
    CORS_ORIGINS:       process.env.CORS_ORIGINS || '(not set — defaults to *)',
    DB_HOST:            process.env.DB_HOST,
    DB_NAME:            process.env.DB_NAME,
    COPY_ENGINE:        process.env.COPY_ENGINE_ENABLED,
  };

  // Overall health
  const criticalChecks = [redisPing, gwHealth, gwTickEURUSD, dbPing];
  const allOk = criticalChecks.every(c => c.ok);

  res.json({
    status:    allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    env,
    checks: {
      redis:   { ping: redisPing,    priceEURUSD: redisEURUSD, priceBTCUSD: redisBTCUSD, positions: redisPositions, subStatus: redisPubSubState },
      gateway: { health: gwHealth,   symbols: gwSymbols,       tickEURUSD: gwTickEURUSD,  tickBTCUSD: gwTickBTCUSD, tickXAUUSD: gwTickXAUUSD },
      db:      { ping: dbPing,       accountCount: dbAccountCount, userCount: dbUserCount },
    },
    socketIO:  socketStats,
    summary: {
      redisConnected:       redisPing.ok,
      redisPricesPresent:   redisEURUSD.ok && redisEURUSD.value?.bid > 0,
      gatewayReachable:     gwHealth.ok,
      gatewayHasTick:       gwTickEURUSD.ok && gwTickEURUSD.value?.bid > 0,
      dbConnected:          dbPing.ok,
      socketClientsOnline:  socketStats.connectedClients ?? 0,
      pricesWillFlow:       (redisPing.ok && redisEURUSD.value?.bid > 0) || (gwTickEURUSD.ok && gwTickEURUSD.value?.bid > 0),
    }
  });
});

export default router;
