/**
 * Internal copy-trade webhook controller
 * Called by the C# MT5 Gateway (Windows VPS) when a master trade closes.
 * Protected by MT5_BRIDGE_API_KEY — never expose without the API key check.
 */
import { Op } from 'sequelize';
import { CopyTrade, CopyTradeFollower, CopyTradeMaster, Mt5Account } from '../../models/index.js';
import { successResponse } from '../../utils/response.js';

/**
 * POST /internal/copy-trade/closed
 *
 * C# gateway sends this when it closes a follower's copied position.
 *
 * Accepted payloads:
 *
 * Per-follower close (preferred — sent once per follower the C# engine closed):
 *   {
 *     masterTicket:     "123456",         // master's original MT5 ticket
 *     followerTicket:   "789012",         // follower's MT5 ticket (optional but preferred)
 *     followerMt5Login: "300102",         // follower's MT5 login number
 *     masterMt5Login:   "200045",         // master's MT5 login number (optional)
 *     closePrice:       1.08523,          // price at close
 *     profit:           45.20,            // net profit in USD
 *     closedAt:         "2025-05-20T10:30:00Z"  // ISO timestamp (optional, defaults to now)
 *   }
 *
 * Bulk close (sent once when master closes — closes ALL open copies for that masterTicket):
 *   {
 *     masterTicket:     "123456",
 *     masterMt5Login:   "200045",
 *     closePrice:       1.08523,
 *     profit:           null,             // null = each follower's profit is unknown; will be set to 0
 *     closedAt:         "2025-05-20T10:30:00Z"
 *   }
 */
export const tradeClosed = async (req, res, next) => {
  try {
    const {
      masterTicket,
      followerTicket,
      followerMt5Login,
      masterMt5Login,
      closePrice,
      profit,
      closedAt,
    } = req.body;

    if (!masterTicket) {
      return res.status(400).json({ success: false, message: 'masterTicket is required' });
    }

    const closedAtDate = closedAt ? new Date(closedAt) : new Date();
    const closePriceVal = closePrice != null ? parseFloat(closePrice) : null;

    // ── Strategy 1: exact match by followerTicket ─────────────────────────
    if (followerTicket) {
      const trade = await CopyTrade.findOne({
        where: { followerTicket: String(followerTicket), status: 'open' }
      });

      if (trade) {
        const profitVal = profit != null ? parseFloat(profit) : 0;
        await trade.update({ status: 'closed', closePrice: closePriceVal, profit: profitVal, closedAt: closedAtDate });
        await _updateFollowerProfit(trade.followerId, profitVal);
        console.log(`[InternalCopyTrade] Closed by followerTicket=${followerTicket} profit=${profitVal}`);
        return res.json(successResponse({ closed: 1, tradeId: trade.id }, 'Copy trade closed'));
      }
    }

    // ── Strategy 2: match by followerMt5Login + masterTicket ─────────────
    if (followerMt5Login) {
      const followerAccount = await Mt5Account.findOne({ where: { mt5Login: String(followerMt5Login) } });
      if (followerAccount) {
        const followerRecord = await CopyTradeFollower.findOne({
          where: { followerMt5AccountId: followerAccount.id }
        });
        if (followerRecord) {
          const trade = await CopyTrade.findOne({
            where: {
              followerId: followerRecord.id,
              masterTicket: String(masterTicket),
              status: 'open'
            }
          });
          if (trade) {
            const profitVal = profit != null ? parseFloat(profit) : 0;
            await trade.update({ status: 'closed', closePrice: closePriceVal, profit: profitVal, closedAt: closedAtDate });
            await _updateFollowerProfit(followerRecord.id, profitVal);
            console.log(`[InternalCopyTrade] Closed by followerMt5Login=${followerMt5Login} masterTicket=${masterTicket} profit=${profitVal}`);
            return res.json(successResponse({ closed: 1, tradeId: trade.id }, 'Copy trade closed'));
          }
        }
      }
    }

    // ── Strategy 3: bulk close all open copies of this masterTicket ───────
    // Used when C# sends one notification per master trade (not per follower)
    const openTrades = await CopyTrade.findAll({
      where: { masterTicket: String(masterTicket), status: 'open' }
    });

    if (openTrades.length === 0) {
      // Already closed or never recorded — not an error
      return res.json(successResponse({ closed: 0 }, 'No open copy trades found for that masterTicket'));
    }

    let closedCount = 0;
    for (const trade of openTrades) {
      const profitVal = profit != null ? parseFloat(profit) : 0;
      await trade.update({ status: 'closed', closePrice: closePriceVal, profit: profitVal, closedAt: closedAtDate });
      await _updateFollowerProfit(trade.followerId, profitVal);
      closedCount++;
    }

    console.log(`[InternalCopyTrade] Bulk closed ${closedCount} copy trade(s) for masterTicket=${masterTicket}`);
    return res.json(successResponse({ closed: closedCount }, `${closedCount} copy trade(s) closed`));

  } catch (error) {
    next(error);
  }
};

