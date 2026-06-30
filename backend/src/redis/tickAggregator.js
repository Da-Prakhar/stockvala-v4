/**
 * In-memory OHLCV aggregator — built from the live Redis tick stream.
 *
 * Every tick received by priceStream.js is fed here via addTick().
 * Builds candlestick bars for M1 / M5 / M15 / M30 / H1 / H4 / D1 in real-time.
 * Data accumulates for the lifetime of the Node.js process (no persistence).
 *
 * Used by /trades/chart/:symbol as fallback when the Python bridge is down.
 */

const MAX_BARS = 500;   // bars per symbol per timeframe

const TF_SECONDS = {
  M1:  60,
  M5:  300,
  M15: 900,
  M30: 1800,
  H1:  3600,
  H4:  14400,
  D1:  86400,
};

// Map<SYMBOL, Map<TF, Bar[]>>
const _store = new Map();

function barStartTime(unixSecs, tfSecs) {
  return Math.floor(unixSecs / tfSecs) * tfSecs;
}

/**
 * Feed one tick into all timeframe aggregators for this symbol.
 * Called by priceStream.js on every Redis tick: message.
 *
 * @param {string} symbol   - e.g. "EURUSD"
 * @param {number} bid
 * @param {number} ask
 * @param {number} unixSecs - Unix timestamp in seconds
 */
export function addTick(symbol, bid, ask, unixSecs) {
  if (!bid || bid <= 0) return;

  const mid = (bid + (ask > 0 ? ask : bid)) / 2;
  const sym = symbol.toUpperCase();

  if (!_store.has(sym)) _store.set(sym, new Map());
  const tfMap = _store.get(sym);

  for (const [tf, tfSec] of Object.entries(TF_SECONDS)) {
    const bsTime = barStartTime(unixSecs, tfSec);

    if (!tfMap.has(tf)) tfMap.set(tf, []);
    const bars = tfMap.get(tf);
    const last = bars.length > 0 ? bars[bars.length - 1] : null;

    if (last && last.time === bsTime) {
      // Update the running (current) bar in place
      if (mid > last.high) last.high = mid;
      if (mid < last.low)  last.low  = mid;
      last.close  = mid;
      last.volume += 1;
    } else {
      // Open a new bar — trim oldest if buffer is full
      if (bars.length >= MAX_BARS) bars.shift();
      bars.push({
        time:   bsTime,
        open:   mid,
        high:   mid,
        low:    mid,
        close:  mid,
        volume: 1,
      });
    }
  }
}

/**
 * Return the last `count` candles for a symbol + timeframe.
 * Returns [] if no tick data accumulated yet.
 *
 * @param {string} symbol
 * @param {string} timeframe - M1 | M5 | M15 | M30 | H1 | H4 | D1
 * @param {number} count     - max bars to return (capped at MAX_BARS)
 * @returns {Array<{time,open,high,low,close,volume}>}
 */
export function getCandles(symbol, timeframe = 'M15', count = 200) {
  const tf    = (timeframe || 'M15').toUpperCase();
  const sym   = (symbol    || '').toUpperCase();
  const tfMap = _store.get(sym);
  if (!tfMap) return [];
  const bars = tfMap.get(tf) || [];
  return bars.slice(-Math.min(count, MAX_BARS));
}

/** All symbols that have received at least one tick */
export function trackedSymbols() {
  return [..._store.keys()];
}

/** Stats for debugging */
export function aggregatorStats() {
  const stats = {};
  for (const [sym, tfMap] of _store.entries()) {
    stats[sym] = {};
    for (const [tf, bars] of tfMap.entries()) {
      stats[sym][tf] = bars.length;
    }
  }
  return stats;
}
