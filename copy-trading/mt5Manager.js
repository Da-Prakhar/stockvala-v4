/**
 * MT5 Manager wrapper for copy trading
 * Reuses same pattern as V1 mt5-bridge/connection.js
 * Connects directly to MT5 Manager API — no HTTP round-trip
 */
const EventEmitter = require('events');
const config       = require('./config');

class MT5Manager extends EventEmitter {
  constructor(mt5Config) {
    super();
    this.cfg       = mt5Config || config.mt5;
    this.client    = null;
    this.connected = false;
  }

  async connect() {
    try {
      // Use the native MT5 Manager API node binding
      // Install: npm install mt5-manager (wraps MT5APIManager64.dll via N-API/FFI)
      const MT5 = require('mt5-manager');

      this.client = new MT5.Manager();
      await this.client.connect(this.cfg.server, this.cfg.port);
      await this.client.authorize(this.cfg.login, this.cfg.password);

      this.connected = true;
      console.log('[MT5Manager] Connected to', this.cfg.server);
    } catch (err) {
      // Fallback to mock for development on Mac
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[MT5Manager] Real MT5 not available, using mock');
        this.client = new MockMT5();
        await this.client.connect();
        this.connected = true;
      } else {
        throw err;
      }
    }
  }

  // Get all open positions for an account
  async getPositions(accountId) {
    return this.client.getPositions(accountId);
  }

  // Place market order
  async placeOrder(accountId, { symbol, action, volume, comment }) {
    return this.client.openPosition(
      accountId,
      symbol,
      action,    // 'buy' or 'sell'
      volume,
      0,         // sl — 0 = no stop loss
      0,         // tp — 0 = no take profit
      comment
    );
  }

  // Close position by symbol + volume
  async closePosition(accountId, symbol, volume) {
    // Find the open position ticket first
    const positions = await this.getPositions(accountId);
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) throw new Error(`No open position for ${symbol} on ${accountId}`);
    return this.client.closePosition(accountId, pos.ticket);
  }

  disconnect() {
    if (this.client && this.client.disconnect) this.client.disconnect();
    this.connected = false;
  }
}

// ── Mock for Mac development ────────────────────────────────────────
class MockMT5 {
  constructor() {
    this.positions = {};
    this.nextTicket = 1000;
  }

  async connect() { return true; }
  disconnect()    {}

  async getPositions(accountId) {
    return Object.values(this.positions[accountId] || {});
  }

  async openPosition(accountId, symbol, action, volume) {
    const ticket = this.nextTicket++;
    if (!this.positions[accountId]) this.positions[accountId] = {};
    this.positions[accountId][ticket] = { ticket, symbol, type: action, volume };
    console.log(`[Mock] Opened ${action} ${volume} ${symbol} on ${accountId}`);
    return { ticket };
  }

  async closePosition(accountId, ticket) {
    if (this.positions[accountId]) delete this.positions[accountId][ticket];
    console.log(`[Mock] Closed ticket ${ticket} on ${accountId}`);
    return true;
  }
}

module.exports = MT5Manager;
