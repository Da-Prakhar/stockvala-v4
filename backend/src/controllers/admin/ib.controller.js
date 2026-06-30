import { IbLevel, IbTree, IbCommission, User, Trade, Mt5Account } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { Sequelize, Op } from 'sequelize';
import { awardTradingCommission, awardDepositCommission } from '../../services/ibCommission.service.js';
import { getDealHistory } from '../../services/mt5.service.js';

// ─── COMMISSION LEVELS ────────────────────────────────────────────────────────

export const getLevels = async (req, res, next) => {
  try {
    const levels = await IbLevel.findAll({ order: [['level', 'ASC']] });
    res.json(successResponse(levels, 'IB levels retrieved'));
  } catch (error) { next(error); }
};

export const createLevel = async (req, res, next) => {
  try {
    const {
      level, depositCommissionPercent = 0, tradingCommissionPercent = 0,
      referralBonusPercent = 0, minReferralsRequired = 0,
      minMonthlyDeposits = null, bonusAmount = null, description = '',
      commissionMode = 'percentage', perLotCommission = 0
    } = req.body;

    if (!level) throw new BusinessError('Level number is required');

    const existing = await IbLevel.findOne({ where: { level } });
    if (existing) throw new BusinessError(`Level ${level} already exists`);

    const ibLevel = await IbLevel.create({
      level, depositCommissionPercent, tradingCommissionPercent,
      referralBonusPercent, minReferralsRequired,
      minMonthlyDeposits, bonusAmount, description, isActive: true,
      commissionMode, perLotCommission
    });

    res.status(201).json(successResponse(ibLevel, 'IB level created'));
  } catch (error) { next(error); }
};

export const updateLevel = async (req, res, next) => {
  try {
    const { levelId } = req.params;
    const ibLevel = await IbLevel.findByPk(levelId);
    if (!ibLevel) throw new NotFoundError('IB level not found');

    const allowed = [
      'depositCommissionPercent', 'tradingCommissionPercent', 'referralBonusPercent',
      'minReferralsRequired', 'minMonthlyDeposits', 'bonusAmount', 'description', 'isActive',
      'commissionMode', 'perLotCommission'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await ibLevel.update(updates);
    res.json(successResponse(ibLevel, 'IB level updated'));
  } catch (error) { next(error); }
};

export const deleteLevel = async (req, res, next) => {
  try {
    const { levelId } = req.params;
    const ibLevel = await IbLevel.findByPk(levelId);
    if (!ibLevel) throw new NotFoundError('IB level not found');
    await ibLevel.destroy();
    res.json(successResponse(null, 'IB level deleted'));
  } catch (error) { next(error); }
};

// ─── IB NETWORK ──────────────────────────────────────────────────────────────

export const getNetwork = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const userWhere = {};
    if (search) {
      userWhere[Sequelize.Op.or] = [
        { firstName: { [Sequelize.Op.like]: `%${search}%` } },
        { lastName: { [Sequelize.Op.like]: `%${search}%` } },
        { email: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await IbTree.findAndCountAll({
      limit: parseInt(limit),
      offset,
      order: [['totalCommissions', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'status'], where: userWhere }
      ]
    });

    // Enrich with live referral count from users table
    const enriched = await Promise.all(rows.map(async (tree) => {
      const json = tree.toJSON();
      const referralCount = await User.count({ where: { referredBy: tree.userId } });
      json.liveReferralCount = referralCount;
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'IB network retrieved'));
  } catch (error) { next(error); }
};

// ─── COMMISSION HISTORY ───────────────────────────────────────────────────────

export const getCommissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, type } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (type) where.commissionType = type;

    const { count, rows } = await IbCommission.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: IbTree,
          attributes: ['id', 'ibCode'],
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
        },
        {
          model: User,
          as: 'referredUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Commissions retrieved'));
  } catch (error) { next(error); }
};

