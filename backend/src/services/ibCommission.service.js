/**
 * IB Commission Service
 *
 * Awards commissions to Introducing Brokers when their referred users
 * make deposits, place trades, or when new users register via their link.
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────
 *
 * 1. Deposit approved  →  awardDepositCommission(userId, depositId, amount)
 * 2. Trade closes      →  awardTradingCommission(userId, tradeId, grossProfit)
 * 3. User registers    →  awardReferralBonus(referrerId, newUserId)
 *
 * ─── Multi-level ──────────────────────────────────────────────────────────
 *
 * We walk up the referral chain (users.referred_by) up to MAX_REFERRAL_LEVELS.
 * At each step:
 *   - find the referrer's IB tree
 *   - read the commission rate for their current IB tier (ib_levels.level)
 *   - create an ib_commissions record
 *   - credit their platform wallet
 *
 * ─── Safe by design ───────────────────────────────────────────────────────
 *
 * All errors are caught and logged — commission failures never block the
 * triggering action (deposit approval, trade close, registration).
 */

import { IbTree, IbCommission, IbLevel, User, Wallet, WalletTransaction } from '../models/index.js';

const MAX_REFERRAL_LEVELS = 3;

function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

// ─── Wallet helpers ────────────────────────────────────────────────────────

async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) wallet = await Wallet.create({ userId, balance: 0 });
  return wallet;
}

async function creditWallet(userId, amount, description) {
  if (!amount || amount <= 0) return;
  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = parseFloat(wallet.balance) || 0;
  const balanceAfter = round2(balanceBefore + amount);
  await wallet.update({ balance: balanceAfter });
  await WalletTransaction.create({
    walletId: wallet.id,
    type: 'commission',
    amount,
    balanceBefore,
    balanceAfter,
    description,
    referenceType: 'ib_commission',
  });
}

// ─── Core: walk up referral chain and award ────────────────────────────────

