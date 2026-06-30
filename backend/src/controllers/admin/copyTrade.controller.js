import { CopyTradeMaster, CopyTradeFollower, CopyTrade, CopyTradeSettings, User, Mt5Account, AuditLog } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { setFollower, removeFollower } from '../../redis/client.js';

// ─── Redis helpers (mirrors user-side copyTrade.controller.js) ───────────────
async function syncToRedisAdmin(masterMt5Login, followerMt5Login, settings) {
  if (!masterMt5Login || !followerMt5Login) return;
  try {
    await setFollower(String(masterMt5Login), String(followerMt5Login), {
      lotMode:        settings.lotMode        || 'ratio',
      copyRatio:      parseFloat(settings.copyRatio)      || 1.0,
      fixedLot:       settings.fixedLot       != null ? parseFloat(settings.fixedLot)       : null,
      equityPct:      settings.equityPct      != null ? parseFloat(settings.equityPct)      : null,
      riskPct:        settings.riskPct        != null ? parseFloat(settings.riskPct)        : null,
      maxLotPerTrade: settings.maxLotPerTrade != null ? parseFloat(settings.maxLotPerTrade) : null,
      // legacy / snake_case aliases — C# engine may read these instead
      ratio:          parseFloat(settings.copyRatio) || 1.0,
      maxLot:         settings.maxLotPerTrade != null ? parseFloat(settings.maxLotPerTrade) : null,
      equity_pct:     settings.equityPct      != null ? parseFloat(settings.equityPct)      : null,
      risk_pct:       settings.riskPct        != null ? parseFloat(settings.riskPct)        : null,
      fixed_lot:      settings.fixedLot       != null ? parseFloat(settings.fixedLot)       : null,
    });
    console.log(`[AdminCopyTrade] Redis synced master=${masterMt5Login} follower=${followerMt5Login}`);
  } catch (e) {
    console.error('[AdminCopyTrade] Redis sync failed:', e.message);
  }
}

async function removeFromRedisAdmin(masterMt5Login, followerMt5Login) {
  if (!masterMt5Login || !followerMt5Login) return;
  try {
    await removeFollower(String(masterMt5Login), String(followerMt5Login));
    console.log(`[AdminCopyTrade] Redis removed master=${masterMt5Login} follower=${followerMt5Login}`);
  } catch (e) {
    console.error('[AdminCopyTrade] Redis remove failed:', e.message);
  }
}

/**
 * Get copy trading stats
 */
