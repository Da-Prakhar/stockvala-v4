import { CopyTradeMaster, CopyTradeFollower, CopyTrade, CopyTradeSettings, Mt5Account } from '../models/index.js';
import * as mt5Service from './mt5.service.js';

/**
 * Copy Trade Engine
 *
 * Monitors master trader positions and mirrors them on follower accounts.
 * Uses polling to detect new/closed positions on master MT5 accounts.
 */

// Track known master positions: { masterId: { ticket: positionData } }
const masterPositions = {};

// In-flight guard: Set of "masterId:followerId:ticket" keys currently being copied
// Prevents race conditions when two overlapping polls detect the same new position
const inFlightCopies = new Set();

// Polling interval (ms)
const POLL_INTERVAL = parseInt(process.env.COPY_POLL_INTERVAL) || 3000; // 3 seconds for near-instant copy
let pollingTimer = null;
let isPolling = false; // prevents overlapping poll cycles

/**
 * Calculate follower lot size.
 *
 * Modes:
 *   ratio         — master_lots × copyRatio (simple multiplier, default)
 *   fixed         — always use fixedLot regardless of master size
 *   equity_pct    — (follower_equity × equityPct%) / contractSize
 *   balance_ratio — (follower_balance / master_balance) × master_lots
 *                   Auto-scales so a $10k follower copies a $100k master at 0.1× lots.
 *                   Requires follower.balance and follower.masterBalance to be injected.
 *   risk_pct      — risk riskPct% of follower balance per trade.
 *                   Uses masterSlPips (injected from master position SL) to size:
 *                     lot = (balance × riskPct%) / (slPips × $10)
 *                   Falls back to a 20-pip assumed SL if master has no SL set.
 *
 * All modes respect maxLotPerTrade as a hard cap.
 */
function calculateFollowerLots(masterLots, follower) {
  const mode = follower.lotMode || 'ratio';
  let lot;

  switch (mode) {

    case 'fixed':
      lot = parseFloat(follower.fixedLot) || 0.01;
      break;

    case 'equity_pct': {
      // follower.equity injected in openCopyTrade before calling here
      const equity = parseFloat(follower.equity) || 0;
      const pct    = parseFloat(follower.equityPct) || 1;
      // Use symbol-aware contract size so crypto/metals aren't over-scaled
      const sym = (follower._symbol || '').toUpperCase();
      let cs = 100000; // default forex
      if (/^(XAU|XAG|XPT|XPD)/.test(sym))                                                cs = 100;
      else if (/^(BTC|ETH|LTC|XRP|ADA|DOT|SOL|BNB|DOGE|AVAX|MATIC|LINK|UNI|ATOM)/.test(sym)) cs = 1;
      else if (/^(US30|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX)/.test(sym))     cs = 1;
      lot = equity > 0 ? (equity * pct / 100) / cs : 0;
      if (lot < 0.01) lot = 0.01;
      break;
    }

    case 'balance_ratio': {
      // Proportional scaling: follower/master balance ratio × master lots.
      // Example: master=$100k, follower=$10k, master opens 1.0 lot → follower opens 0.10 lot.
      // follower.balance and follower.masterBalance injected in openCopyTrade.
      const followerBal = parseFloat(follower.balance)       || 0;
      const masterBal   = parseFloat(follower.masterBalance) || 0;
      if (followerBal > 0 && masterBal > 0) {
        lot = parseFloat(masterLots) * (followerBal / masterBal);
      } else {
        // Fallback to copyRatio if balances not available
        lot = parseFloat(masterLots) * (parseFloat(follower.copyRatio) || 1.0);
      }
      break;
    }

    case 'risk_pct': {
      // Risk a fixed % of follower balance per trade.
      // Lot = (balance × riskPct%) / (slPips × pipValue)
      // pipValue ≈ $10 per standard lot for major FX pairs (USD quote currency).
      // follower.balance and follower.masterSlPips injected in openCopyTrade.
      const riskPct     = parseFloat(follower.riskPct)     || 1;   // default 1%
      const followerBal = parseFloat(follower.balance)     || 0;
      const slPips      = parseFloat(follower.masterSlPips) || 20;  // assume 20 pips if no SL
      const pipValue    = 10; // $10 per pip per standard lot (major FX)
      if (followerBal > 0) {
        const riskAmount = followerBal * (riskPct / 100);
        lot = riskAmount / (slPips * pipValue);
      } else {
        lot = 0.01;
      }
      break;
    }

    case 'ratio':
    default: {
      const copyRatio = parseFloat(follower.copyRatio) || 1.0;
      lot = parseFloat(masterLots) * copyRatio;
      break;
    }
  }

  // Apply optional hard cap (any mode)
  const maxLot = parseFloat(follower.maxLotPerTrade) || parseFloat(follower.maxLot) || 0;
  if (maxLot > 0) lot = Math.min(lot, maxLot);

  // Round down to 2 dp (MT5 min step = 0.01)
  return Math.max(0.01, Math.floor(lot * 100) / 100);
}

