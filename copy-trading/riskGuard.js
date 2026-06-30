/**
 * Risk guard — stops copying if follower hits limits
 */
class RiskGuard {
  constructor(redis) {
    this.redis = redis;
  }

  // Returns true if safe to copy, false if blocked
  async check(follower, mt5Manager) {
    const limits = follower.riskLimits || {};

    // 1. Max drawdown stop
    if (limits.maxDrawdownPct) {
      const positions = await mt5Manager.getPositions(follower.accountId);
      const floatingLoss = positions
        .filter(p => (p.profit || 0) < 0)
        .reduce((sum, p) => sum + Math.abs(p.profit), 0);

      if (floatingLoss > limits.maxDrawdownPct) {
        console.warn(`[RiskGuard] ${follower.accountId} hit maxDrawdown — stopping copy`);
        await this._pauseFollower(follower.accountId);
        return false;
      }
    }

    // 2. Max lot size
    if (limits.maxLot && follower.calculatedLot > limits.maxLot) {
      return false;
    }

    // 3. Paused manually
    const paused = await this.redis.hget(`copy:follower:${follower.accountId}`, 'paused');
    if (paused === '1') return false;

    return true;
  }

  async _pauseFollower(accountId) {
    await this.redis.hset(`copy:follower:${accountId}`, 'paused', '1');
    await this.redis.publish(`account:${accountId}:copy:paused`,
      JSON.stringify({ reason: 'maxDrawdown', ts: Date.now() })
    );
  }
}

module.exports = RiskGuard;
