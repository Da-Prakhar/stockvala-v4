/**
 * mt5Direct.service.js
 * Drop-in replacement for mt5.service.js (Python Flask HTTP bridge)
 * Connects directly to MT5 Manager API — no HTTP round-trip
 *
 * Usage: replace `import mt5Service from './mt5.service.js'`
 *        with    `import mt5Service from './mt5Direct.service.js'`
 */

import { redis } from '../redis/client.js';

// Lazy-load the native MT5 binding (Windows only)
let _manager = null;

async function getManager() {
  if (_manager) return _manager;

  try {
    const MT5 = await import('mt5-manager');
    _manager = new MT5.Manager();
    await _manager.connect(
      process.env.MT5_SERVER,
      parseInt(process.env.MT5_PORT) || 443
    );
    await _manager.authorize(
      process.env.MT5_MANAGER_LOGIN,
      process.env.MT5_MANAGER_PASSWORD
    );
    console.log('[MT5Direct] connected to', process.env.MT5_SERVER);
  } catch {
    // Dev fallback — return null, callers use Redis cache
    console.warn('[MT5Direct] native binding unavailable, using Redis cache only');
    _manager = null;
  }

  return _manager;
}

// ── Public API (same interface as mt5.service.js) ──────────────────

export const mt5Direct = {

  async getPositions(mt5Login) {
    // Try Redis first (populated by Gateway, near real-time)
    const cached = await redis.hget(`positions:${mt5Login}`, 'data');
    if (cached) return JSON.parse(cached);

    // Fallback: direct MT5 call
    const mgr = await getManager();
    if (!mgr) return [];
    return mgr.getPositions(mt5Login);
  },

  async getAccountInfo(mt5Login) {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.getAccountInfo(mt5Login);
  },

  async openPosition(mt5Login, symbol, type, volume, sl = 0, tp = 0) {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.openPosition(mt5Login, symbol, type, volume, sl, tp);
  },

  async closePosition(mt5Login, ticket) {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.closePosition(mt5Login, ticket);
  },

  async deposit(mt5Login, amount, comment = '') {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.deposit(mt5Login, amount, comment);
  },

  async withdraw(mt5Login, amount, comment = '') {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.withdraw(mt5Login, amount, comment);
  },

  async createAccount(data) {
    const mgr = await getManager();
    if (!mgr) throw new Error('MT5 unavailable');
    return mgr.createAccount(data);
  },

  async getPrice(symbol) {
    // Always from Redis (set by C# Gateway)
    const raw = await redis.get(`price:${symbol}`);
    return raw ? JSON.parse(raw) : null;
  },

  async getAllPrices(symbols) {
    const pipeline = redis.pipeline();
    symbols.forEach(s => pipeline.get(`price:${s}`));
    const results = await pipeline.exec();
    const out = {};
    symbols.forEach((s, i) => {
      if (results[i][1]) out[s] = JSON.parse(results[i][1]);
    });
    return out;
  },
};

export default mt5Direct;