/**
 * Normalize position fields from the MT5 bridge.
 * The Windows VPS Manager API bridge returns different field names than
 * the MetaTrader5 Python library. Handle both.
 */
function normalizePosition(pos) {
  // Ticket: Manager bridge → pos.position or pos.Position; MT5 lib → pos.ticket
  const ticket = String(pos.ticket || pos.position || pos.Position || 'unknown');

  // Symbol: both bridges return 'symbol' or 'Symbol'
  const symbol = pos.symbol || pos.Symbol || '';

  // Volume: Manager bridge Volume is raw MT5 units (10000 = 1 lot), MT5 lib returns lots directly
  // Detect by checking if volume > 100 (likely raw units) vs small decimal (likely lots)
  let volume = parseFloat(pos.volume || pos.Volume || pos.lots || 0);
  if (volume > 100) volume = volume / 10000; // convert raw MT5 units to lots

  // Action/Type: Manager bridge → Action '0'=buy '1'=sell; MT5 lib → type 0/1 or string
  let type = 'buy';
  const rawType = pos.type ?? pos.action ?? pos.Action;
  if (rawType === 0 || rawType === '0' || String(rawType).toLowerCase() === 'buy') {
    type = 'buy';
  } else if (rawType === 1 || rawType === '1' || String(rawType).toLowerCase() === 'sell') {
    type = 'sell';
  }

  // Open price
  const openPrice = pos.price_open ?? pos.PriceOpen ?? pos.open_price ?? pos.openPrice ?? null;

  // SL — used by risk_pct lot mode to calculate lot size from pip risk
  const sl = parseFloat(pos.sl ?? pos.priceSL ?? pos.price_sl ?? pos.SL ?? 0) || 0;

  return { ticket, symbol, volume, type, openPrice, sl };
}

/**
 * Open a copy trade on a follower's MT5 account.
 *
 * IMPORTANT: We INSERT the DB record FIRST (as a "claim") before calling MT5.
 * This means only ONE process wins the DB insert (unique constraint), and only
 * that process opens the real trade on MT5. All others get a duplicate-key error
 * and skip. This prevents multiple server processes from opening duplicate trades.
 */
