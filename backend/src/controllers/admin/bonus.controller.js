import { Bonus, UserBonus, User, Mt5Account, Wallet, WalletTransaction } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import mt5Service from '../../services/mt5.service.js';
import { Op } from 'sequelize';

export const getAllBonuses = async (req, res, next) => {
  try {
    const bonuses = await Bonus.findAll({
      include: [{ model: UserBonus, as: 'claims', attributes: ['id', 'userId', 'status', 'amount'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(successResponse(bonuses, 'All bonuses retrieved'));
  } catch (error) { next(error); }
};

export const createBonus = async (req, res, next) => {
  try {
    const { name, type, amount, percentage, amountType, requiredLots, startDate, expiryDate, expiryDays, maxClaims, description } = req.body;

    if (!name || !type) throw new BusinessError('Name and type are required');
    if (!['welcome', 'deposit', 'old_user'].includes(type)) throw new BusinessError('Invalid bonus type');

    const bonus = await Bonus.create({
      name,
      type,
      amount: amount || 0,
      percentage: percentage || 0,
      amountType: amountType || 'fixed',
      requiredLots: requiredLots || 0,
      startDate: startDate || null,
      expiryDate: expiryDate || null,
      expiryDays: expiryDays || null,
      maxClaims: maxClaims || 0,
      description: description || null,
      isActive: true
    });

    res.status(201).json(successResponse(bonus, 'Bonus created'));
  } catch (error) { next(error); }
};

export const updateBonus = async (req, res, next) => {
  try {
    const bonus = await Bonus.findByPk(req.params.id);
    if (!bonus) throw new NotFoundError('Bonus not found');

    const { name, amount, percentage, amountType, requiredLots, startDate, expiryDate, expiryDays, maxClaims, description, isActive } = req.body;

    await bonus.update({
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount }),
      ...(percentage !== undefined && { percentage }),
      ...(amountType !== undefined && { amountType }),
      ...(requiredLots !== undefined && { requiredLots }),
      ...(startDate !== undefined && { startDate }),
      ...(expiryDate !== undefined && { expiryDate }),
      ...(expiryDays !== undefined && { expiryDays }),
      ...(maxClaims !== undefined && { maxClaims }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive })
    });

    res.json(successResponse(bonus, 'Bonus updated'));
  } catch (error) { next(error); }
};

export const deleteBonus = async (req, res, next) => {
  try {
    const bonus = await Bonus.findByPk(req.params.id);
    if (!bonus) throw new NotFoundError('Bonus not found');

    await bonus.update({ isActive: false });
    res.json(successResponse(null, 'Bonus deactivated'));
  } catch (error) { next(error); }
};

export const getBonusClaims = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, bonusId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (bonusId) where.bonusId = bonusId;

    const { count, rows } = await UserBonus.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Bonus, as: 'bonus', attributes: ['id', 'name', 'type'] }
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Bonus claims retrieved'));
  } catch (error) { next(error); }
};

export const creditBonusToUser = async (req, res, next) => {
  try {
    const { userId, mt5Login, amount, comment } = req.body;

    if (!userId || !amount || amount <= 0) throw new BusinessError('userId and a positive amount are required');

    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');

    if (mt5Login) {
      const mt5Account = await Mt5Account.findOne({ where: { mt5Login, userId } });
      if (!mt5Account) throw new NotFoundError('MT5 account not found for this user');

      await mt5Service.credit(parseInt(mt5Login), parseFloat(amount), comment || 'Admin Bonus Credit');

      res.json(successResponse({
        userId,
        mt5Login,
        amount,
        type: 'mt5_credit'
      }, `$${parseFloat(amount).toFixed(2)} credited to MT5 #${mt5Login}`));
    } else {
      let wallet = await Wallet.findOne({ where: { userId } });
      if (!wallet) wallet = await Wallet.create({ userId, balance: 0 });

      const balanceBefore = parseFloat(wallet.balance) || 0;
      const balanceAfter = balanceBefore + parseFloat(amount);
      await wallet.update({ balance: balanceAfter });

      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'deposit',
        amount: parseFloat(amount),
        balanceBefore,
        balanceAfter,
        referenceType: 'admin_bonus_credit',
        description: comment || `Admin bonus credit: +$${parseFloat(amount).toFixed(2)}`
      });

      res.json(successResponse({
        userId,
        walletBalance: balanceAfter,
        amount,
        type: 'wallet_credit'
      }, `$${parseFloat(amount).toFixed(2)} credited to wallet`));
    }
  } catch (error) { next(error); }
};

