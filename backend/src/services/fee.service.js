/**
 * Fee Service — handles all broker commission calculations
 * for Copy Trading, MAM, and PAMM.
 *
 * ─── How fees work ────────────────────────────────────────────
 *
 * PERFORMANCE FEE (Copy Trading / MAM / PAMM):
 *   Charged when a trade closes with profit.
 *   feeAmount      = grossProfit × performanceFeePct / 100
 *   platformAmount = feeAmount   × platformFeeSplitPct / 100  ← broker's revenue
 *   masterAmount   = feeAmount   - platformAmount             ← manager's revenue
 *
 * MANAGEMENT FEE (Copy Trading / MAM / PAMM):
 *   Charged monthly on allocation / AUM regardless of profit.
 *   feeAmount = allocationAmount × managementFeePct / 100 / 12  ← pro-rated monthly
 *   platformAmount = feeAmount (management fee is 100% broker revenue)
 *   masterAmount   = 0
 *
 * ─── Who controls what ────────────────────────────────────────
 *
 *   Admin sets per-master:
 *     performanceFeePct    — % of profit charged as performance fee
 *     managementFee        — annual % charged monthly (or fixed amount)
 *     platformFeeSplitPct  — % of the fee the broker keeps (rest to master)
 *
 *   Global broker defaults (BrokerSetting keys):
 *     copy_platform_fee_split_default   → default platformFeeSplitPct for copy trading
 *     mam_platform_fee_split_default    → default for MAM
 *     pamm_platform_fee_split_default   → default for PAMM
 */

import {
  FeeTransaction, CopyTrade, CopyTradeFollower, CopyTradeMaster,
  MamAccount, MamManager, PammInvestor, PammManager,
  User, BrokerSetting
} from '../models/index.js';
import { Op } from 'sequelize';

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

/**
 * Split feeAmount between platform and master.
 * @param {number} feeAmount
 * @param {number} platformSplitPct  — e.g. 30 means 30% to platform
 */
function splitFee(feeAmount, platformSplitPct) {
  const platformAmount = round2(feeAmount * (parseFloat(platformSplitPct) || 30) / 100);
  const masterAmount   = round2(feeAmount - platformAmount);
  return { platformAmount, masterAmount };
}

// ─── Performance Fee ─────────────────────────────────────────────────────────

/**
 * Calculate and record a performance fee for a closed copy trade.
 * Call this when a copy trade closes with profit > 0.
 *
 * @param {object} opts
 * @param {number} opts.copyTradeId    — CopyTrade.id
 * @param {number} opts.followerId     — CopyTradeFollower.id
 * @param {number} opts.masterId       — CopyTradeMaster.id
 * @param {number} opts.userId         — follower's User.id
 * @param {number} opts.grossProfit    — net profit on this trade
 * @returns {FeeTransaction|null}
 */
export async function chargePerformanceFee({ copyTradeId, followerId, masterId, userId, grossProfit }) {
  if (!grossProfit || grossProfit <= 0) return null; // no profit → no fee

  const master = await CopyTradeMaster.findByPk(masterId);
  if (!master) return null;

  const feePct   = parseFloat(master.performanceFeePct) || 0;
  if (feePct <= 0) return null;

  const splitPct = parseFloat(master.platformFeeSplitPct) ?? 30;
  const feeAmount = round2(grossProfit * feePct / 100);
  const { platformAmount, masterAmount } = splitFee(feeAmount, splitPct);

  return FeeTransaction.create({
    product:          'copy_trade',
    feeType:          'performance_fee',
    entityId:         masterId,
    subscriberId:     followerId,
    userId,
    referenceId:      copyTradeId,
    grossProfit:      round2(grossProfit),
    feeAmount,
    platformAmount,
    masterAmount,
    feeRate:          feePct,
    platformSplitPct: splitPct,
    status:           'settled',
    notes:            `Performance fee on copy trade #${copyTradeId}`,
    settledAt:        new Date()
  });
}

/**
 * Calculate and record a performance fee for MAM.
 */
