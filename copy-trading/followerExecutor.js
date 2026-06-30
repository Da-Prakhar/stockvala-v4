/**
 * Places/closes trades on follower accounts
 * to mirror what the master did
 */
const config = require('./config');

class FollowerExecutor {
  constructor(redis) {
    this.redis = redis;
    this.mt5   = null;
  }

  async connect() {
    const MT5Manager = require('./mt5Manager');
    this.mt5 = new MT5Manager(config.mt5);
    await this.mt5.connect();
    console.log('[FollowerExecutor] MT5 connected');
  }

  // Mirror master's open position on follower account
  async copyOpen(follower, masterPosition) {
    const lot = this._calcLot(follower, masterPosition.volume);
    if (lot <= 0) return;

    try {
      await this.mt5.placeOrder(follower.accountId, {
        symbol:  masterPosition.symbol,
        action:  masterPosition.type,   // buy or sell
        volume:  lot,
        comment: `copy#${masterPosition.ticket}`,
      });

      console.log(`[CopyOpen] ${follower.accountId} ${masterPosition.symbol} ${lot}`);

      // Record in Redis so we can close it later
      await this.redis.hset(
        `copy:follower:${follower.accountId}:map`,
        masterPosition.ticket,
        JSON.stringify({ symbol: masterPosition.symbol, volume: lot })
      );
    } catch (err) {
      console.error(`[CopyOpen] Failed ${follower.accountId}:`, err.message);
    }
  }

  // Close follower's position when master closes
  async copyClose(follower, masterPosition) {
    const mapped = await this.redis.hget(
      `copy:follower:${follower.accountId}:map`,
      masterPosition.ticket
    );
    if (!mapped) return;

    const { symbol, volume } = JSON.parse(mapped);

    try {
      await this.mt5.closePosition(follower.accountId, symbol, volume);
      await this.redis.hdel(`copy:follower:${follower.accountId}:map`, masterPosition.ticket);
      console.log(`[CopyClose] ${follower.accountId} ${symbol}`);
    } catch (err) {
      console.error(`[CopyClose] Failed ${follower.accountId}:`, err.message);
    }
  }

  /**
   * Calculate follower lot size based on lotMode stored on the follower record.
   *
   * Modes:
   *   ratio      – masterLot * copyRatio  (default, same behaviour as before)
   *   fixed      – follower.fixedLot (ignores master volume)
   *   equity_pct – (follower.equityPct / 100) * followerEquity / contractSize
   *                equity is passed in via follower.equity (fetched before calling)
   *
   * After computing, applies optional maxLotPerTrade cap then rounds to 2 dp.
   */
  _calcLot(follower, masterLot) {
    const mode = follower.lotMode || 'ratio';
    let lot;

    switch (mode) {
      case 'fixed':
        lot = parseFloat(follower.fixedLot) || 0.01;
        break;

      case 'equity_pct': {
        // follower.equity must be populated by the caller (from MT5 account info)
        const equity = parseFloat(follower.equity) || 0;
        const pct    = parseFloat(follower.equityPct) || 1;
        // Standard FX lot = 100,000 units; simplistic: equity_used / 100000
        // Brokers normally expose contract size per symbol — use 100000 as safe default
        const contractSize = follower.contractSize || 100000;
        lot = (equity * pct / 100) / contractSize;
        if (lot < 0.01) lot = 0.01;
        break;
      }

      case 'ratio':
      default:
        lot = masterLot * (parseFloat(follower.copyRatio) || follower.ratio || 1.0);
        break;
    }

    // Apply optional hard cap
    const maxLot = parseFloat(follower.maxLotPerTrade) || parseFloat(follower.maxLot) || 0;
    if (maxLot > 0) lot = Math.min(lot, maxLot);

    // Round down to 2 decimal places (MT5 minimum step = 0.01)
    return Math.floor(lot * 100) / 100;
  }
}

module.exports = FollowerExecutor;
