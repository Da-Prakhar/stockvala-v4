import { PammManager, PammInvestor, PammSettlement, Mt5Account, User, Wallet, WalletTransaction } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import mt5Service from '../services/mt5.service.js';
import { getPoolLiveStats, recalculateShares, settlePool } from '../services/pammEngine.service.js';

/**
 * Helper: get or create wallet for a user
 */
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0 });
  }
  return wallet;
}

// ============================================================================
// USER — PAMM POOLS (public listing)
// ============================================================================

/**
 * List active PAMM pools with live MT5 stats
 */
export const getPools = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await PammManager.findAndCountAll({
      where: { isActive: true },
      limit: parseInt(limit), offset,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login', 'accountType'], as: 'account' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = await Promise.all(rows.map(async (pool) => {
      const json = pool.toJSON();
      const mt5Login = json.account?.mt5Login;

      json.investorCount = await PammInvestor.count({ where: { pammManagerId: pool.id, status: 'active' } });
      json.settlementCount = await PammSettlement.count({ where: { pammManagerId: pool.id, status: 'completed' } });

      if (mt5Login) {
        try {
          const accRaw = await mt5Service.getAccountInfo(mt5Login);
          const accInfo = accRaw?.data || accRaw || {};
          json.liveEquity = accInfo.equity || 0;
          json.liveBalance = accInfo.balance || 0;
          json.liveProfit = accInfo.profit || 0;
        } catch (e) {
          json.liveEquity = 0;
          json.liveBalance = 0;
          json.liveProfit = 0;
        }
      }

      // Calculate total distributed P&L
      const totalDistributed = await PammSettlement.sum('netPnl', {
        where: { pammManagerId: pool.id, status: 'completed' }
      }) || 0;
      json.totalDistributedPnl = totalDistributed;

      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'PAMM pools retrieved'));
  } catch (error) { next(error); }
};

/**
 * Get PAMM pool details with live data
 */
export const getPoolDetails = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const pool = await PammManager.findByPk(poolId, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login', 'accountType'], as: 'account' }
      ]
    });
    if (!pool) throw new NotFoundError('Pool not found');

    const json = pool.toJSON();
    const mt5Login = json.account?.mt5Login;

    // Live MT5 data
    if (mt5Login) {
      try {
        const accRaw = await mt5Service.getAccountInfo(mt5Login);
        const accInfo = accRaw?.data || accRaw || {};
        json.liveEquity = accInfo.equity || 0;
        json.liveBalance = accInfo.balance || 0;
        json.liveProfit = accInfo.profit || 0;
        json.freeMargin = accInfo.margin_free || accInfo.freeMargin || 0;
      } catch (e) { /* defaults */ }

      // Live positions (manager's trades in the pool account)
      try {
        const posResponse = await mt5Service.getOpenPositions(mt5Login);
        const positions = Array.isArray(posResponse) ? posResponse : (posResponse?.positions || []);
        json.livePositions = positions.map(p => {
          let tradeType = 'unknown';
          if (typeof p.type === 'string') tradeType = p.type.toLowerCase();
          else if (p.type === 0) tradeType = 'buy';
          else if (p.type === 1) tradeType = 'sell';
          return {
            ticket: p.ticket,
            symbol: (p.symbol || '').replace(/\.#$/, ''),
            type: tradeType,
            volume: p.volume,
            openPrice: p.price_open || p.openPrice,
            currentPrice: p.price_current || p.currentPrice,
            profit: p.profit,
            openTime: p.time_create || p.openTime
          };
        });
        json.openPositionCount = positions.length;
      } catch (e) {
        json.livePositions = [];
        json.openPositionCount = 0;
      }
    }

    // Investor stats
    json.investorCount = await PammInvestor.count({ where: { pammManagerId: poolId, status: 'active' } });
    const totalInvested = await PammInvestor.sum('investedAmount', { where: { pammManagerId: poolId, status: 'active' } }) || 0;
    json.totalAum = totalInvested;

    // Settlement history
    json.settlements = await PammSettlement.findAll({
      where: { pammManagerId: poolId },
      order: [['settlementDate', 'DESC']],
      limit: 20
    });
    json.settlementCount = await PammSettlement.count({ where: { pammManagerId: poolId, status: 'completed' } });
    json.totalDistributedPnl = await PammSettlement.sum('netPnl', { where: { pammManagerId: poolId, status: 'completed' } }) || 0;
    json.totalFees = (await PammSettlement.sum('performanceFee', { where: { pammManagerId: poolId, status: 'completed' } }) || 0) +
                     (await PammSettlement.sum('managementFee', { where: { pammManagerId: poolId, status: 'completed' } }) || 0);

    res.json(successResponse(json, 'Pool details retrieved'));
  } catch (error) { next(error); }
};

// ============================================================================
// USER — INVEST / MANAGE
// ============================================================================