export async function chargeMamPerformanceFee({ mamAccountId, managerId, userId, grossProfit, referenceId }) {
  if (!grossProfit || grossProfit <= 0) return null;

  const manager = await MamManager.findByPk(managerId);
  if (!manager) return null;

  const feePct   = parseFloat(manager.performanceFeePct) || 0;
  if (feePct <= 0) return null;

  const splitPct  = parseFloat(manager.platformFeeSplitPct) ?? 30;
  const feeAmount = round2(grossProfit * feePct / 100);
  const { platformAmount, masterAmount } = splitFee(feeAmount, splitPct);

  return FeeTransaction.create({
    product: 'mam', feeType: 'performance_fee',
    entityId: managerId, subscriberId: mamAccountId, userId,
    referenceId, grossProfit: round2(grossProfit),
    feeAmount, platformAmount, masterAmount,
    feeRate: feePct, platformSplitPct: splitPct,
    status: 'settled', settledAt: new Date(),
    notes: `MAM performance fee — manager #${managerId}`
  });
}

/**
 * Calculate and record a performance fee for PAMM.
 */
export async function chargePammPerformanceFee({ pammInvestorId, managerId, userId, grossProfit, referenceId }) {
  if (!grossProfit || grossProfit <= 0) return null;

  const pool = await PammManager.findByPk(managerId);
  if (!pool) return null;

  const feePct   = parseFloat(pool.performanceFeePct) || 0;
  if (feePct <= 0) return null;

  const splitPct  = parseFloat(pool.platformFeeSplitPct) ?? 30;
  const feeAmount = round2(grossProfit * feePct / 100);
  const { platformAmount, masterAmount } = splitFee(feeAmount, splitPct);

  return FeeTransaction.create({
    product: 'pamm', feeType: 'performance_fee',
    entityId: managerId, subscriberId: pammInvestorId, userId,
    referenceId, grossProfit: round2(grossProfit),
    feeAmount, platformAmount, masterAmount,
    feeRate: feePct, platformSplitPct: splitPct,
    status: 'settled', settledAt: new Date(),
    notes: `PAMM performance fee — pool #${managerId}`
  });
}

// ─── Management Fee ──────────────────────────────────────────────────────────

/**
 * Run monthly management fee settlement for all active copy trade followers.
 * Typically called by a scheduled job on the 1st of each month.
 * Returns array of created FeeTransaction records.
 */
export async function settleMonthlyManagementFees() {
  const results = [];

  // ── Copy Trading ──
  const activeFollowers = await CopyTradeFollower.findAll({
    where: { status: 'active' },
    include: [
      { model: CopyTradeMaster, as: 'master', attributes: ['id', 'managementFee', 'platformFeeSplitPct'] }
    ]
  });

  for (const follower of activeFollowers) {
    const master   = follower.master;
    if (!master) continue;

    const mgmtPct = parseFloat(master.managementFee) || 0; // annual %
    if (mgmtPct <= 0) continue;

    const alloc   = parseFloat(follower.allocationAmount) || 0;
    // Monthly = annual% / 12
    const feeAmount = round2(alloc * mgmtPct / 100 / 12);
    if (feeAmount <= 0) continue;

    // Management fee is 100% platform revenue (no master split)
    try {
      const tx = await FeeTransaction.create({
        product: 'copy_trade', feeType: 'management_fee',
        entityId: master.id, subscriberId: follower.id,
        userId: follower.followerUserId,
        feeAmount, platformAmount: feeAmount, masterAmount: 0,
        feeRate: mgmtPct, platformSplitPct: 100,
        status: 'settled', settledAt: new Date(),
        notes: `Monthly management fee — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`
      });
      results.push(tx);
    } catch (e) {
      console.error('[FeeService] Management fee error (copy):', e.message);
    }
  }

  // ── MAM ──
  const mamAccounts = await MamAccount.findAll({
    where: { status: 'active' },
    include: [{ model: MamManager, as: 'manager', attributes: ['id', 'managementFeePct', 'platformFeeSplitPct'] }]
  });

  for (const acc of mamAccounts) {
    const mgr    = acc.manager;
    if (!mgr) continue;
    const mgmtPct = parseFloat(mgr.managementFeePct) || 0;
    if (mgmtPct <= 0) continue;

    const alloc   = parseFloat(acc.investedAmount) || 0;
    const feeAmount = round2(alloc * mgmtPct / 100 / 12);
    if (feeAmount <= 0) continue;

    try {
      const tx = await FeeTransaction.create({
        product: 'mam', feeType: 'management_fee',
        entityId: mgr.id, subscriberId: acc.id,
        userId: acc.investorUserId,
        feeAmount, platformAmount: feeAmount, masterAmount: 0,
        feeRate: mgmtPct, platformSplitPct: 100,
        status: 'settled', settledAt: new Date(),
        notes: `MAM monthly mgmt fee`
      });
      results.push(tx);
    } catch (e) {
      console.error('[FeeService] Management fee error (mam):', e.message);
    }
  }

  // ── PAMM ──
  const pammInvestors = await PammInvestor.findAll({
    where: { status: 'active' },
    include: [{ model: PammManager, as: 'manager', attributes: ['id', 'managementFeePct', 'platformFeeSplitPct'] }]
  });

  for (const inv of pammInvestors) {
    const pool   = inv.manager;
    if (!pool) continue;
    const mgmtPct = parseFloat(pool.managementFeePct) || 0;
    if (mgmtPct <= 0) continue;

    const alloc   = parseFloat(inv.investedAmount) || 0;
    const feeAmount = round2(alloc * mgmtPct / 100 / 12);
    if (feeAmount <= 0) continue;

    try {
      const tx = await FeeTransaction.create({
        product: 'pamm', feeType: 'management_fee',
        entityId: pool.id, subscriberId: inv.id,
        userId: inv.investorUserId,
        feeAmount, platformAmount: feeAmount, masterAmount: 0,
        feeRate: mgmtPct, platformSplitPct: 100,
        status: 'settled', settledAt: new Date(),
        notes: `PAMM monthly mgmt fee`
      });
      results.push(tx);
    } catch (e) {
      console.error('[FeeService] Management fee error (pamm):', e.message);
    }
  }

  console.log(`[FeeService] Monthly settlement: ${results.length} fee transactions created`);
  return results;
}