export const getStats = async (req, res, next) => {
  try {
    const totalMasters = await CopyTradeMaster.count();
    const pendingMasters = await CopyTradeMaster.count({ where: { status: 'pending' } });
    const approvedMasters = await CopyTradeMaster.count({ where: { status: 'approved' } });
    const rejectedMasters = await CopyTradeMaster.count({ where: { status: 'rejected' } });
    const totalFollowers = await CopyTradeFollower.count({ where: { status: 'active' } });
    const totalCopyTrades = await CopyTrade.count();

    res.json(successResponse({
      totalMasters, pendingMasters, approvedMasters, rejectedMasters,
      totalFollowers, totalCopyTrades
    }, 'Stats retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all masters (admin sees all statuses)
 */
export const getAllMasters = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const { count, rows } = await CopyTradeMaster.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Masters retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get master details with followers
 */
export const getMasterDetails = async (req, res, next) => {
  try {
    const { masterId } = req.params;

    const master = await CopyTradeMaster.findByPk(masterId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    if (!master) throw new NotFoundError('Master not found');

    res.json(successResponse(master, 'Master details retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get followers for a master
 */
export const getMasterFollowers = async (req, res, next) => {
  try {
    const { masterId } = req.params;

    const followers = await CopyTradeFollower.findAll({
      where: { masterId },
      include: [
        { model: User, as: 'follower', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'followerAccount', attributes: ['id', 'mt5Login'] },
        { model: CopyTradeSettings, as: 'settings' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(successResponse(followers, 'Followers retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Approve master application
 */
export const approveMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const { performanceFeePct, managementFee, maxFollowers } = req.body;

    const master = await CopyTradeMaster.findByPk(masterId);
    if (!master) throw new NotFoundError('Master not found');

    const updates = {
      status: 'approved',
      isActive: true,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    };
    if (performanceFeePct !== undefined) updates.performanceFeePct = performanceFeePct;
    if (managementFee !== undefined) updates.managementFee = managementFee;
    if (maxFollowers !== undefined) updates.maxFollowers = maxFollowers;

    await master.update(updates);

    try {
      await AuditLog.create({
        adminId: req.user.id, action: 'copy_master_approved',
        entityType: 'CopyTradeMaster', entityId: master.id,
        details: { userId: master.userId }
      });
    } catch (e) { console.error('[Audit]', e.message); }

    res.json(successResponse(master, 'Master approved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Reject master application
 */
export const rejectMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const rejectionReason = req.body.rejectionReason || req.body.reason || '';

    const master = await CopyTradeMaster.findByPk(masterId);
    if (!master) throw new NotFoundError('Master not found');

    await master.update({
      status: 'rejected',
      isActive: false,
      rejectionReason,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });

    try {
      await AuditLog.create({
        adminId: req.user.id, action: 'copy_master_rejected',
        entityType: 'CopyTradeMaster', entityId: master.id,
        details: { userId: master.userId, rejectionReason }
      });
    } catch (e) { console.error('[Audit]', e.message); }

    res.json(successResponse(master, 'Master rejected'));
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend an active master
 */
export const suspendMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const master = await CopyTradeMaster.findByPk(masterId);
    if (!master) throw new NotFoundError('Master not found');

    await master.update({ status: 'suspended', isActive: false });
    res.json(successResponse(master, 'Master suspended'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update master settings (fees, max followers, etc.)
 */
export const updateMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const master = await CopyTradeMaster.findByPk(masterId);
    if (!master) throw new NotFoundError('Master not found');

    const allowed = [
      'performanceFeePct', 'managementFee', 'minInvestment', 'maxFollowers',
      'isActive', 'displayName', 'description', 'tradingStyle'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Broker-controlled follower settings (JSON object or individual fields)
    if (req.body.followerSettings !== undefined) {
      // Full replacement
      updates.followerSettings = req.body.followerSettings;
    } else {
      // Patch individual keys if sent at top level
      const settingKeys = [
        'allowCopyRatio', 'copyRatioMin', 'copyRatioMax',
        'allowFixedLot',  'fixedLotMin',  'fixedLotMax',
        'allowEquityPct', 'equityPctMin', 'equityPctMax',
        'allowMaxLotPerTrade', 'maxLotPerTradeMax',
        'maxFollowersPerUser', 'defaultCopyRatio'
      ];
      const patch = {};
      for (const k of settingKeys) {
        if (req.body[k] !== undefined) patch[k] = req.body[k];
      }
      if (Object.keys(patch).length > 0) {
        updates.followerSettings = { ...(master.followerSettings || {}), ...patch };
      }
    }

    await master.update(updates);
    res.json(successResponse(master, 'Master updated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Admin-create a master directly (bypass application)
 */
export const createMaster = async (req, res, next) => {
  try {
    const { userId, mt5AccountId, displayName, description, tradingStyle, performanceFeePct, managementFee, minInvestment, maxFollowers } = req.body;

    // Find user by email if userId not given
    let uid = userId;
    if (!uid && req.body.email) {
      const user = await User.findOne({ where: { email: req.body.email } });
      if (!user) throw new NotFoundError('User not found with that email');
      uid = user.id;
    }
    if (!uid) throw new NotFoundError('userId or email required');

    // Find MT5 account
    let accId = mt5AccountId;
    if (!accId) {
      if (req.body.mt5Login) {
        const acc = await Mt5Account.findOne({ where: { mt5Login: req.body.mt5Login } });
        if (acc) accId = acc.id;
      }
      if (!accId) {
        const acc = await Mt5Account.findOne({ where: { userId: uid } });
        if (!acc) throw new NotFoundError('User has no MT5 account');
        accId = acc.id;
      }
    }

    const master = await CopyTradeMaster.create({
      userId: uid,
      mt5AccountId: accId,
      displayName: displayName || `Master ${uid}`,
      description: description || '',
      tradingStyle: tradingStyle || '',
      performanceFeePct: performanceFeePct || 20,
      managementFee: managementFee || 0,
      minInvestment: minInvestment || 100,
      maxFollowers: maxFollowers || 100,
      status: 'approved',
      isActive: true,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });

    res.status(201).json(successResponse(master, 'Master created'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get ALL followers across all masters (admin view)
 */
export const getAllFollowers = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, status, masterId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (masterId) where.masterId = masterId;

    const { count, rows } = await CopyTradeFollower.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      include: [
        { model: User, as: 'follower', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'followerAccount', attributes: ['id', 'mt5Login'] },
        {
          model: CopyTradeMaster, as: 'master',
          attributes: ['id', 'displayName'],
          include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'All followers retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Admin update an individual follower's copy settings + sync to Redis immediately
 */
export const updateFollower = async (req, res, next) => {
  try {
    const { followerId } = req.params;

    const follower = await CopyTradeFollower.findByPk(followerId, {
      include: [
        { model: Mt5Account, as: 'followerAccount', attributes: ['id', 'mt5Login'] },
        {
          model: CopyTradeMaster, as: 'master',
          attributes: ['id', 'displayName'],
          include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }]
        }
      ]
    });

    if (!follower) throw new NotFoundError('Follower subscription not found');

    const allowed = ['copyRatio', 'lotMode', 'fixedLot', 'equityPct', 'maxLotPerTrade', 'riskPct', 'allocationAmount', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Set stoppedAt timestamp when admin force-stops
    if (updates.status === 'stopped' && follower.status !== 'stopped') {
      updates.stoppedAt = new Date();
    }

    await follower.update(updates);

    // Sync to Redis copy engine immediately
    const masterMt5Login = follower.master?.account?.mt5Login;
    const followerMt5Login = follower.followerAccount?.mt5Login;
    const newStatus = updates.status || follower.status;

    if (newStatus === 'active') {
      await syncToRedisAdmin(masterMt5Login, followerMt5Login, { ...follower.toJSON(), ...updates });
    } else {
      // paused or stopped — remove from engine
      await removeFromRedisAdmin(masterMt5Login, followerMt5Login);
    }

    // Audit
    try {
      await AuditLog.create({
        adminId: req.user.id, action: 'follower_settings_updated',
        entityType: 'CopyTradeFollower', entityId: follower.id,
        details: { updates, masterMt5Login, followerMt5Login }
      });
    } catch (e) { console.error('[Audit]', e.message); }

    res.json(successResponse(follower, 'Follower settings updated and synced to engine'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all copy trades (admin view)
 */
export const getAllCopyTrades = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, masterId, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (masterId) where.masterId = masterId;
    if (status) where.status = status;

    const { count, rows } = await CopyTrade.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: CopyTradeMaster, as: 'master', attributes: ['id', 'displayName'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Copy trades retrieved'));
  } catch (error) {
    next(error);
  }
};

export default {
  getStats, getAllMasters, getMasterDetails, getMasterFollowers,
  getAllFollowers, updateFollower,
  approveMaster, rejectMaster, suspendMaster, updateMaster, createMaster,
  getAllCopyTrades
};