export const investInPamm = async (req, res, next) => {
  try {
    const { poolId, amount } = req.body;
    const investAmount = parseFloat(amount);
    const pool = await PammManager.findByPk(poolId);
    if (!pool) throw new NotFoundError('Pool not found');
    if (!pool.isActive) throw new BusinessError('This PAMM pool is not active');

    const minInvestment = parseFloat(pool.minInvestment) || 0;
    if (isNaN(investAmount) || investAmount < minInvestment) {
      throw new BusinessError(`Minimum investment is $${minInvestment}`);
    }

    // PAMM doesn't need an MT5 account — investor just buys a share of the pool.
    // The manager trades on one pooled MT5 account; P&L is distributed at settlement.

    // Check if already invested
    const existing = await PammInvestor.findOne({
      where: { pammManagerId: poolId, investorUserId: req.user.id, status: 'active' }
    });
    if (existing) throw new BusinessError('You are already invested in this PAMM pool');

    // Deduct from wallet
    const wallet = await getOrCreateWallet(req.user.id);
    const walletBalance = parseFloat(wallet.balance) || 0;
    if (walletBalance < investAmount) {
      throw new BusinessError(`Insufficient wallet balance. Available: $${walletBalance.toFixed(2)}, Required: $${investAmount.toFixed(2)}`);
    }

    const balanceBefore = walletBalance;
    const balanceAfter = walletBalance - investAmount;
    await wallet.update({ balance: balanceAfter });

    // Record wallet transaction
    await WalletTransaction.create({
      walletId: wallet.id,
      type: 'pamm_invest',
      amount: -investAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'pamm_pool',
      referenceId: poolId,
      description: `Invested $${investAmount.toFixed(2)} in PAMM pool: ${pool.name}`
    });

    const pammInvestor = await PammInvestor.create({
      pammManagerId: poolId,
      investorUserId: req.user.id,
      investedAmount: investAmount,
      currentSharePct: 0, // Recalculated below
      profitLoss: 0,
      status: 'active',
      joinedAt: new Date()
    });

    // Recalculate shares for all investors in this pool
    await recalculateShares(poolId);

    // Reload to get updated share %
    await pammInvestor.reload();

    res.status(201).json(successResponse({
      ...pammInvestor.toJSON(),
      walletBalance: balanceAfter
    }, 'Successfully invested in PAMM pool. Funds deducted from your wallet.'));
  } catch (error) { next(error); }
};

export const getUserPammInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await PammInvestor.findAndCountAll({
      where: { investorUserId: req.user.id },
      limit: parseInt(limit), offset,
      include: [
        { model: PammManager, as: 'manager', include: [
          { model: User, attributes: ['firstName', 'lastName'], as: 'user' },
          { model: Mt5Account, attributes: ['mt5Login'], as: 'account' }
        ]}
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich with live pool data
    const enriched = await Promise.all(rows.map(async (inv) => {
      const json = inv.toJSON();
      const mt5Login = json.manager?.account?.mt5Login;
      const poolAum = parseFloat(json.manager?.totalAum) || 0;
      let poolEquity = 0;

      if (mt5Login) {
        try {
          const accRaw = await mt5Service.getAccountInfo(mt5Login);
          const accInfo = accRaw?.data || accRaw || {};
          poolEquity = parseFloat(accInfo.equity) || 0;
        } catch (e) { poolEquity = 0; }
      }
      json.poolEquity = poolEquity;

      // Estimate current value:
      // The MT5 account may contain the manager's own capital + investor capital.
      // Pool AUM = total invested by all investors.
      // Unrealized PnL for pool = poolEquity - (manager's own capital + poolAum)
      // Since we don't track manager's capital separately, we estimate:
      //   managerCapital = poolEquity at creation minus poolAum (approximation)
      // Simpler & safer approach: investor's estimated value = invested + settled profitLoss
      //   + their share of unrealized gains since last settlement.
      // For now, use: investedAmount + profitLoss (settled) + share of (equity change above AUM baseline)
      const invested = parseFloat(inv.investedAmount) || 0;
      const settledPnl = parseFloat(inv.profitLoss) || 0;
      const sharePct = parseFloat(inv.currentSharePct) || 0;

      // Unrealized pool P&L = current equity - (manager baseline + pool AUM)
      // We approximate manager baseline as poolEquity - poolAum when equity > AUM
      // If poolAum > 0 and poolEquity > 0, unrealized P&L for pool = equity change relative to total deposits
      // Since PAMM deposits go to wallet (not MT5), the MT5 equity IS the manager's trading capital.
      // Investor money stays in wallet until settlement. So estimated value = invested + settled P&L.
      json.estimatedValue = Math.round((invested + settledPnl) * 100) / 100;
      json.netReturn = settledPnl;
      json.returnPct = invested > 0
        ? Math.round((settledPnl / invested) * 10000) / 100
        : 0;
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'PAMM investments retrieved'));
  } catch (error) { next(error); }
};

export const updatePammAllocation = async (req, res, next) => {
  try {
    const { pammInvestorId } = req.params;
    const { investedAmount } = req.body;
    const pammInvestor = await PammInvestor.findByPk(pammInvestorId);
    if (!pammInvestor || pammInvestor.investorUserId !== req.user.id) throw new NotFoundError('PAMM investment not found');
    await pammInvestor.update({ investedAmount });
    // Recalculate shares
    await recalculateShares(pammInvestor.pammManagerId);
    await pammInvestor.reload();
    res.json(successResponse(pammInvestor, 'PAMM allocation updated'));
  } catch (error) { next(error); }
};

export const stopPammInvestment = async (req, res, next) => {
  try {
    const { pammInvestorId } = req.params;
    const pammInvestor = await PammInvestor.findByPk(pammInvestorId);
    if (!pammInvestor || pammInvestor.investorUserId !== req.user.id) throw new NotFoundError('PAMM investment not found');
    if (pammInvestor.status !== 'active') throw new BusinessError('This investment is not active');

    const pool = await PammManager.findByPk(pammInvestor.pammManagerId);

    // Calculate refund: invested amount + accumulated profit/loss
    const investedAmount = parseFloat(pammInvestor.investedAmount) || 0;
    const profitLoss = parseFloat(pammInvestor.profitLoss) || 0;
    const refundAmount = Math.max(0, investedAmount + profitLoss); // Can't go negative

    // Credit back to wallet
    const wallet = await getOrCreateWallet(req.user.id);
    const balanceBefore = parseFloat(wallet.balance) || 0;
    const balanceAfter = balanceBefore + refundAmount;
    await wallet.update({ balance: balanceAfter });

    // Record wallet transaction
    await WalletTransaction.create({
      walletId: wallet.id,
      type: 'pamm_refund',
      amount: refundAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'pamm_investor',
      referenceId: pammInvestor.id,
      description: `PAMM withdrawal: $${investedAmount.toFixed(2)} invested + $${profitLoss.toFixed(2)} P&L from pool: ${pool?.name || pammInvestor.pammManagerId}`
    });

    await pammInvestor.update({ status: 'withdrawn' });
    // Recalculate shares for remaining investors
    await recalculateShares(pammInvestor.pammManagerId);

    res.json(successResponse({
      refundAmount,
      investedAmount,
      profitLoss,
      walletBalance: balanceAfter
    }, `PAMM investment stopped. $${refundAmount.toFixed(2)} returned to your wallet.`));
  } catch (error) { next(error); }
};

// ============================================================================
// ADMIN — PAMM MANAGEMENT
// ============================================================================

export const adminGetPools = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const { count, rows } = await PammManager.findAndCountAll({
      where, limit: parseInt(limit), offset,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login'], as: 'account' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = await Promise.all(rows.map(async (pool) => {
      const json = pool.toJSON();
      json.investorCount = await PammInvestor.count({ where: { pammManagerId: pool.id, status: 'active' } });
      json.settlementCount = await PammSettlement.count({ where: { pammManagerId: pool.id, status: 'completed' } });
      const totalInvested = await PammInvestor.sum('investedAmount', { where: { pammManagerId: pool.id, status: 'active' } }) || 0;
      json.totalAum = totalInvested;
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'Admin PAMM pools retrieved'));
  } catch (error) { next(error); }
};