// ─── Reporting ───────────────────────────────────────────────────────────────

/**
 * Get fee summary stats for admin dashboard.
 */
export async function getFeeSummary({ from, to, product } = {}) {
  const where = { status: 'settled' };
  if (product) where.product = product;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to)   where.createdAt[Op.lte] = new Date(to);
  }

  const rows = await FeeTransaction.findAll({ where });

  const summary = {
    totalFeeAmount:      0,
    totalPlatformAmount: 0,
    totalMasterAmount:   0,
    byProduct: { copy_trade: { feeAmount: 0, platformAmount: 0, masterAmount: 0, count: 0 },
                 mam:        { feeAmount: 0, platformAmount: 0, masterAmount: 0, count: 0 },
                 pamm:       { feeAmount: 0, platformAmount: 0, masterAmount: 0, count: 0 } },
    byType:    { performance_fee: { feeAmount: 0, platformAmount: 0, count: 0 },
                 management_fee:  { feeAmount: 0, platformAmount: 0, count: 0 } },
    count: rows.length
  };

  for (const r of rows) {
    const fa = parseFloat(r.feeAmount)      || 0;
    const pa = parseFloat(r.platformAmount) || 0;
    const ma = parseFloat(r.masterAmount)   || 0;
    summary.totalFeeAmount      += fa;
    summary.totalPlatformAmount += pa;
    summary.totalMasterAmount   += ma;
    summary.byProduct[r.product].feeAmount      += fa;
    summary.byProduct[r.product].platformAmount += pa;
    summary.byProduct[r.product].masterAmount   += ma;
    summary.byProduct[r.product].count++;
    summary.byType[r.feeType].feeAmount      += fa;
    summary.byType[r.feeType].platformAmount += pa;
    summary.byType[r.feeType].count++;
  }

  // Round all numbers
  const round = (obj) => {
    for (const k in obj) {
      if (typeof obj[k] === 'number') obj[k] = round2(obj[k]);
      else if (typeof obj[k] === 'object') round(obj[k]);
    }
  };
  round(summary);
  return summary;
}

export default {
  chargePerformanceFee,
  chargeMamPerformanceFee,
  chargePammPerformanceFee,
  settleMonthlyManagementFees,
  getFeeSummary,
};