export const debitBonusFromUser = async (req, res, next) => {
  try {
    const { userId, mt5Login, amount, comment } = req.body;

    if (!userId || !amount || amount <= 0) throw new BusinessError('userId and a positive amount are required');

    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');

    if (mt5Login) {
      const mt5Account = await Mt5Account.findOne({ where: { mt5Login, userId } });
      if (!mt5Account) throw new NotFoundError('MT5 account not found for this user');

      await mt5Service.credit(parseInt(mt5Login), -parseFloat(amount), comment || 'Admin Bonus Debit');

      res.json(successResponse({
        userId,
        mt5Login,
        amount,
        type: 'mt5_debit'
      }, `$${parseFloat(amount).toFixed(2)} debited from MT5 #${mt5Login}`));
    } else {
      const wallet = await Wallet.findOne({ where: { userId } });
      if (!wallet) throw new NotFoundError('User has no wallet');

      const balanceBefore = parseFloat(wallet.balance) || 0;
      if (balanceBefore < parseFloat(amount)) {
        throw new BusinessError(`Insufficient wallet balance. Available: $${balanceBefore.toFixed(2)}`);
      }

      const balanceAfter = balanceBefore - parseFloat(amount);
      await wallet.update({ balance: balanceAfter });

      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: -parseFloat(amount),
        balanceBefore,
        balanceAfter,
        referenceType: 'admin_bonus_debit',
        description: comment || `Admin bonus debit: -$${parseFloat(amount).toFixed(2)}`
      });

      res.json(successResponse({
        userId,
        walletBalance: balanceAfter,
        amount,
        type: 'wallet_debit'
      }, `$${parseFloat(amount).toFixed(2)} debited from wallet`));
    }
  } catch (error) { next(error); }
};

export const assignBonusToUser = async (req, res, next) => {
  try {
    const { userId, bonusId, mt5Login, note } = req.body;

    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');

    const bonus = await Bonus.findByPk(bonusId);
    if (!bonus) throw new NotFoundError('Bonus not found');

    const existing = await UserBonus.findOne({
      where: { userId, bonusId, status: ['available', 'claimed', 'credited'] }
    });
    if (existing) throw new BusinessError('User already has this bonus');

    const bonusAmount = parseFloat(bonus.amount) || 0;
    let expiresAt = null;
    if (bonus.expiryDays) {
      expiresAt = new Date(Date.now() + bonus.expiryDays * 24 * 60 * 60 * 1000);
    } else if (bonus.expiryDate) {
      expiresAt = bonus.expiryDate;
    }

    const userBonus = await UserBonus.create({
      userId,
      bonusId,
      mt5Account: mt5Login || null,
      amount: bonusAmount,
      requiredLots: bonus.requiredLots || 0,
      status: 'available',
      expiresAt,
      adminNote: note || 'Assigned by admin'
    });

    await bonus.increment('totalClaimed');

    res.status(201).json(successResponse(userBonus, 'Bonus assigned to user'));
  } catch (error) { next(error); }
};

export default {
  getAllBonuses,
  createBonus,
  updateBonus,
  deleteBonus,
  getBonusClaims,
  creditBonusToUser,
  debitBonusFromUser,
  assignBonusToUser
};
