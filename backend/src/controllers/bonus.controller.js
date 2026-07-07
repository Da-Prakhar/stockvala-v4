import { Bonus, UserBonus, Mt5Account, User } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';
import mt5Service from '../services/mt5.service.js';

export const getAvailableBonuses = async (req, res, next) => {
  try {
    const now = new Date();
    const bonuses = await Bonus.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    const userBonuses = await UserBonus.findAll({
      where: { userId: req.user.id },
      include: [{ model: Bonus, as: 'bonus' }],
      order: [['createdAt', 'DESC']]
    });

    const activeBonuses = bonuses.filter(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.expiryDate && new Date(b.expiryDate) < now) return false;
      if (b.maxClaims > 0 && b.totalClaimed >= b.maxClaims) return false;
      return true;
    });

    res.json(successResponse({
      available: activeBonuses,
      myBonuses: userBonuses
    }, 'Bonuses retrieved'));
  } catch (error) { next(error); }
};

export const claimBonus = async (req, res, next) => {
  try {
    const { bonusId, mt5AccountId } = req.body;

    const bonus = await Bonus.findByPk(bonusId);
    if (!bonus || !bonus.isActive) throw new NotFoundError('Bonus not found or inactive');

    const now = new Date();
    if (bonus.startDate && new Date(bonus.startDate) > now) {
      throw new BusinessError('This bonus is not yet available');
    }
    if (bonus.expiryDate && new Date(bonus.expiryDate) < now) {
      throw new BusinessError('This bonus has expired');
    }
    if (bonus.maxClaims > 0 && bonus.totalClaimed >= bonus.maxClaims) {
      throw new BusinessError('This bonus has reached its maximum claims');
    }

    const existing = await UserBonus.findOne({
      where: { userId: req.user.id, bonusId, status: ['available', 'claimed', 'credited'] }
    });
    if (existing) throw new BusinessError('You have already claimed this bonus');

    let mt5Login = null;
    if (mt5AccountId) {
      const mt5Account = await Mt5Account.findOne({
        where: { id: mt5AccountId, userId: req.user.id }
      });
      if (!mt5Account) throw new NotFoundError('MT5 account not found');
      mt5Login = mt5Account.mt5Login;
    }

    let bonusAmount = parseFloat(bonus.amount) || 0;
    if (bonus.type === 'deposit' && bonus.amountType === 'percentage' && bonus.percentage > 0) {
      const deposits = await (await import('../models/Deposit.js')).default.findAll({
        where: { userId: req.user.id, status: 'approved' },
        order: [['createdAt', 'DESC']],
        limit: 1
      });
      if (deposits.length === 0) throw new BusinessError('No approved deposit found for deposit bonus');
      bonusAmount = parseFloat(deposits[0].amount) * (parseFloat(bonus.percentage) / 100);
      if (bonus.amount > 0 && bonusAmount > parseFloat(bonus.amount)) {
        bonusAmount = parseFloat(bonus.amount);
      }
    }

    let expiresAt = null;
    if (bonus.expiryDays) {
      expiresAt = new Date(now.getTime() + bonus.expiryDays * 24 * 60 * 60 * 1000);
    } else if (bonus.expiryDate) {
      expiresAt = bonus.expiryDate;
    }

    const userBonus = await UserBonus.create({
      userId: req.user.id,
      bonusId,
      mt5Account: mt5Login,
      amount: bonusAmount,
      requiredLots: bonus.requiredLots || 0,
      status: 'claimed',
      claimedAt: now,
      expiresAt
    });

    if (mt5Login && bonusAmount > 0) {
      try {
        await mt5Service.credit(mt5Login, bonusAmount, `Bonus: ${bonus.name}`);
        await userBonus.update({ status: 'credited', creditedAt: new Date() });
      } catch (mt5Err) {
        console.error(`[Bonus] MT5 credit failed for ${mt5Login}:`, mt5Err.message);
        await userBonus.update({ adminNote: `MT5 credit failed: ${mt5Err.message}` });
      }
    }

    await bonus.increment('totalClaimed');

    res.status(201).json(successResponse(userBonus, 'Bonus claimed successfully'));
  } catch (error) { next(error); }
};

export const getMyBonuses = async (req, res, next) => {
  try {
    const bonuses = await UserBonus.findAll({
      where: { userId: req.user.id },
      include: [{ model: Bonus, as: 'bonus' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(successResponse(bonuses, 'Your bonuses retrieved'));
  } catch (error) { next(error); }
};

export const getDashboardBonuses = async (req, res, next) => {
  try {
    const activeBonuses = await Bonus.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    const myBonuses = await UserBonus.findAll({
      where: { userId: req.user.id },
      include: [{ model: Bonus, as: 'bonus' }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    const totalCredited = await UserBonus.sum('amount', {
      where: { userId: req.user.id, status: 'credited' }
    }) || 0;

    const pendingCount = await UserBonus.count({
      where: { userId: req.user.id, status: 'claimed' }
    });

    res.json(successResponse({
      availableBonuses: activeBonuses,
      myRecentBonuses: myBonuses,
      totalCredited,
      pendingCount
    }, 'Dashboard bonuses'));
  } catch (error) { next(error); }
};

export default {
  getAvailableBonuses,
  claimBonus,
  getMyBonuses,
  getDashboardBonuses
};