async function openCopyTrade(master, follower, masterPosition) {
  const pos = normalizePosition(masterPosition);

  const followerAccount = await Mt5Account.findByPk(follower.followerMt5AccountId);
  if (!followerAccount) {
    console.error(`[CopyEngine] Follower ${follower.id} has no MT5 account`);
    return;
  }

  // Check settings for max trade size / reverse copy
  const settings = await CopyTradeSettings.findOne({ where: { followerId: follower.id } });

  const reverseCopy = settings?.reverseCopy || false;
  const action = reverseCopy
    ? (pos.type === 'buy' ? 'sell' : 'buy')
    : pos.type;

  const lotMode = follower.lotMode || 'ratio';

  // ── Convert Sequelize model instance to plain object BEFORE any spread ────
  // Sequelize attribute getters (equityPct, riskPct, copyRatio, etc.) live on
  // the CLASS prototype, NOT as own enumerable properties on the instance.
  // The spread operator `{ ...sequelizeInstance }` only copies OWN properties,
  // so prototype getters are silently lost.  Calling .toJSON() materialises all
  // data values as own properties on a plain object — safe to spread freely.
  let followerData = follower.toJSON ? follower.toJSON() : { ...follower };
  // Inject the current symbol so calculateFollowerLots can use a correct contract size
  followerData._symbol = pos.symbol;

  // ── Inject live data needed by advanced lot modes ────────────────────────
  if (lotMode === 'equity_pct' || lotMode === 'balance_ratio' || lotMode === 'risk_pct') {
    try {
      const acctInfo = await mt5Service.getAccountInfo(followerAccount.mt5Login);
      const d = acctInfo?.data || acctInfo;
      followerData = {
        ...followerData,
        equity:  parseFloat(d?.equity)  || parseFloat(followerAccount.equity)  || 0,
        balance: parseFloat(d?.balance) || parseFloat(followerAccount.balance) || 0,
      };
    } catch { /* use DB-cached values */
      followerData = {
        ...followerData,
        balance: parseFloat(followerAccount.balance) || 0,
        equity:  parseFloat(followerAccount.equity)  || 0,
      };
    }
  }

  if (lotMode === 'balance_ratio') {
    // Need master's live balance to compute the ratio
    try {
      const masterAccount = await Mt5Account.findByPk(master.mt5AccountId);
      if (masterAccount) {
        const masterInfo = await mt5Service.getAccountInfo(masterAccount.mt5Login);
        const md = masterInfo?.data || masterInfo;
        followerData = { ...followerData, masterBalance: parseFloat(md?.balance) || parseFloat(masterAccount.balance) || 1 };
      }
    } catch { /* masterBalance stays undefined → calculateFollowerLots falls back to copyRatio */ }
  }

  if (lotMode === 'risk_pct' && pos.sl > 0 && pos.openPrice > 0) {
    // Compute SL distance in pips (1 pip = 0.0001 for 5-digit FX pairs, 0.01 for JPY)
    const slDist = Math.abs(pos.openPrice - pos.sl);
    const pipSize = pos.symbol?.includes('JPY') ? 0.01 : 0.0001;
    const slPips  = slDist / pipSize;
    if (slPips > 0) followerData = { ...followerData, masterSlPips: slPips };
  }

  let lots = calculateFollowerLots(pos.volume, followerData);
  if (settings?.maxTradeSize && lots > parseFloat(settings.maxTradeSize)) {
    lots = parseFloat(settings.maxTradeSize);
  }

  // ── Atomically claim the trade slot using findOrCreate ───────────────────
  // findOrCreate: SELECT first, INSERT if not found — wrapped in a transaction.
  // With the unique index on (follower_id, master_ticket), if two processes
  // race, only ONE insert succeeds. Sequelize retries the SELECT for the loser
  // and returns created=false. The loser exits here without touching MT5.
  let claimedRecord, created;
  try {
    [claimedRecord, created] = await CopyTrade.findOrCreate({
      where: {
        followerId: follower.id,
        masterTicket: pos.ticket,
      },
      defaults: {
        masterId: master.id,
        followerTicket: null,
        symbol: pos.symbol,
        action,
        masterLots: pos.volume,
        followerLots: lots,
        openPrice: pos.openPrice,
        status: 'open',
        openedAt: new Date()
      }
    });
  } catch (claimErr) {
    console.error(`[CopyEngine] findOrCreate failed for follower ${follower.id}, ticket ${pos.ticket}:`, claimErr.message);
    return;
  }

  if (!created) {
    if (claimedRecord.status === 'failed') {
      // A previous attempt failed (e.g. MT5 reject, equity_pct calc error).
      // Reset the record so we can try again — fall through to the MT5 open below.
      console.log(`[CopyEngine] Retrying failed copy trade: follower ${follower.id}, ticket ${pos.ticket}`);
      try {
        await claimedRecord.update({
          followerLots:  lots,
          action,
          status:        'open',
          errorMessage:  null,
          openedAt:      new Date(),
        });
      } catch (resetErr) {
        console.error(`[CopyEngine] Failed to reset 'failed' record for retry:`, resetErr.message);
        return;
      }
      // Fall through — claimedRecord is now in 'open' state; proceed to MT5 call
    } else {
      // Already 'open' or 'closed' — nothing to do
      console.log(`[CopyEngine] Trade already claimed (status=${claimedRecord.status}, follower ${follower.id}, ticket ${pos.ticket}) — skipping`);
      return;
    }
  }

  // ── Only the process that created (or reset) the record reaches here ─────
  try {
    console.log(`[CopyEngine] Opening copy trade: master ${master.id} → follower ${follower.id} | ${action} ${lots} ${pos.symbol} (master ticket ${pos.ticket})`);

    const tradeResult = await mt5Service.openTrade(
      followerAccount.mt5Login,
      pos.symbol,
      action,
      lots
    );

    const followerTicket = tradeResult?.position_ticket || tradeResult?.deal_id || tradeResult?.ticket || null;
    const tradeSuccess = followerTicket || tradeResult?.success;

    await claimedRecord.update({
      followerTicket: followerTicket ? String(followerTicket) : null,
      status: tradeSuccess ? 'open' : 'failed',
      errorMessage: tradeSuccess ? null : (tradeResult?.error || tradeResult?.message || 'Trade execution failed'),
    });

    console.log(`[CopyEngine] Copy trade ${tradeSuccess ? 'OPENED' : 'FAILED'}: follower ticket ${followerTicket || 'none'}`);
  } catch (error) {
    console.error(`[CopyEngine] MT5 open error for follower ${follower.id}:`, error.message);
    await claimedRecord.update({ status: 'failed', errorMessage: error.message }).catch(() => {});
  }
}

