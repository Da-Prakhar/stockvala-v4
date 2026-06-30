import { MamManager, MamAccount, MamTrade, Mt5Account, User } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import mt5Service from '../services/mt5.service.js';

// ============================================================================
// USER — MAM MANAGERS (public listing)
// ============================================================================

/**
 * List active MAM managers with live MT5 stats
 */
export const getManagers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await MamManager.findAndCountAll({
      where: { isActive: true },
      limit: parseInt(limit), offset,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login', 'accountType'], as: 'account' }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich with live MT5 data
    const enriched = await Promise.all(rows.map(async (manager) => {
      const json = manager.toJSON();
      const mt5Login = json.account?.mt5Login;
      json.investorCount = await MamAccount.count({ where: { managerId: manager.id, status: 'active' } });
      json.totalTrades = await MamTrade.count({ where: { mamManagerId: manager.id } });

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

      // Calculate performance
      const closedTrades = await MamTrade.count({ where: { mamManagerId: manager.id, status: 'closed' } });
      const totalProfit = await MamTrade.sum('profit', { where: { mamManagerId: manager.id, status: 'closed' } }) || 0;

      json.closedTrades = closedTrades;
      json.totalProfit = totalProfit;
      json.avgProfit = closedTrades > 0 ? Math.round(totalProfit / closedTrades * 100) / 100 : 0;

      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'MAM managers retrieved'));
  } catch (error) { next(error); }
};

/**
 * Get MAM manager details with live positions and performance
 */
export const getManagerDetails = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const manager = await MamManager.findByPk(managerId, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login', 'accountType'], as: 'account' }
      ]
    });
    if (!manager) throw new NotFoundError('Manager not found');

    const json = manager.toJSON();
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

      // Live positions
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

      // Deal history for performance stats
      try {
        const dealsRaw = await mt5Service.getDeals(mt5Login);
        const deals = Array.isArray(dealsRaw) ? dealsRaw : (dealsRaw?.deals || []);
        const tradeDeals = deals.filter(d => d.action === 0 || d.action === 1 || d.Action === 0 || d.Action === 1);
        const winningDeals = tradeDeals.filter(d => (d.profit || d.Profit || 0) > 0);
        json.winRate = tradeDeals.length > 0 ? Math.round(winningDeals.length / tradeDeals.length * 100) : 0;
        json.totalDeals = tradeDeals.length;
      } catch (e) {
        json.winRate = 0;
        json.totalDeals = 0;
      }
    }

    // Investor stats
    json.investorCount = await MamAccount.count({ where: { managerId, status: 'active' } });
    json.totalTrades = await MamTrade.count({ where: { mamManagerId: managerId } });
    json.closedTrades = await MamTrade.count({ where: { mamManagerId: managerId, status: 'closed' } });
    json.totalProfit = await MamTrade.sum('profit', { where: { mamManagerId: managerId, status: 'closed' } }) || 0;
    json.totalFees = await MamTrade.sum('fee', { where: { mamManagerId: managerId, status: 'closed' } }) || 0;

    // Recent MAM trades
    json.recentTrades = await MamTrade.findAll({
      where: { mamManagerId: managerId },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json(successResponse(json, 'Manager details retrieved'));
  } catch (error) { next(error); }
};

// ============================================================================
// USER — INVEST / MANAGE
// ============================================================================

