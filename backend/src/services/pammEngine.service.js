import { PammManager, PammInvestor, PammSettlement, Mt5Account, Wallet, WalletTransaction } from '../models/index.js';
import mt5Service from './mt5.service.js';

/**
 * PAMM (Percentage Allocation Management Module) Engine
 *
 * Unlike MAM, PAMM does NOT replicate trades to investor accounts.
 * Instead:
 *   1. Manager trades on ONE pooled MT5 account
 *   2. At settlement time, calculate total P&L
 *   3. Split profit/loss by each investor's share %
 *   4. Deduct performance/management fees from profits
 *   5. Update investor records with their P&L
 *
 * The engine runs periodic equity snapshots and supports manual settlement triggers.
 */

// Track last known equity for each PAMM pool: { pammManagerId: lastEquity }
const poolEquitySnapshots = {};

const SNAPSHOT_INTERVAL = parseInt(process.env.PAMM_SNAPSHOT_INTERVAL) || 60000; // 1 minute
let snapshotTimer = null;

/**
 * Recalculate share percentages for all investors in a pool
 * Share % = investor's invested amount / total pool invested
 */
export async function recalculateShares(pammManagerId) {
  try {
    const investors = await PammInvestor.findAll({
      where: { pammManagerId, status: 'active' }
    });

    const totalInvested = investors.reduce((sum, inv) => sum + parseFloat(inv.investedAmount || 0), 0);
    if (totalInvested <= 0) return;

    for (const investor of investors) {
      const sharePct = Math.round((parseFloat(investor.investedAmount) / totalInvested) * 10000) / 100;
      await investor.update({ currentSharePct: sharePct });
    }

    // Update pool AUM
    await PammManager.update(
      { totalAum: totalInvested },
      { where: { id: pammManagerId } }
    );

    console.log(`[PAMMEngine] Recalculated shares for pool ${pammManagerId}: ${investors.length} investors, total AUM $${totalInvested}`);
  } catch (error) {
    console.error(`[PAMMEngine] Error recalculating shares for pool ${pammManagerId}:`, error.message);
  }
}

/**
 * Get live equity for a PAMM pool's MT5 account
 */
async function getPoolEquity(manager) {
  try {
    const mt5Account = await Mt5Account.findByPk(manager.mt5AccountId);
    if (!mt5Account?.mt5Login) return null;

    const accRaw = await mt5Service.getAccountInfo(mt5Account.mt5Login);
    const accInfo = accRaw?.data || accRaw || {};
    return {
      equity: parseFloat(accInfo.equity) || 0,
      balance: parseFloat(accInfo.balance) || 0,
      profit: parseFloat(accInfo.profit) || 0,
      mt5Login: mt5Account.mt5Login
    };
  } catch (error) {
    console.error(`[PAMMEngine] Error getting pool equity for manager ${manager.id}:`, error.message);
    return null;
  }
}

/**
 * Run a settlement for a PAMM pool
 * This calculates P&L since the last settlement and distributes to investors
 */