/**
 * Close a copy trade on a follower's MT5 account
 */
async function closeCopyTrade(copyTrade) {
  try {
    if (!copyTrade.followerTicket) {
      console.log(`[CopyEngine] No follower ticket for copy trade ${copyTrade.id} — marking closed`);
      await copyTrade.update({ status: 'closed', closedAt: new Date() });
      return;
    }

    const followerRelation = await CopyTradeFollower.findByPk(copyTrade.followerId);
    if (!followerRelation) return;

    const followerAccount = await Mt5Account.findByPk(followerRelation.followerMt5AccountId);
    if (!followerAccount) return;

    const followerTicket = parseInt(copyTrade.followerTicket);
    const followerVolume = parseFloat(copyTrade.followerLots) || 0;

    console.log(`[CopyEngine] Closing copy trade: ticket ${followerTicket}, volume ${followerVolume}, symbol ${copyTrade.symbol} on login ${followerAccount.mt5Login}`);

    const result = await mt5Service.closeTrade(
      followerAccount.mt5Login,
      followerTicket,
      followerVolume,
      copyTrade.symbol
    );

    await copyTrade.update({
      status: 'closed',
      closePrice: result?.price || null,
      profit: result?.profit || 0,
      closedAt: new Date()
    });

    // Update follower's total profit
    const totalProfit = await CopyTrade.sum('profit', {
      where: { followerId: copyTrade.followerId, status: 'closed' }
    });
    await CopyTradeFollower.update(
      { totalCopiedProfit: totalProfit || 0 },
      { where: { id: copyTrade.followerId } }
    );

    console.log(`[CopyEngine] Copy trade closed: profit ${result?.profit || 0}`);
  } catch (error) {
    console.error(`[CopyEngine] Error closing copy trade ${copyTrade.id}:`, error.message);
  }
}