export const adminCreatePool = async (req, res, next) => {
  try {
    const { userId, mt5AccountId, name, description, performanceFeePct, managementFeePct, minInvestment } = req.body;
    if (!userId || !mt5AccountId || !name) throw new BusinessError('userId, mt5AccountId and name are required');

    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    const mt5Account = await Mt5Account.findByPk(mt5AccountId);
    if (!mt5Account) throw new NotFoundError('MT5 account not found');

    const existing = await PammManager.findOne({ where: { userId } });
    if (existing) throw new BusinessError('This user already has a PAMM pool');

    const pool = await PammManager.create({
      userId, mt5AccountId, name,
      description: description || '',
      performanceFeePct: performanceFeePct || 0,
      managementFeePct: managementFeePct || 0,
      minInvestment: minInvestment || 1000,
      isActive: true, totalAum: 0
    });

    res.status(201).json(successResponse(pool, 'PAMM pool created'));
  } catch (error) { next(error); }
};

export const adminUpdatePool = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const pool = await PammManager.findByPk(poolId);
    if (!pool) throw new NotFoundError('Pool not found');

    const allowed = ['name', 'description', 'performanceFeePct', 'managementFeePct', 'minInvestment', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await pool.update(updates);
    res.json(successResponse(pool, 'PAMM pool updated'));
  } catch (error) { next(error); }
};

export const adminTriggerSettlement = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const result = await settlePool(parseInt(poolId));
    if (!result.success) throw new BusinessError(result.message);
    res.json(successResponse(result.settlement, 'Settlement completed'));
  } catch (error) { next(error); }
};

export const adminGetSettlements = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, poolId } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (poolId) where.pammManagerId = poolId;

    const { count, rows } = await PammSettlement.findAndCountAll({
      where, limit: parseInt(limit), offset,
      include: [{ model: PammManager, as: 'pool', include: [{ model: User, attributes: ['firstName', 'lastName'], as: 'user' }] }],
      order: [['settlementDate', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Settlements retrieved'));
  } catch (error) { next(error); }
};

export const adminGetPoolInvestors = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const investors = await PammInvestor.findAll({
      where: { pammManagerId: poolId },
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'investor' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(successResponse(investors, 'Pool investors retrieved'));
  } catch (error) { next(error); }
};
