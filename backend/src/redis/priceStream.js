/**
 * Redis pub/sub → Socket.IO bridge  (multi-server edition)
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls EVERY configured MT5 gateway and writes ticks to two Redis keys:
 *   price:SERVER_NAME:SYMBOL   ← server-specific  (used by controllers)
 *   price:SYMBOL               ← flat/legacy key  (backward compat)
 *
 * Socket.IO rooms are still emitted under `price:SYMBOL` so the frontend
 * doesn't need to know which server it's on.
 *
 * Server config comes from src/config/servers.js which reads .env:
 *   Single server (no changes needed):  MT5_GATEWAY_URL + MT5_SERVER_NAME
 *   Multi server:                        MT5_SERVERS + MT5_SERVERx_GATEWAY + MT5_SERVERx_NAME
 */
import axios from 'axios';
import http  from 'http';
import { sub, redis }  from './client.js';
import { addTick }     from './tickAggregator.js';
import { MT5_SERVERS } from '../config/servers.js';

// Keep-alive agent — caps connections so trade endpoints are never starved
const _pollAgent = new http.Agent({ keepAlive: true, maxSockets: 4, maxFreeSockets: 2 });

// Track which servers have an active poller (set to interval handle)
const _activePollers = new Map();   // serverId → true

// ── Fetch symbol list from one gateway ─────────────────────────────────────
async function fetchGatewaySymbols(gatewayUrl) {
  try {
    const r = await axios.get(`${gatewayUrl}/symbols`, { timeout: 4000, httpAgent: _pollAgent });
    const raw = r.data?.symbols || r.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return [...new Set(
        raw.map(s => (typeof s === 'string' ? s : s.name || '').replace(/\.[^.]*$/, ''))
           .filter(Boolean)
      )];
    }
  } catch { /* gateway unreachable — return empty */ }
  return [];
}

// ── Poller for ONE server ───────────────────────────────────────────────────
async function startServerPoller(io, server) {
  const { id, gatewayUrl, serverName } = server;

  let symbols = await fetchGatewaySymbols(gatewayUrl);
  console.log(`[PriceStream:${id}] Started — ${symbols.length} symbols @ ${gatewayUrl} (serverName="${serverName}")`);

  let refreshCountdown = 30;

  const poll = async () => {
    // Periodically refresh the symbol list
    refreshCountdown--;
    if (refreshCountdown <= 0) {
      refreshCountdown = 30;
      const updated = await fetchGatewaySymbols(gatewayUrl);
      if (updated.length > 0 && updated.length !== symbols.length) {
        console.log(`[PriceStream:${id}] Symbol list refreshed: ${updated.length} symbols`);
        symbols = updated;
      }
    }

    if (symbols.length === 0) return;

    await Promise.allSettled(symbols.map(async (symbol) => {
      try {
        const r = await axios.get(`${gatewayUrl}/tick/${symbol}`, {
          timeout: 2000, httpAgent: _pollAgent,
        });
        const d = r.data;
        if (!d?.bid) return;

        const payload = {
          bid:        d.bid,
          ask:        d.ask || d.bid,
          t:          d.time || Math.floor(Date.now() / 1000),
          serverName,                  // tag the tick with its origin
        };

        // ── Socket.IO — emit to frontend rooms ──────────────────────────
        io.to(`price:${symbol}`).emit('price_update', { symbol, ...payload });

        // Also emit to broker-suffixed name if gateway returns it
        const resolved = (typeof d.symbol === 'string' && d.symbol !== symbol) ? d.symbol : null;
        if (resolved) io.to(`price:${resolved}`).emit('price_update', { symbol: resolved, ...payload });

        // ── OHLCV aggregator ────────────────────────────────────────────
        addTick(symbol, d.bid, payload.ask, payload.t);
        if (resolved) addTick(resolved, d.bid, payload.ask, payload.t);

        // ── Redis — two keys (namespaced + legacy flat) ─────────────────
        const p = JSON.stringify(payload);
        // Server-namespaced key: used by getPriceByServer() in controllers
        redis.set(`price:${serverName}:${symbol}`, p, 'EX', 10).catch(() => {});
        // Flat legacy key: backward compat for old code + default fallback
        redis.set(`price:${symbol}`, p).catch(() => {});
        redis.publish(`tick:${symbol}`, p).catch(() => {});
        if (resolved) {
          redis.set(`price:${serverName}:${resolved}`, p, 'EX', 10).catch(() => {});
          redis.set(`price:${resolved}`, p).catch(() => {});
        }

      } catch { /* skip this symbol this tick */ }
    }));
  };

  // Recursive setTimeout so polls never overlap even on slow gateways
  const schedulePoll = () => {
    poll().finally(() => {
      if (_activePollers.has(id)) {
        _activePollers.set(id, setTimeout(schedulePoll, 1000));
      }
    });
  };
  _activePollers.set(id, true);
  schedulePoll();
}

// ── Main entry point ────────────────────────────────────────────────────────
export function startPriceStream(io) {

  // ── A: Redis pub/sub (primary path when gateways push directly to Redis) ──
  sub.on('pmessage', (_pattern, channel, message) => {
    try {
      const data = JSON.parse(message);

      if (channel.startsWith('tick:')) {
        const symbol = channel.slice(5);
        const base   = symbol.includes('.') ? symbol.replace(/\.[^.]*$/, '') : symbol;

        // MCX/NSE symbols only ever come via Redis — always forward
        // Forex/crypto may come from both REST poller and Redis — skip Redis if poller is live
        const isMcxNse = /^(CRUDE|GOLD|SILVER|NATURALGAS|COPPER|ZINC|ALUMINIUM|LEAD|NICKEL|COTTON|NIFTY|BANKNIFTY|FINNIFTY|RELIANCE|TCS|HDFCBANK|INFY|ICICIBANK|SBIN|BHARTIARTL|ITC|TATAMOTORS|WIPRO|ADANIENT)/i.test(symbol);
        if (_activePollers.size === 0 || isMcxNse) {
          io.to(`price:${symbol}`).emit('price_update', { symbol, ...data });
          if (base !== symbol) {
            io.to(`price:${base}`).emit('price_update', { symbol: base, ...data });
            redis.set(`price:${base}`, JSON.stringify(data)).catch(() => {});
          }
        }

        if (data.bid > 0) {
          const t = data.t || Math.floor(Date.now() / 1000);
          addTick(symbol, data.bid, data.ask || data.bid, t);
          if (base !== symbol) addTick(base, data.bid, data.ask || data.bid, t);
        }

      } else if (channel.startsWith('account:')) {
        const parts   = channel.split(':');
        const acctId  = parts[1];
        const evtType = parts.slice(2).join(':');
        io.to(`account:${acctId}`).emit(evtType, data);
      }
    } catch (e) {
      console.error('[PriceStream] parse error:', e.message, channel);
    }
  });

  sub.psubscribe('tick:*', 'account:*', (err, count) => {
    if (err) console.error('[PriceStream] psubscribe error:', err.message);
    else     console.log(`[PriceStream] subscribed to ${count} Redis pattern(s)`);
  });

  // ── B: REST pollers — one per configured gateway (start after 5 s) ────────
  if (MT5_SERVERS.length > 0) {
    setTimeout(async () => {
      console.log(`[PriceStream] Starting REST pollers for ${MT5_SERVERS.length} server(s)...`);
      for (const server of MT5_SERVERS) {
        await startServerPoller(io, server);
      }
    }, 5000);
  }
}