export const updateCommissionStatus = async (req, res, next) => {
  try {
    const { commissionId } = req.params;
    const { status, notes } = req.body;

    const commission = await IbCommission.findByPk(commissionId);
    if (!commission) throw new NotFoundError('Commission not found');

    const updates = { status };
    if (notes) updates.notes = notes;
    if (status === 'paid') updates.paidAt = new Date();

    await commission.update(updates);

    // Update IB tree total if paid
    if (status === 'paid') {
      const total = await IbCommission.sum('commissionAmount', {
        where: { ibTreeId: commission.ibTreeId, status: 'paid' }
      });
      await IbTree.update({ totalCommissions: total || 0 }, { where: { id: commission.ibTreeId } });
    }

    res.json(successResponse(commission, 'Commission status updated'));
  } catch (error) { next(error); }
};

// ─── STATS ────────────────────────────────────────────────────────────────────

export const getStats = async (req, res, next) => {
  try {
    const totalIBs = await IbTree.count();
    const activeIBs = await IbTree.count({ where: { status: 'active' } });
    const totalPending = await IbCommission.sum('commissionAmount', { where: { status: 'pending' } }) || 0;
    const totalPaid = await IbCommission.sum('commissionAmount', { where: { status: 'paid' } }) || 0;
    const totalCommissions = await IbCommission.count();

    res.json(successResponse({ totalIBs, activeIBs, totalPending, totalPaid, totalCommissions }, 'IB stats retrieved'));
  } catch (error) { next(error); }
};

// ─── RECALCULATE / BACKFILL COMMISSIONS ──────────────────────────────────────

/**
 * POST /api/admin/ib/recalculate
 *
 * Scans closed DB trades + MT5 deal history for referred users and
 * awards any missing commissions. Safe to run multiple times — the
 * service layer deduplicates by (ibTreeId, relatedId, relatedType).
 *
 * Body (all optional):
 *   userId   – restrict to one referred user
 *   fromDate – ISO date string, e.g. "2025-01-01"
 *   toDate   – ISO date string
 *   dryRun   – true = report what would be awarded without writing anything
 *   source   – "db" (default) | "mt5" | "both"
 */