export async function settlePool(pammManagerId) {
  try {
    const manager = await PammManager.findByPk(pammManagerId);
    if (!manager || !manager.isActive) {
      console.log(`[PAMMEngine] Pool ${pammManagerId} not found or inactive`);
      return { success: false, message: 'Pool not found or inactive' };
    }

    // Get current pool equity
    const poolInfo = await getPoolEquity(manager);
    if (!poolInfo) {
      return { success: false, message: 'Could not get pool equity from MT5' };
    }

    // Get last settlement to determine start equity
    const lastSettlement = await PammSettlement.findOne({
      where: { pammManagerId, status: 'completed' },
      order: [['settlementDate', 'DESC']]
    });

    const startEquity = lastSettlement
      ? parseFloat(lastSettlement.endEquity)
      : parseFloat(manager.totalAum) || poolInfo.equity;

    const endEquity = poolInfo.equity;
    const totalPnl = endEquity - startEquity;

    if (Math.abs(totalPnl) < 0.01) {
      console.log(`[PAMMEngine] Pool ${pammManagerId}: no significant P&L to settle ($${totalPnl})`);
      return { success: true, message: 'No significant P&L to settle', totalPnl: 0 };
    }

    // Get active investors
    const investors = await PammInvestor.findAll({
      where: { pammManagerId, status: 'active' }
    });

    if (investors.length === 0) {
      console.log(`[PAMMEngine] Pool ${pammManagerId}: no active investors`);
      return { success: true, message: 'No active investors' };
    }

    // Calculate fees (only on profits)
    const performanceFeePct = parseFloat(manager.performanceFeePct) || 0;
    const managementFeePct = parseFloat(manager.managementFeePct) || 0;

    let performanceFee = 0;
    let managementFee = 0;

    if (totalPnl > 0) {
      performanceFee = Math.round(totalPnl * (performanceFeePct / 100) * 100) / 100;
    }
    // Management fee applies regardless of P&L direction (annual % / 365 * days)
    const daysSinceLastSettlement = lastSettlement
      ? Math.max(1, Math.round((Date.now() - new Date(lastSettlement.settlementDate).getTime()) / 86400000))
      : 1;
    managementFee = Math.round(startEquity * (managementFeePct / 100) * (daysSinceLastSettlement / 365) * 100) / 100;

    const netPnl = totalPnl - performanceFee - managementFee;

    // Distribute P&L to investors and credit their wallets
    const investorDetails = [];
    for (const investor of investors) {
      const sharePct = parseFloat(investor.currentSharePct) || 0;
      if (sharePct <= 0) continue;

      const investorPnl = Math.round(netPnl * (sharePct / 100) * 100) / 100;
      const investorFee = Math.round((performanceFee + managementFee) * (sharePct / 100) * 100) / 100;

      // Update investor record
      const currentProfitLoss = parseFloat(investor.profitLoss) || 0;
      await investor.update({
        profitLoss: currentProfitLoss + investorPnl
      });

      // Credit/debit investor wallet with their P&L share
      if (Math.abs(investorPnl) >= 0.01) {
        try {
          let wallet = await Wallet.findOne({ where: { userId: investor.investorUserId } });
          if (!wallet) {
            wallet = await Wallet.create({ userId: investor.investorUserId, balance: 0 });
          }
          const walletBefore = parseFloat(wallet.balance) || 0;
          const walletAfter = walletBefore + investorPnl;
          await wallet.update({ balance: walletAfter });

          await WalletTransaction.create({
            walletId: wallet.id,
            type: 'pamm_payout',
            amount: investorPnl,
            balanceBefore: walletBefore,
            balanceAfter: walletAfter,
            referenceType: 'pamm_settlement',
            referenceId: null, // Settlement not yet created, will be set after
            description: `PAMM settlement: ${investorPnl >= 0 ? '+' : ''}$${investorPnl.toFixed(2)} (${sharePct}% share of pool ${manager.name || pammManagerId})`
          });
        } catch (walletErr) {
          console.error(`[PAMMEngine] Failed to credit wallet for investor ${investor.investorUserId}:`, walletErr.message);
        }
      }

      investorDetails.push({
        investorId: investor.id,
        investorUserId: investor.investorUserId,
        sharePct,
        pnl: investorPnl,
        fee: investorFee
      });
    }

    // Record settlement
    const settlement = await PammSettlement.create({
      pammManagerId,
      settlementDate: new Date(),
      startEquity,
      endEquity,
      totalPnl,
      performanceFee,
      managementFee,
      netPnl,
      investorCount: investors.length,
      status: 'completed',
      details: investorDetails
    });

    // Update pool AUM
    const totalInvested = investors.reduce((sum, inv) => sum + parseFloat(inv.investedAmount || 0), 0);
    await manager.update({ totalAum: totalInvested });

    console.log(`[PAMMEngine] Settlement completed for pool ${pammManagerId}: P&L $${totalPnl}, net $${netPnl}, ${investors.length} investors`);

    return {
      success: true,
      settlement: {
        id: settlement.id,
        totalPnl,
        performanceFee,
        managementFee,
        netPnl,
        investorCount: investors.length
      }
    };
  } catch (error) {
    console.error(`[PAMMEngine] Settlement error for pool ${pammManagerId}:`, error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Periodic equity snapshot — used for tracking and triggering auto-settlement
 */
let snapshotCount = 0;
async function takeSnapshots() {
  try {
    const pools = await PammManager.findAll({ where: { isActive: true } });

    snapshotCount++;
    if (snapshotCount % 10 === 1) {
      console.log(`[PAMMEngine] Snapshot #${snapshotCount}: ${pools.length} active pools`);
    }

    for (const pool of pools) {
      const poolInfo = await getPoolEquity(pool);
      if (!poolInfo) continue;

      // Store snapshot
      poolEquitySnapshots[pool.id] = {
        equity: poolInfo.equity,
        balance: poolInfo.balance,
        timestamp: Date.now()
      };

      // Update AUM in DB periodically
      if (snapshotCount % 10 === 0) {
        const totalInvested = await PammInvestor.sum('investedAmount', {
          where: { pammManagerId: pool.id, status: 'active' }
        }) || 0;
        await pool.update({ totalAum: totalInvested });
      }
    }
  } catch (error) {
    console.error('[PAMMEngine] Snapshot error:', error.message);
  }
}

/**
 * Get live pool stats (called by API controllers)
 */
export async function getPoolLiveStats(pammManagerId) {
  const manager = await PammManager.findByPk(pammManagerId);
  if (!manager) return null;

  const poolInfo = await getPoolEquity(manager);
  const investors = await PammInvestor.findAll({
    where: { pammManagerId, status: 'active' }
  });

  const totalInvested = investors.reduce((sum, inv) => sum + parseFloat(inv.investedAmount || 0), 0);
  const totalProfitLoss = investors.reduce((sum, inv) => sum + parseFloat(inv.profitLoss || 0), 0);

  const lastSettlement = await PammSettlement.findOne({
    where: { pammManagerId, status: 'completed' },
    order: [['settlementDate', 'DESC']]
  });

  const settlementCount = await PammSettlement.count({
    where: { pammManagerId, status: 'completed' }
  });

  return {
    poolEquity: poolInfo?.equity || 0,
    poolBalance: poolInfo?.balance || 0,
    unrealizedPnl: poolInfo?.profit || 0,
    totalAum: totalInvested,
    investorCount: investors.length,
    totalDistributedPnl: totalProfitLoss,
    lastSettlement: lastSettlement?.settlementDate || null,
    settlementCount,
    mt5Login: poolInfo?.mt5Login || null
  };
}

/**
 * Start the PAMM engine (equity snapshots)
 */
export async function startPammEngine() {
  if (snapshotTimer) {
    console.log('[PAMMEngine] Already running');
    return;
  }
  console.log(`[PAMMEngine] Starting PAMM engine (snapshots every ${SNAPSHOT_INTERVAL / 1000}s)`);

  // Initial share recalculation for all pools
  const pools = await PammManager.findAll({ where: { isActive: true } });
  for (const pool of pools) {
    await recalculateShares(pool.id);
  }

  snapshotTimer = setInterval(takeSnapshots, SNAPSHOT_INTERVAL);
}

/**
 * Stop the PAMM engine
 */
export function stopPammEngine() {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
    console.log('[PAMMEngine] Stopped');
  }
}

export default { startPammEngine, stopPammEngine, settlePool, recalculateShares, getPoolLiveStats };