/**
 * POST /internal/copy-trade/opened
 *
 * C# gateway sends this when it successfully opens a copied position for a follower.
 * Creates or updates the CopyTrade DB record with the assigned follower ticket.
 *
 * Body:
 *   {
 *     masterTicket:     "123456",
 *     followerTicket:   "789012",
 *     followerMt5Login: "300102",
 *     masterMt5Login:   "200045",
 *     symbol:           "EURUSD",
 *     action:           "buy",
 *     masterLots:       1.0,
 *     followerLots:     0.5,
 *     openPrice:        1.08200,
 *     openedAt:         "2025-05-20T09:00:00Z"
 *   }
 */
export const tradeOpened = async (req, res, next) => {
  try {
    const {
      masterTicket,
      followerTicket,
      followerMt5Login,
      masterMt5Login,
      symbol,
      action,
      masterLots,
      followerLots,
      openPrice,
      openedAt,
    } = req.body;

    if (!masterTicket || !followerMt5Login) {
      return res.status(400).json({ success: false, message: 'masterTicket and followerMt5Login are required' });
    }

    // Resolve follower account → follower record
    const followerAccount = await Mt5Account.findOne({ where: { mt5Login: String(followerMt5Login) } });
    if (!followerAccount) {
      return res.status(404).json({ success: false, message: `No Mt5Account for login ${followerMt5Login}` });
    }

    const followerRecord = await CopyTradeFollower.findOne({
      where: { followerMt5AccountId: followerAccount.id }
    });
    if (!followerRecord) {
      return res.status(404).json({ success: false, message: `No CopyTradeFollower for Mt5Account ${followerAccount.id}` });
    }

    // Resolve master (optional — needed for masterId)
    let masterId = followerRecord.masterId;
    if (masterMt5Login) {
      const masterAccount = await Mt5Account.findOne({ where: { mt5Login: String(masterMt5Login) } });
      if (masterAccount) {
        const masterRecord = await CopyTradeMaster.findOne({ where: { mt5AccountId: masterAccount.id } });
        if (masterRecord) masterId = masterRecord.id;
      }
    }

    // Upsert: update existing open record or create new one
    const existing = await CopyTrade.findOne({
      where: { followerId: followerRecord.id, masterTicket: String(masterTicket), status: 'open' }
    });

    if (existing) {
      // Update followerTicket if gateway assigned one
      if (followerTicket) await existing.update({ followerTicket: String(followerTicket) });
      return res.json(successResponse({ tradeId: existing.id, action: 'updated' }, 'Copy trade updated'));
    }

    const trade = await CopyTrade.create({
      masterId,
      followerId:     followerRecord.id,
      masterTicket:   String(masterTicket),
      followerTicket: followerTicket ? String(followerTicket) : null,
      symbol:         symbol || 'UNKNOWN',
      action:         action || 'buy',
      masterLots:     parseFloat(masterLots) || 0,
      followerLots:   parseFloat(followerLots) || 0,
      openPrice:      openPrice != null ? parseFloat(openPrice) : null,
      status:         'open',
      openedAt:       openedAt ? new Date(openedAt) : new Date(),
    });

    console.log(`[InternalCopyTrade] Opened tradeId=${trade.id} follower=${followerMt5Login} masterTicket=${masterTicket}`);
    return res.status(201).json(successResponse({ tradeId: trade.id, action: 'created' }, 'Copy trade recorded'));

  } catch (error) {
    // Unique constraint = duplicate — treat as success
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.json(successResponse({ action: 'duplicate_ignored' }, 'Duplicate copy trade ignored'));
    }
    next(error);
  }
};

// ── Private helpers ────────────────────────────────────────────────────────

async function _updateFollowerProfit(followerId, profit) {
  if (!profit || profit <= 0) return;
  try {
    const follower = await CopyTradeFollower.findByPk(followerId, { attributes: ['id', 'totalCopiedProfit'] });
    if (!follower) return;
    const current = parseFloat(follower.totalCopiedProfit) || 0;
    await follower.update({ totalCopiedProfit: current + profit });
  } catch (e) {
    console.error('[InternalCopyTrade] Failed to update totalCopiedProfit:', e.message);
  }
}

export default { tradeClosed, tradeOpened };
