/**
 * copyTradeSync.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every SYNC_INTERVAL_MS (default 30 s) and reconciles the DB against
 * real MT5 open positions.  Handles BOTH:
 *
 *   1. Normal trades  (trades table)
 *      If a position is no longer open in MT5, mark the Trade record closed
 *      with the latest tick price + calculated profit.
 *
 *   2. Copy trades  (copy_trades table)
 *      If the master's position is no longer open in MT5, close the follower's
 *      MT5 position via the gateway AND mark the CopyTrade record closed.
 *      The CopyTrade.afterUpdate hook auto-charges the performance fee.
 *
 * WHY THIS EXISTS:
 * Users may close positions directly from the MT5 terminal.  The platform has
 * no webhook from the terminal for that event, so DB records can stay 'open'
 * indefinitely.  This service bridges that gap automatically.
 */

import * as mt5Service from './mt5.service.js';
import { CopyTrade, CopyTradeFollower, CopyTradeMaster, Mt5Account, Trade } from '../models/index.js';

const SYNC_INTERVAL_MS = 30_000;   // 30 seconds between passes

let _running = false;
let _timer   = null;

// ── Contract size helper (mirrors trade.controller.js) ────────────────────
function _contractSize(symbol) {
  const s = (symbol || '').toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(s))                                                return 100;
  if (/^(BTC|ETH|LTC|XRP|ADA|DOT|SOL|BNB|DOGE|AVAX|MATIC|LINK|UNI|ATOM)/.test(s)) return 1;
  if (/^(US30|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX)/.test(s))          return 1;
  return 100_000;
}

// ── Helper: get open position tickets for an MT5 login ────────────────────
async function _getOpenTickets(mt5Login) {
  try {
    const result = await mt5Service.getOpenPositions(mt5Login);
    let positions = [];
    if (Array.isArray(result))                  positions = result;
    else if (Array.isArray(result?.positions))  positions = result.positions;

    return new Set(
      positions
        .map(p => String(p.ticket || p.position || ''))
        .filter(Boolean)
    );
  } catch {
    return null; // null = gateway unreachable — skip this login, try next run
  }
}