// lots: trade volume in lots (used when commissionMode = 'per_lot')
async function awardUpChain(tradingUserId, commType, baseAmount, relatedId, relatedType, lots = 0) {
  if (commType !== 'deposit' && commType !== 'trading') return;
  if (commType === 'deposit' && (baseAmount <= 0)) return;

  let currentUserId = tradingUserId;

  for (let depth = 1; depth <= MAX_REFERRAL_LEVELS; depth++) {
    const user = await User.findByPk(currentUserId, { attributes: ['id', 'referredBy'] });
    if (!user?.referredBy) break;

    const referrerId = user.referredBy;
    currentUserId = referrerId;  // move up before any skips

    // Referrer must have an active IB tree
    const ibTree = await IbTree.findOne({ where: { userId: referrerId, status: 'active' } });
    if (!ibTree) continue;

    // Commission rate = referrer's current tier rates
    const tier = ibTree.level || 1;
    const ibLevel = await IbLevel.findOne({ where: { level: tier, isActive: true } });
    if (!ibLevel) continue;

    let commAmount = 0;
    let pct = 0;

    if (commType === 'deposit') {
      pct = parseFloat(ibLevel.depositCommissionPercent || 0);
      if (pct <= 0) continue;
      commAmount = round2(baseAmount * pct / 100);
    } else {
      // trading commission: per_lot or percentage
      const mode = ibLevel.commissionMode || 'percentage';
      if (mode === 'per_lot') {
        const perLot = parseFloat(ibLevel.perLotCommission || 0);
        if (perLot <= 0 || lots <= 0) continue;
        commAmount = round2(lots * perLot);
        pct = 0; // stored as 0 when per-lot
      } else {
        pct = parseFloat(ibLevel.tradingCommissionPercent || 0);
        if (pct <= 0 || baseAmount <= 0) continue;
        commAmount = round2(baseAmount * pct / 100);
      }
    }

    if (commAmount <= 0) continue;

    // Deduplication: skip if a commission already exists for this exact referrer + trade/deposit
    if (relatedId && relatedType) {
      const already = await IbCommission.findOne({
        where: { ibTreeId: ibTree.id, relatedId, relatedType }
      });
      if (already) {
        console.log(`[IB] Commission already exists for ibTreeId=${ibTree.id} relatedId=${relatedId} — skipping`);
        continue;
      }
    }

    try {
      await IbCommission.create({
        ibTreeId: ibTree.id,
        referredUserId: tradingUserId,
        relatedId: relatedId || null,
        relatedType: relatedType || null,
        commissionType: commType,
        baseAmount: commType === 'deposit' ? round2(baseAmount) : round2(lots || baseAmount),
        commissionPercent: pct,
        commissionAmount: commAmount,
        level: depth,
        status: 'approved'
      });

      await creditWallet(
        referrerId,
        commAmount,
        `IB ${commType} commission (Level ${depth}) — ` +
        `${commType === 'deposit' ? 'Deposit' : 'Trade'} #${relatedId || '?'} by user #${tradingUserId}`
      );

      await ibTree.increment({ totalCommissions: commAmount });
      console.log(`[IB] Awarded $${commAmount} (${pct}% of $${baseAmount}) to user #${referrerId} at depth ${depth}`);
    } catch (e) {
      console.error(`[IB] Commission award error at depth ${depth} for user #${referrerId}:`, e.message);
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Award deposit commissions up the referral chain.
 * Call this after a deposit is approved and credited to MT5.
 *
 * @param {number} userId      - the user who deposited
 * @param {number} depositId   - Deposit.id
 * @param {number} amount      - deposit amount in USD
 */
export async function awardDepositCommission(userId, depositId, amount) {
  try {
    await awardUpChain(userId, 'deposit', amount, depositId, 'deposit');

    // Track total deposits in direct referrer's IB tree
    const user = await User.findByPk(userId, { attributes: ['id', 'referredBy'] });
    if (user?.referredBy) {
      const tree = await IbTree.findOne({ where: { userId: user.referredBy, status: 'active' } });
      if (tree) await tree.increment({ totalDeposits: amount });
    }
  } catch (e) {
    console.error('[IB] awardDepositCommission error:', e.message);
  }
}

/**
 * Award trading commissions up the referral chain.
 *
 * @param {number} userId    - the user who traded
 * @param {number} tradeId   - Trade.id
 * @param {number} profit    - gross profit on the trade
 * @param {number} lots      - trade volume in lots (required for per_lot commission mode)
 */
export async function awardTradingCommission(userId, tradeId, profit, lots = 0, relatedType = 'trade') {
  try {
    // For per_lot mode we need lots > 0; for percentage mode we need profit > 0.
    // Pass both — awardUpChain decides which to use based on commissionMode.
    if ((!profit || profit <= 0) && (!lots || lots <= 0)) return;
    await awardUpChain(userId, 'trading', profit || 0, tradeId, relatedType, lots);
  } catch (e) {
    console.error('[IB] awardTradingCommission error:', e.message);
  }
}

/**
 * Award referral bonus when a new user registers via an IB link.
 * Uses the fixed bonusAmount from the referrer's IB level (if configured).
 *
 * @param {number} referrerId - the IB's user ID
 * @param {number} newUserId  - the newly registered user's ID
 */
export async function awardReferralBonus(referrerId, newUserId) {
  try {
    const ibTree = await IbTree.findOne({ where: { userId: referrerId, status: 'active' } });
    if (!ibTree) return;

    // Always update referral counters
    await ibTree.increment({ directReferrals: 1, totalReferrals: 1 });

    const tier = ibTree.level || 1;
    const ibLevel = await IbLevel.findOne({ where: { level: tier, isActive: true } });
    const bonusAmt = parseFloat(ibLevel?.bonusAmount || 0);

    if (bonusAmt > 0) {
      await IbCommission.create({
        ibTreeId: ibTree.id,
        referredUserId: newUserId,
        relatedId: newUserId,
        relatedType: 'registration',
        commissionType: 'referral',
        baseAmount: 0,
        commissionPercent: parseFloat(ibLevel?.referralBonusPercent || 0),
        commissionAmount: bonusAmt,
        level: 1,
        status: 'approved'
      });

      await creditWallet(referrerId, bonusAmt, `Referral bonus — new user #${newUserId} registered`);
      await ibTree.increment({ totalCommissions: bonusAmt });
      console.log(`[IB] Referral bonus $${bonusAmt} awarded to user #${referrerId} for new user #${newUserId}`);
    }
  } catch (e) {
    console.error('[IB] awardReferralBonus error:', e.message);
  }
}

export default { awardDepositCommission, awardTradingCommission, awardReferralBonus };