/**
 * Poll a single master's positions and mirror changes
 */
async function pollMaster(master) {
  try {
    const masterAccount = await Mt5Account.findByPk(master.mt5AccountId);
    if (!masterAccount?.mt5Login) return;

    // Get current positions from MT5
    // Bridge returns { success, positions: [...] } — extract the array
    const posResponse = await mt5Service.getOpenPositions(masterAccount.mt5Login);
    const currentPositions = Array.isArray(posResponse)
      ? posResponse
      : (posResponse?.positions || []);
    // Normalize ticket field — bridge may return 'ticket', 'position', or 'Position'
    const currentTickets = new Set(currentPositions.map(p =>
      String(p.ticket || p.position || p.Position || 'unknown')
    ));

    // Init tracking for this master
    if (!masterPositions[master.id]) masterPositions[master.id] = {};

    const tracked = masterPositions[master.id];
    const trackedTickets = new Set(Object.keys(tracked));

    // Get active followers — deduplicate by MT5 account to prevent
    // double-copying if the same account has multiple follower records
    const allFollowers = await CopyTradeFollower.findAll({
      where: { masterId: master.id, status: 'active' }
    });

    const seenAccounts = new Set();
    const followers = allFollowers.filter(f => {
      // Use String() to safely compare BigInt/number/string from MySQL
      const accountKey = String(f.followerMt5AccountId);
      if (seenAccounts.has(accountKey)) {
        console.warn(`[CopyEngine] Duplicate follower account ${accountKey} for master ${master.id} — skipping`);
        return false;
      }
      seenAccounts.add(accountKey);
      return true;
    });

    if (followers.length === 0) return;

    // Log position count changes
    if (currentPositions.length !== Object.keys(tracked).length) {
      console.log(`[CopyEngine] Master ${master.id} (login ${masterAccount.mt5Login}): ${currentPositions.length} MT5 positions, ${Object.keys(tracked).length} tracked, ${followers.length} followers`);
    }

    // Detect NEW positions (in current but not tracked)
    for (const pos of currentPositions) {
      const ticket = String(pos.ticket || pos.position || pos.Position || 'unknown');
      if (!trackedTickets.has(ticket)) {
        console.log(`[CopyEngine] New position detected: master ${master.id}, ticket ${ticket}, ${pos.symbol}`);
        tracked[ticket] = pos;

        // Copy to all followers — skip if already copied (prevents duplicates after restart)
        for (const follower of followers) {
          const guardKey = `${master.id}:${follower.id}:${ticket}`;

          // In-flight guard: skip if another concurrent poll is already copying this
          if (inFlightCopies.has(guardKey)) {
            console.log(`[CopyEngine] In-flight skip: ${guardKey}`);
            continue;
          }

          // DB guard: skip if already successfully copied or closed.
          // NOTE: do NOT include 'failed' here — failed copies should be retried.
          const alreadyCopied = await CopyTrade.findOne({
            where: {
              masterId: master.id,
              followerId: follower.id,
              masterTicket: ticket,
              status: ['open', 'closed']   // 'failed' = allow retry
            }
          });
          if (alreadyCopied) {
            // Only log periodically to avoid spam
            continue;
          }

          inFlightCopies.add(guardKey);
          try {
            await openCopyTrade(master, follower, pos);
          } finally {
            inFlightCopies.delete(guardKey);
          }
        }
      }
    }

    // Detect CLOSED positions (in tracked but not current)
    for (const ticket of trackedTickets) {
      if (!currentTickets.has(ticket)) {
        console.log(`[CopyEngine] Position closed: master ${master.id}, ticket ${ticket}`);
        delete tracked[ticket];

        // Close corresponding copy trades
        const openCopyTrades = await CopyTrade.findAll({
          where: { masterId: master.id, masterTicket: ticket, status: 'open' }
        });
        for (const ct of openCopyTrades) {
          await closeCopyTrade(ct);
        }
      }
    }
  } catch (error) {
    console.error(`[CopyEngine] Error polling master ${master.id}:`, error.message);
  }
}