// ── Helper: get close price from live tick ────────────────────────────────
async function _getClosePrice(symbol, type) {
  try {
    const tick = await mt5Service.getSymbolTick(symbol);
    if (!tick) return null;
    return type === 'buy'
      ? (parseFloat(tick.bid) || null)
      : (parseFloat(tick.ask) || null);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 1 — Normal trades
// ═══════════════════════════════════════════════════════════════════════════
async function syncNormalTrades() {
  // Load all open Trade records with their account's mt5Login
  const openTrades = await Trade.findAll({
    where: { status: 'open' },
    include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }]
  });

  if (openTrades.length === 0) return;

  // Group by mt5Login
  const loginGroups = new Map(); // mt5Login → Trade[]
  for (const trade of openTrades) {
    const login = trade.account?.mt5Login;
    if (!login) continue;
    if (!loginGroups.has(login)) loginGroups.set(login, []);
    loginGroups.get(login).push(trade);
  }

  for (const [login, trades] of loginGroups) {
    const openTickets = await _getOpenTickets(login);
    if (openTickets === null) continue; // gateway down for this login — skip

    const closedTrades = trades.filter(t =>
      t.mt5Ticket && !openTickets.has(String(t.mt5Ticket))
    );

    if (closedTrades.length === 0) continue;
    console.log(`[TradeSync] Login ${login}: ${closedTrades.length} normal trade(s) closed in MT5`);

    for (const trade of closedTrades) {
      const closePrice = await _getClosePrice(trade.symbol, trade.type);
      let profit = 0;
      if (closePrice) {
        const openPx = parseFloat(trade.openPrice) || 0;
        const vol    = parseFloat(trade.volume) || 0;
        const cs     = _contractSize(trade.symbol);
        profit = trade.type === 'buy'
          ? (closePrice - openPx) * vol * cs
          : (openPx - closePrice) * vol * cs;
        profit = Math.round(profit * 100) / 100;
      }

      try {
        await trade.update({
          status:    'closed',
          closePrice: closePrice,
          closeTime: new Date(),
          profit:    profit,
          syncedAt:  new Date(),
        });
        console.log(`[TradeSync] Trade id=${trade.id} ticket=${trade.mt5Ticket} closed, profit=${profit}`);
      } catch (err) {
        console.error(`[TradeSync] Failed to close trade id=${trade.id}:`, err.message);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — Copy trades
// ═══════════════════════════════════════════════════════════════════════════
async function syncCopyTrades() {
  // Load all open CopyTrade rows with follower and master account info
  const openTrades = await CopyTrade.findAll({
    where: { status: 'open' },
    include: [
      {
        model: CopyTradeFollower,
        as: 'followerRelation',
        required: true,
        include: [
          { model: Mt5Account, as: 'followerAccount', attributes: ['id', 'mt5Login'] }
        ]
      },
      {
        model: CopyTradeMaster,
        as: 'master',
        required: true,
        include: [
          { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }
        ]
      }
    ]
  });

  if (openTrades.length === 0) return;

  // Group by master MT5 login
  const masterGroups = new Map(); // masterMt5Login → CopyTrade[]
  for (const trade of openTrades) {
    const masterLogin = trade.master?.account?.mt5Login;
    if (!masterLogin) continue;
    if (!masterGroups.has(masterLogin)) masterGroups.set(masterLogin, []);
    masterGroups.get(masterLogin).push(trade);
  }

  for (const [masterLogin, trades] of masterGroups) {
    const openTickets = await _getOpenTickets(masterLogin);
    if (openTickets === null) continue; // gateway down — skip

    // masterTickets no longer present in MT5 → master closed them
    const closedTrades = trades.filter(t =>
      t.masterTicket && !openTickets.has(String(t.masterTicket))
    );

    if (closedTrades.length === 0) continue;
    console.log(`[CopySync] Master ${masterLogin}: ${closedTrades.length} copy trade(s) closed in MT5`);

    for (const trade of closedTrades) {
      const followerLogin  = trade.followerRelation?.followerAccount?.mt5Login;
      const followerTicket = trade.followerTicket;

      // a. Close the follower's MT5 position (best-effort — may already be closed)
      if (followerLogin && followerTicket) {
        try {
          await mt5Service.closeTrade(
            followerLogin,
            followerTicket,
            parseFloat(trade.followerLots) || 0,
            trade.symbol,
            `CopySync master=${masterLogin} closed`
          );
          console.log(`[CopySync] Closed follower ${followerLogin} ticket=${followerTicket}`);
        } catch (err) {
          // Position may already be closed by C# engine or manually — log and continue
          console.warn(`[CopySync] Follower MT5 close skipped (${followerLogin}/${followerTicket}): ${err.message}`);
        }
      }

      // b. Calculate close price + profit from follower's perspective
      const closePrice = await _getClosePrice(trade.symbol, trade.action);
      let profit = 0;
      if (closePrice) {
        const openPx = parseFloat(trade.openPrice) || 0;
        const vol    = parseFloat(trade.followerLots) || 0;
        const cs     = _contractSize(trade.symbol);
        profit = trade.action === 'buy'
          ? (closePrice - openPx) * vol * cs
          : (openPx - closePrice) * vol * cs;
        profit = Math.round(profit * 100) / 100;
      }

      // c. Update DB → CopyTrade.afterUpdate hook fires and charges performance fee
      try {
        await trade.update({
          status:    'closed',
          closePrice: closePrice,
          profit:    profit,
          closedAt:  new Date(),
        });
      } catch (err) {
        console.error(`[CopySync] DB update failed for copy tradeId=${trade.id}:`, err.message);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main sync pass — runs both passes sequentially
// ═══════════════════════════════════════════════════════════════════════════
async function syncOnce() {
  if (_running) return;
  _running = true;
  const t0 = Date.now();

  try {
    await Promise.allSettled([
      syncNormalTrades(),
      syncCopyTrades(),
    ]);

    const elapsed = Date.now() - t0;
    if (elapsed > 5000) {
      console.log(`[TradeSync] Full pass took ${elapsed}ms`);
    }
  } catch (err) {
    console.error('[TradeSync] Unexpected error:', err.message);
  } finally {
    _running = false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Start the background sync loop.
 * Called once from index.js after the server is fully booted.
 */
export function startCopyTradeSync() {
  if (_timer) return;
  console.log(`[TradeSync] Position sync started (every ${SYNC_INTERVAL_MS / 1000}s) — normal + copy trades`);
  syncOnce(); // run immediately on boot
  _timer = setInterval(syncOnce, SYNC_INTERVAL_MS);
}

/**
 * Stop the loop (graceful shutdown / tests).
 */
export function stopCopyTradeSync() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

/**
 * Run a single sync pass immediately.
 * Used by POST /api/internal/copy-trade/sync
 */
export async function runSyncNow() {
  if (_running) return { synced: false, reason: 'already_running' };
  await syncOnce();
  return { synced: true };
}