export const investInMam = async (req, res, next) => {
  try {
    const { managerId, mt5AccountId, amount, allocationPct = 100 } = req.body;
    const manager = await MamManager.findByPk(managerId);
    if (!manager) throw new NotFoundError('Manager not found');
    if (!manager.isActive) throw new BusinessError('This MAM manager is not active');

    const minInvestment = parseFloat(manager.minInvestment) || 0;
    if (parseFloat(amount) < minInvestment) {
      throw new BusinessError(`Minimum investment is $${minInvestment}`);
    }

    // Get investor's MT5 account — must be explicitly selected, no demo
    if (!mt5AccountId) throw new BusinessError('Please select an MT5 account');
    const investorAccount = await Mt5Account.findOne({ where: { id: mt5AccountId, userId: req.user.id } });
    if (!investorAccount) throw new BusinessError('MT5 account not found or does not belong to you');
    if (investorAccount.accountType === 'demo') throw new BusinessError('Demo accounts cannot be used for MAM investment');

    // Check if already invested
    const existing = await MamAccount.findOne({
      where: { managerId, investorUserId: req.user.id, status: 'active' }
    });
    if (existing) throw new BusinessError('You are already invested in this MAM manager');

    // Verify investor has sufficient balance on MT5
    try {
      const accRaw = await mt5Service.getAccountInfo(investorAccount.mt5Login);
      const accInfo = accRaw?.data || accRaw || {};
      const availableBalance = parseFloat(accInfo.balance) || 0;
      if (availableBalance < parseFloat(amount)) {
        throw new BusinessError(`Insufficient MT5 balance. Available: $${availableBalance.toFixed(2)}`);
      }
    } catch (e) {
      if (e instanceof BusinessError) throw e;
      // If MT5 check fails, allow investment but log warning
      console.warn(`[MAM] Could not verify MT5 balance for user ${req.user.id}:`, e.message);
    }

    const mamAccount = await MamAccount.create({
      managerId,
      investorUserId: req.user.id,
      investorMt5AccountId: investorAccount.id,
      investedAmount: amount,
      allocationPct,
      currentValue: amount,
      status: 'active',
      joinedAt: new Date()
    });

    res.status(201).json(successResponse(mamAccount, 'Successfully invested in MAM'));
  } catch (error) { next(error); }
};

