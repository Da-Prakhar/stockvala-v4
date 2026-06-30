/**
 * Admin Fee Controller
 * Provides full visibility and control over broker commissions.
 */
import {
  FeeTransaction, CopyTradeMaster, MamManager, PammManager, User
} from '../../models/index.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';
import feeService from '../../services/fee.service.js';
import { Op } from 'sequelize';

// ─── Dashboard Summary ────────────────────────────────────────────────────────

/**
 * GET /admin/fees/summary
 * Total platform revenue, broken down by product and fee type.
 * Supports ?from=&to=&product= filters.
 */
export const getSummary = async (req, res, next) => {
  try {
    const { from, to, product } = req.query;
    const summary = await feeService.getFeeSummary({ from, to, product });
    res.json(successResponse(summary, 'Fee summary retrieved'));
  } catch (err) {
    next(err);
  }
};

// ─── Transaction List ─────────────────────────────────────────────────────────

/**
 * GET /admin/fees/transactions
 * Paginated list of all fee transactions with filters.
 */
export const getTransactions = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 50,
      product, feeType, status,
      from, to, userId, entityId
    } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (product)  where.product  = product;
    if (feeType)  where.feeType  = feeType;
    if (status)   where.status   = status;
    if (userId)   where.userId   = userId;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to)   where.createdAt[Op.lte] = new Date(to);
    }

    const { count, rows } = await FeeTransaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Fee transactions retrieved'));
  } catch (err) {
    next(err);
  }
};

// ─── Master Fee Settings ──────────────────────────────────────────────────────

/**
 * PUT /admin/fees/copy-masters/:masterId
 * Update fee rates and platform split for a copy master.
 *
 * Body: { performanceFeePct, managementFee, platformFeeSplitPct }
 */
export const updateCopyMasterFees = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const master = await CopyTradeMaster.findByPk(masterId);
    if (!master) throw new NotFoundError('Copy master not found');

    const allowed = ['performanceFeePct', 'managementFee', 'platformFeeSplitPct'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = parseFloat(req.body[k]);
    }

    await master.update(updates);
    res.json(successResponse(master, 'Copy master fees updated'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /admin/fees/mam-managers/:managerId
 * Update fee rates and platform split for a MAM manager.
 */
export const updateMamManagerFees = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const manager = await MamManager.findByPk(managerId);
    if (!manager) throw new NotFoundError('MAM manager not found');

    const allowed = ['performanceFeePct', 'managementFeePct', 'platformFeeSplitPct'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = parseFloat(req.body[k]);
    }
    await manager.update(updates);
    res.json(successResponse(manager, 'MAM manager fees updated'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /admin/fees/pamm-pools/:poolId
 * Update fee rates and platform split for a PAMM pool.
 */
export const updatePammPoolFees = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const pool = await PammManager.findByPk(poolId);
    if (!pool) throw new NotFoundError('PAMM pool not found');

    const allowed = ['performanceFeePct', 'managementFeePct', 'platformFeeSplitPct'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = parseFloat(req.body[k]);
    }
    await pool.update(updates);
    res.json(successResponse(pool, 'PAMM pool fees updated'));
  } catch (err) {
    next(err);
  }
};

// ─── Manual Settlement ────────────────────────────────────────────────────────

/**
 * POST /admin/fees/settle-management
 * Manually trigger monthly management fee settlement for all products.
 * (Normally run by cron on 1st of month)
 */
export const triggerManagementFeeSettlement = async (req, res, next) => {
  try {
    const results = await feeService.settleMonthlyManagementFees();
    res.json(successResponse({
      settled: results.length,
      totalAmount: results.reduce((s, r) => s + parseFloat(r.feeAmount), 0).toFixed(2)
    }, `Management fees settled: ${results.length} transactions`));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/fees/manual-charge
 * Manually charge a fee for a specific subscriber (override / correction).
 * Body: { product, feeType, entityId, subscriberId, userId, feeAmount, platformSplitPct, notes }
 */
export const manualCharge = async (req, res, next) => {
  try {
    const {
      product, feeType, entityId, subscriberId, userId,
      grossProfit, feeAmount, platformSplitPct = 30, notes
    } = req.body;

    if (!product || !feeType || !entityId || !feeAmount) {
      return res.status(400).json({ message: 'product, feeType, entityId, feeAmount are required' });
    }

    const split     = parseFloat(platformSplitPct);
    const fa        = parseFloat(feeAmount);
    const platform  = Math.round(fa * split / 100 * 100) / 100;
    const master    = Math.round((fa - platform) * 100) / 100;

    const tx = await FeeTransaction.create({
      product, feeType,
      entityId, subscriberId, userId,
      grossProfit: grossProfit ? parseFloat(grossProfit) : null,
      feeAmount: fa, platformAmount: platform, masterAmount: master,
      feeRate: 0, platformSplitPct: split,
      status: 'settled', settledAt: new Date(),
      notes: notes || 'Manual admin charge'
    });

    res.status(201).json(successResponse(tx, 'Manual fee charged'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/fees/transactions/:id
 * Cancel / void a fee transaction.
 */
export const cancelTransaction = async (req, res, next) => {
  try {
    const tx = await FeeTransaction.findByPk(req.params.id);
    if (!tx) throw new NotFoundError('Fee transaction not found');
    await tx.update({ status: 'cancelled' });
    res.json(successResponse(tx, 'Fee transaction cancelled'));
  } catch (err) {
    next(err);
  }
};

export default {
  getSummary, getTransactions,
  updateCopyMasterFees, updateMamManagerFees, updatePammPoolFees,
  triggerManagementFeeSettlement, manualCharge, cancelTransaction
};