/**
 * Main polling loop — polls all active approved masters.
 * Uses recursive setTimeout (NOT setInterval) so a slow poll never overlaps
 * with the next one — prevents the same new position being detected twice.
 */
let pollCount = 0;
async function pollAllMasters() {
  if (isPolling) {
    console.warn('[CopyEngine] Previous poll still running — skipping this tick');
    return;
  }
  isPolling = true;
  try {
    const masters = await CopyTradeMaster.findAll({
      where: { status: 'approved', isActive: true }
    });

    // Log every 20th poll to avoid spam (= every 60s at 3s interval)
    pollCount++;
    if (pollCount % 20 === 1) {
      console.log(`[CopyEngine] Poll #${pollCount}: ${masters.length} active masters`);
    }

    for (const master of masters) {
      await pollMaster(master);
    }
  } catch (error) {
    console.error('[CopyEngine] Polling error:', error.message);
  } finally {
    isPolling = false;
    // Schedule next poll only after this one finishes
    if (pollingTimer !== null) {
      pollingTimer = setTimeout(pollAllMasters, POLL_INTERVAL);
    }
  }
}

/**
 * Start the copy trade engine
 */
/**
 * Initialize: snapshot current master positions so we don't re-copy existing trades on cold start
 */
async function initializePositionTracking() {
  try {
    const masters = await CopyTradeMaster.findAll({
      where: { status: 'approved', isActive: true }
    });

    for (const master of masters) {
      const masterAccount = await Mt5Account.findByPk(master.mt5AccountId);
      if (!masterAccount?.mt5Login) continue;

      try {
        const posResponse = await mt5Service.getOpenPositions(masterAccount.mt5Login);
        const positions = Array.isArray(posResponse) ? posResponse : (posResponse?.positions || []);

        masterPositions[master.id] = {};
        for (const pos of positions) {
          const t = String(pos.ticket || pos.position || pos.Position || 'unknown');
          masterPositions[master.id][t] = pos;
        }
        console.log(`[CopyEngine] Init: master ${master.id} (login ${masterAccount.mt5Login}) has ${positions.length} existing positions`);
      } catch (e) {
        console.error(`[CopyEngine] Init: failed to snapshot master ${master.id}:`, e.message);
        masterPositions[master.id] = {};
      }
    }
    console.log(`[CopyEngine] Initialized position tracking for ${masters.length} masters`);
  } catch (error) {
    console.error('[CopyEngine] Init error:', error.message);
  }
}

export async function startCopyEngine() {
  if (pollingTimer !== null) {
    console.log('[CopyEngine] Already running');
    return;
  }

  console.log(`[CopyEngine] Starting copy trade engine (poll every ${POLL_INTERVAL / 1000}s)`);

  // Snapshot existing positions so we don't duplicate trades on server restart
  await initializePositionTracking();

  // Use a sentinel value so stopCopyEngine can cancel the first scheduled poll
  pollingTimer = true;
  pollingTimer = setTimeout(pollAllMasters, POLL_INTERVAL);
}

/**
 * Stop the copy trade engine
 */
export function stopCopyEngine() {
  if (pollingTimer !== null) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
    isPolling = false;
    console.log('[CopyEngine] Stopped');
  }
}

/**
 * Manually trigger copy for a specific master trade (for API-driven approach)
 */
export async function triggerCopy(masterId, position) {
  const master = await CopyTradeMaster.findByPk(masterId);
  if (!master || master.status !== 'approved') return;

  const followers = await CopyTradeFollower.findAll({
    where: { masterId, status: 'active' }
  });

  for (const follower of followers) {
    await openCopyTrade(master, follower, position);
  }
}

export default { startCopyEngine, stopCopyEngine, triggerCopy };