export const getUserMamInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await MamAccount.findAndCountAll({
      where: { investorUserId: req.user.id },
      limit: parseInt(limit), offset,
      include: [
        { model: MamManager, as: 'manager', include: [
          { model: User, attributes: ['firstName', 'lastName'], as: 'user' },
          { model: Mt5Account, attributes: ['mt5Login'], as: 'account' }
        ]}
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich with live data
    const enriched = await Promise.all(rows.map(async (inv) => {
      const json = inv.toJSON();
      // Get live P&L for this investment
      const totalProfit = await MamTrade.sum('profit', { where: { mamAccountId: inv.id, status: 'closed' } }) || 0;
      const totalFees = await MamTrade.sum('fee', { where: { mamAccountId: inv.id, status: 'closed' } }) || 0;
      const openTrades = await MamTrade.count({ where: { mamAccountId: inv.id, status: 'open' } });
      json.totalProfit = totalProfit;
      json.totalFees = totalFees;
      json.openTrades = openTrades;
      json.netProfit = totalProfit - totalFees;
      json.currentValue = parseFloat(inv.investedAmount) + totalProfit - totalFees;
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'MAM investments retrieved'));
  } catch (error) { next(error); }
};

export const updateMamAllocation = async (req, res, next) => {
  try {
    const { mamAccountId } = req.params;
    const { amount, allocationPct } = req.body;
    const mamAccount = await MamAccount.findByPk(mamAccountId);
    if (!mamAccount || mamAccount.investorUserId !== req.user.id) throw new NotFoundError('MAM account not found');
    const updates = {};
    if (amount !== undefined) updates.investedAmount = amount;
    if (allocationPct !== undefined) updates.allocationPct = allocationPct;
    await mamAccount.update(updates);
    res.json(successResponse(mamAccount, 'MAM allocation updated'));
  } catch (error) { next(error); }
};

export const stopMamInvestment = async (req, res, next) => {
  try {
    const { mamAccountId } = req.params;
    const mamAccount = await MamAccount.findByPk(mamAccountId);
    if (!mamAccount || mamAccount.investorUserId !== req.user.id) throw new NotFoundError('MAM account not found');
    await mamAccount.update({ status: 'withdrawn' });
    res.json(successResponse(null, 'MAM investment stopped'));
  } catch (error) { next(error); }
};

export const getMamTrades = async (req, res, next) => {
  try {
    const { mamAccountId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const mamAccount = await MamAccount.findByPk(mamAccountId);
    if (!mamAccount || mamAccount.investorUserId !== req.user.id) throw new NotFoundError('MAM account not found');

    const { count, rows } = await MamTrade.findAndCountAll({
      where: { mamAccountId },
      limit: parseInt(limit), offset,
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'MAM trades retrieved'));
  } catch (error) { next(error); }
};

// ============================================================================
// ADMIN — MAM MANAGEMENT
// ============================================================================

export const adminGetManagers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const { count, rows } = await MamManager.findAndCountAll({
      where, limit: parseInt(limit), offset,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, attributes: ['id', 'mt5Login'], as: 'account' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = await Promise.all(rows.map(async (m) => {
      const json = m.toJSON();
      json.investorCount = await MamAccount.count({ where: { managerId: m.id, status: 'active' } });
      json.totalTrades = await MamTrade.count({ where: { mamManagerId: m.id } });
      json.totalProfit = await MamTrade.sum('profit', { where: { mamManagerId: m.id, status: 'closed' } }) || 0;
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'Admin MAM managers retrieved'));
  } catch (error) { next(error); }
};

export const adminCreateManager = async (req, res, next) => {
  try {
    const { userId, mt5AccountId, name, description, allocationMethod, managementFeePct, performanceFeePct, minInvestment } = req.body;

    if (!userId || !mt5AccountId || !name) {
      throw new BusinessError('userId, mt5AccountId and name are required');
    }

    // Verify user and MT5 account exist
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    const mt5Account = await Mt5Account.findByPk(mt5AccountId);
    if (!mt5Account) throw new NotFoundError('MT5 account not found');

    // Check for existing
    const existing = await MamManager.findOne({ where: { userId } });
    if (existing) throw new BusinessError('This user already has a MAM manager profile');

    const manager = await MamManager.create({
      userId, mt5AccountId, name,
      description: description || '',
      allocationMethod: allocationMethod || 'percent',
      managementFeePct: managementFeePct || 0,
      performanceFeePct: performanceFeePct || 0,
      minInvestment: minInvestment || 1000,
      isActive: true
    });

    res.status(201).json(successResponse(manager, 'MAM manager created'));
  } catch (error) { next(error); }
};

export const adminUpdateManager = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const manager = await MamManager.findByPk(managerId);
    if (!manager) throw new NotFoundError('Manager not found');

    const allowed = ['name', 'description', 'allocationMethod', 'managementFeePct', 'performanceFeePct', 'minInvestment', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await manager.update(updates);
    res.json(successResponse(manager, 'MAM manager updated'));
  } catch (error) { next(error); }
};

export const adminGetMamTrades = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, managerId, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (managerId) where.mamManagerId = managerId;
    if (status) where.status = status;

    const { count, rows } = await MamTrade.findAndCountAll({
      where, limit: parseInt(limit), offset,
      include: [
        { model: MamManager, as: 'manager', include: [{ model: User, attributes: ['firstName', 'lastName'], as: 'user' }] },
        { model: MamAccount, as: 'account', include: [{ model: User, attributes: ['firstName', 'lastName'], as: 'investor' }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'MAM trades retrieved'));
  } catch (error) { next(error); }
};

export const adminGetManagerInvestors = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const investors = await MamAccount.findAll({
      where: { managerId },
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'investor' },
        { model: Mt5Account, attributes: ['id', 'mt5Login'], as: 'investorAccount' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = await Promise.all(investors.map(async (inv) => {
      const json = inv.toJSON();
      json.totalProfit = await MamTrade.sum('profit', { where: { mamAccountId: inv.id, status: 'closed' } }) || 0;
      json.totalFees = await MamTrade.sum('fee', { where: { mamAccountId: inv.id, status: 'closed' } }) || 0;
      json.openTrades = await MamTrade.count({ where: { mamAccountId: inv.id, status: 'open' } });
      return json;
    }));

    res.json(successResponse(enriched, 'Manager investors retrieved'));
  } catch (error) { next(error); }
};
