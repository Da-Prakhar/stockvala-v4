/**
 * MasterMonitor — two modes:
 *   1. EVENT mode: listens to Redis pub/sub from C# Gateway (< 50ms)
 *   2. POLL mode:  falls back to MT5 Manager API polling (500ms)
 *      Activates automatically when Gateway is not publishing
 */
const EventEmitter = require('events');
const config       = require('./config');

const GATEWAY_STALE_MS = 5000; // switch to poll if no gateway tick for 5s

class MasterMonitor extends EventEmitter {
  constructor(redis) {
    super();
    this.redis       = redis;
    this.mt5         = null;
    this.snapshot    = {};
    this.lastGateway = 0;     // timestamp of last Redis event from Gateway
    this._pollTimer  = null;
  }

  async connect() {
    const MT5Manager = require('./mt5Manager');
    this.mt5 = new MT5Manager(config.mt5);
    await this.mt5.connect();
    console.log('[MasterMonitor] MT5 connected');
  }

  startPolling() {
    // ── Mode 1: Redis event-driven (from C# Gateway) ────────────────
    this.redis.psubscribe('account:*:position:*', (err) => {
      if (err) console.error('[MasterMonitor] subscribe error:', err.message);
      else console.log('[MasterMonitor] subscribed to Gateway position events');
    });

    this.redis.on('pmessage', async (_pat, channel, message) => {
      // channel = "account:12345:position:open"
      const parts     = channel.split(':');
      const accountId = parseInt(parts[1]);
      const evt       = parts[3]; // "open" | "close" | "update"

      // Only process accounts that are active masters
      const isMaster = await this.redis.sismember('copy:masters:active', String(accountId));
      if (!isMaster) return;

      this.lastGateway = Date.now();
      const position   = JSON.parse(message);

      if (evt === 'open')  this.emit('position:open',  { accountId }, position);
      if (evt === 'close') this.emit('position:close', { accountId }, position);
    });

    // ── Mode 2: Fallback poll (when Gateway not live) ────────────────
    this._pollTimer = setInterval(() => this._maybePoll(), config.pollInterval);
    console.log(`[MasterMonitor] live (Gateway events + ${config.pollInterval}ms poll fallback)`);
  }

  stop() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this.redis.punsubscribe('account:*:position:*');
  }

  async _maybePoll() {
    const gatewayLive = (Date.now() - this.lastGateway) < GATEWAY_STALE_MS;
    if (gatewayLive) return; // Gateway is publishing, skip poll

    // Poll all active masters via Manager API
    const masterIds = await this.redis.smembers('copy:masters:active');
    for (const id of masterIds) {
      await this._pollAccount(parseInt(id));
    }
  }

  async _pollAccount(accountId) {
    let positions;
    try {
      positions = await this.mt5.getPositions(accountId);
    } catch (err) {
      console.error(`[MasterMonitor] poll ${accountId}:`, err.message);
      return;
    }

    const prev = this.snapshot[accountId] || {};
    const curr = {};

    for (const p of positions) {
      curr[p.ticket] = p;
      if (!prev[p.ticket]) this.emit('position:open', { accountId }, p);
    }

    for (const ticket of Object.keys(prev)) {
      if (!curr[ticket]) this.emit('position:close', { accountId }, prev[ticket]);
    }

    this.snapshot[accountId] = curr;
  }
}

module.exports = MasterMonitor;
