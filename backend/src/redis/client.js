/**
 * V2 Redis client — singleton for the backend
 * Connects to Redis (populated by the C# MT5 Manager Gateway).
 *
 * Exports:
 *   redis   — main client (get/set/hget/pipeline)
 *   sub     — subscriber client (psubscribe / on('pmessage'))
 *   connectRedis()
 *   getPrice(symbol)
 *   getPositions(accountId)
 *   setFollower / removeFollower — copy-trade helpers
 */
import Redis from 'ioredis';

// Parse REDIS_HOST which may include port (e.g. "198.38.81.201:6379")
const _redisHostRaw = process.env.REDIS_HOST || '127.0.0.1';
const _hostHasPort  = _redisHostRaw.includes(':');
const _redisHost    = _hostHasPort ? _redisHostRaw.split(':')[0] : _redisHostRaw;
const _redisPort    = _hostHasPort ? parseInt(_redisHostRaw.split(':')[1]) : (parseInt(process.env.REDIS_PORT) || 6379);

// Main client — fail fast when Redis is unreachable so API calls
// don't block for 4000ms each. App works without Redis via gateway polling.
const opts = {
  host:               _redisHost,
  port:               _redisPort,
  password:           process.env.REDIS_PASSWORD || undefined,
  lazyConnect:        true,
  retryStrategy:      (times) => Math.min(times * 500, 5000),
  enableOfflineQueue: false,   // commands fail instantly when disconnected
  connectTimeout:     3000,    // give up connecting after 3s
};

// Subscriber client — keeps offline queue ON so psubscribe requeues after reconnect
const subOpts = {
  ...opts,
  enableOfflineQueue: true,
};

export const redis = new Redis(opts);
export const sub   = new Redis(subOpts);

// Suppress ECONNREFUSED/ETIMEDOUT spam — Redis may be firewalled, app continues without it
const _ignore = (msg) => msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('offline queue');
redis.on('error', err => { if (!_ignore(err.message)) console.error('[Redis] client error:', err.message); });
sub.on('error',   err => { if (!_ignore(err.message)) console.error('[Redis] sub error:',    err.message); });

export async function connectRedis() {
  try {
    await redis.connect();
    await sub.connect();
    console.log('[Redis] connected to', process.env.REDIS_HOST);
  } catch (err) {
    // Redis unreachable (firewall / not running) — app continues via gateway polling
    console.warn('[Redis] unavailable — prices/positions served from gateway directly:', err.message);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Latest tick set by C# Gateway — { bid, ask, t } — returns null if Redis unreachable */
export async function getPrice(symbol) {
  try {
    const raw = await redis.get(`price:${symbol}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Get live price for a symbol scoped to a specific MT5 server.
 *
 * Key lookup order:
 *   1. price:SERVER_NAME:SYMBOL   (multi-server namespaced key — set by priceStream poller)
 *   2. price:SYMBOL               (legacy single-server key — backward compat)
 *
 * @param {string} serverName  — Mt5Account.serverName value (e.g. "StockVala-Server1")
 * @param {string} symbol      — e.g. "EURUSD", "GOLD"
 */
export async function getPriceByServer(serverName, symbol) {
  try {
    // Try server-namespaced key first
    if (serverName) {
      const raw = await redis.get(`price:${serverName}:${symbol}`);
      if (raw) return JSON.parse(raw);
    }
    // Fall back to legacy flat key
    const raw = await redis.get(`price:${symbol}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Live positions for an account — returns [] if Redis unreachable */
export async function getPositions(accountId) {
  try {
    const raw = await redis.hget(`positions:${accountId}`, 'data');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Register a copy-trade follower subscription */
export async function setFollower(masterAccountId, followerAccountId, settings) {
  try {
    await redis.hset(
      `copy:master:${masterAccountId}:followers`,
      String(followerAccountId),
      JSON.stringify(settings)
    );
    await redis.sadd('copy:masters:active', String(masterAccountId));
  } catch { /* Redis unreachable — copy-trade state not persisted */ }
}

export async function removeFollower(masterAccountId, followerAccountId) {
  try {
    await redis.hdel(`copy:master:${masterAccountId}:followers`, String(followerAccountId));
    const remaining = await redis.hlen(`copy:master:${masterAccountId}:followers`);
    if (remaining === 0) await redis.srem('copy:masters:active', String(masterAccountId));
  } catch { /* Redis unreachable */ }
}