export const recalculateCommissions = async (req, res, next) => {
  try {
    const { userId, fromDate, toDate, dryRun = false, source = 'both' } = req.body;

    const results = {
      dbTradesScanned: 0,
      mt5DealsScanned: 0,
      alreadyHadCommission: 0,
      noReferrer: 0,
      awarded: 0,
      errors: [],
      dryRun,
    };

    // ── 1. DB-based trades ────────────────────────────────────────────────────

    if (source === 'db' || source === 'both') {
      const tradeWhere = { status: 'closed', profit: { [Op.gt]: 0 } };
      if (fromDate) tradeWhere.closeTime = { ...(tradeWhere.closeTime || {}), [Op.gte]: new Date(fromDate) };
      if (toDate)   tradeWhere.closeTime = { ...(tradeWhere.closeTime || {}), [Op.lte]: new Date(toDate) };

      const accountWhere = {};
      if (userId) accountWhere.userId = parseInt(userId);

      const trades = await Trade.findAll({
        where: tradeWhere,
        include: [{
          model: Mt5Account,
          as: 'account',
          attributes: ['id', 'userId'],
          where: Object.keys(accountWhere).length ? accountWhere : undefined,
          required: true
        }]
      });

      results.dbTradesScanned = trades.length;

      for (const trade of trades) {
        const tradeUserId = trade.account?.userId;
        if (!tradeUserId) { results.noReferrer++; continue; }

        // Check if user has a referrer
        const user = await User.findByPk(tradeUserId, { attributes: ['id', 'referredBy'] });
        if (!user?.referredBy) { results.noReferrer++; continue; }

        // Check existing commission (dedup also happens in service but checking here for stats)
        const existing = await IbCommission.findOne({
          where: { relatedId: String(trade.id), relatedType: 'trade' }
        });
        if (existing) { results.alreadyHadCommission++; continue; }

        if (!dryRun) {
          try {
            await awardTradingCommission(tradeUserId, trade.id, parseFloat(trade.profit));
          } catch (e) {
            results.errors.push(`Trade #${trade.id}: ${e.message}`);
            continue;
          }
        }
        results.awarded++;
        console.log(`[IB Recalc] ${dryRun ? '[DRY]' : 'Awarded'} commission for trade #${trade.id} (user #${tradeUserId}, profit $${trade.profit})`);
      }
    }

    // ── 2. MT5 deal history ───────────────────────────────────────────────────

    if (source === 'mt5' || source === 'both') {
      // Find all users who have a referrer AND have MT5 accounts
      const userWhere = { referredBy: { [Op.ne]: null } };
      if (userId) userWhere.id = parseInt(userId);

      const referredUsers = await User.findAll({
        where: userWhere,
        attributes: ['id', 'referredBy'],
        include: [{
          model: Mt5Account,
          as: 'accounts',
          attributes: ['id', 'mt5Login'],
          required: true
        }]
      });

      const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default 30 days
      const to   = toDate   ? new Date(toDate)   : new Date();

      for (const user of referredUsers) {
        for (const account of (user.accounts || [])) {
          try {
            const dealData = await getDealHistory(account.mt5Login, from, to);
            const deals = Array.isArray(dealData) ? dealData
              : (Array.isArray(dealData?.deals) ? dealData.deals
              : (Array.isArray(dealData?.data) ? dealData.data : []));

            for (const deal of deals) {
              results.mt5DealsScanned++;

              const profit = parseFloat(deal.profit || deal.Profit || 0);
              if (profit <= 0) continue;

              // Skip balance/deposit/withdrawal operations (action = 2 means Balance in MT5)
              const action = parseInt(deal.action ?? deal.Action ?? deal.deal_action ?? -1);
              if (action === 2 || action === 3 || action === 4) continue; // 2=Balance, 3=Credit, 4=Charge

              // Only process closing deals — entry must explicitly be OUT/INOUT/1
              // If entry is missing/empty, skip (avoids processing balance ops with no entry type)
              const entry = (deal.entry ?? deal.Entry ?? '').toString().toUpperCase();
              if (!entry || (entry !== 'OUT' && entry !== 'INOUT' && entry !== '1')) continue;

              const dealTicket = deal.deal || deal.ticket || deal.Ticket || deal.DealId;
              if (!dealTicket) continue;

              // Use "mt5_TICKET" as relatedId to distinguish from DB trade IDs (stored as STRING)
              const relatedId = `mt5_${dealTicket}`;

              // Skip if already processed
              const existing = await IbCommission.findOne({
                where: { relatedId, relatedType: 'mt5_trade' }
              });
              if (existing) { results.alreadyHadCommission++; continue; }

              if (!dryRun) {
                try {
                  await awardTradingCommission(user.id, relatedId, profit, 0, 'mt5_trade');
                } catch (e) {
                  results.errors.push(`MT5 deal ${dealTicket} user #${user.id}: ${e.message}`);
                  continue;
                }
              }
              results.awarded++;
              console.log(`[IB Recalc MT5] ${dryRun ? '[DRY]' : 'Awarded'} commission for MT5 deal ${dealTicket} (user #${user.id}, profit $${profit})`);
            }
          } catch (e) {
            results.errors.push(`MT5 history for login ${account.mt5Login}: ${e.message}`);
          }
        }
      }
    }

    const message = dryRun
      ? `Dry run: would award commissions for ${results.awarded} trades`
      : `Recalculation complete: awarded ${results.awarded} commissions`;

    res.json(successResponse(results, message));
  } catch (error) {
    console.error('[IB Recalc] Error:', error.message);
    next(error);
  }
};

export default { getLevels, createLevel, updateLevel, deleteLevel, getNetwork, getCommissions, updateCommissionStatus, getStats, recalculateCommissions };
