import { IbTree, IbCommission, IbLevel, User, BrokerSetting } from '../models/index.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { Sequelize } from 'sequelize';
import crypto from 'crypto';

/**
 * Generate a unique IB code like "NF-AB12CD" (prefix from company initials)
 */
const generateIbCode = async () => {
  // Derive prefix from company name in DB (e.g. "NeonFX" → "NF", "StockVala" → "SV")
  let prefix = 'IB';
  try {
    const setting = await BrokerSetting.findOne({ where: { key: 'companyName' } });
    if (setting?.value) {
      const words = setting.value.trim().split(/\s+/);
      if (words.length >= 2) {
        prefix = (words[0][0] + words[1][0]).toUpperCase();
      } else {
        prefix = setting.value.substring(0, 2).toUpperCase();
      }
    }
  } catch (_) { /* use default */ }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return `${prefix}-${code}`;
};

/**
 * Get or create IB tree for current user
 */
const getOrCreateTree = async (userId) => {
  let tree = await IbTree.findOne({ where: { userId } });

  if (!tree) {
    // Generate unique ibCode
    let ibCode;
    let attempts = 0;
    do {
      ibCode = await generateIbCode();
      const existing = await IbTree.findOne({ where: { ibCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    tree = await IbTree.create({
      userId,
      ibCode,
      level: 1,
      status: 'active'
    });
  }

  return tree;
};

/**
 * Build the referral link using the correct domain.
 * Priority: broker_settings.LANDING_URL > env LANDING_URL > request origin
 * This ensures each SaaS client gets links matching their own domain.
 */
const buildReferralLink = async (req, ibCode) => {
  // 1. Check broker_settings table for a custom landing URL
  try {
    const setting = await BrokerSetting.findOne({ where: { key: 'LANDING_URL' } });
    if (setting?.value) {
      return `${setting.value.replace(/\/$/, '')}/register?ref=${ibCode}`;
    }
  } catch (_) { /* table may not exist yet — fall through */ }

  // 2. Check env variable
  if (process.env.LANDING_URL) {
    return `${process.env.LANDING_URL.replace(/\/$/, '')}/register?ref=${ibCode}`;
  }

  // 3. Derive from the request origin (works for any domain the CRM is served on)
  const rawOrigin = req.get('origin') || req.get('referer') || `${req.protocol}://${req.get('host')}`;
  // Use URL parser to extract just protocol+host (avoids regex stripping the hostname itself)
  let baseUrl;
  try {
    const parsed = new URL(rawOrigin);
    // Strip any CRM subdomain (user., app., broker.) to get the landing page root
    const host = parsed.host.replace(/^(user|app|broker|crm|platform)\./i, '');
    baseUrl = `${parsed.protocol}//${host}`;
  } catch {
    baseUrl = rawOrigin.replace(/\/[^/]*$/, '').replace(/\/$/, '');
  }
  return `${baseUrl}/register?ref=${ibCode}`;
};

export const getIbTree = async (req, res, next) => {
  try {
    const tree = await getOrCreateTree(req.user.id);

    // Get direct referrals
    const referrals = await User.findAll({
      where: { referredBy: req.user.id },
      attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt']
    });

    // Build referral link matching the current domain
    const referralLink = await buildReferralLink(req, tree.ibCode);

    res.json(successResponse({
      ...tree.toJSON(),
      referralCode: tree.ibCode,
      referralLink,
      referrals,
      referralCount: referrals.length
    }, 'IB tree retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getIbCommissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const tree = await getOrCreateTree(req.user.id);

    const { count, rows } = await IbCommission.findAndCountAll({
      where: { ibTreeId: tree.id },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Commissions retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getIbStats = async (req, res, next) => {
  try {
    const tree = await getOrCreateTree(req.user.id);

    // Get commission statistics
    const commissions = await IbCommission.findAll({
      where: { ibTreeId: tree.id },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('commission_amount')), 'totalCommission'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'commissionCount']
      ],
      raw: true
    });

    const totalCommission = commissions[0]?.totalCommission || 0;
    const commissionCount = commissions[0]?.commissionCount || 0;

    // Get referral count
    const referralCount = await User.count({
      where: { referredBy: req.user.id }
    });

    // Get global IB levels (for display)
    const ibLevels = await IbLevel.findAll({
      where: { isActive: true },
      order: [['level', 'ASC']]
    });

    const stats = {
      totalReferrals: referralCount,
      totalCommissions: parseFloat(totalCommission),
      commissionCount: parseInt(commissionCount),
      ibLevels: ibLevels.length,
      currentLevel: tree.level,
      status: tree.status,
      levels: ibLevels // send level details so frontend can show commission tiers
    };

    res.json(successResponse(stats, 'IB stats retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getReferrals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where: { referredBy: req.user.id },
      limit: parseInt(limit),
      offset,
      attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt', 'status'],
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Referrals retrieved'));
  } catch (error) {
    next(error);
  }
};

export default { getIbTree, getIbCommissions, getIbStats, getReferrals };
