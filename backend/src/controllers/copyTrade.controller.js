import { CopyTradeMaster, CopyTradeFollower, CopyTradeSettings, CopyTrade, User, Trade, Mt5Account, MamManager, MamAccount, PammManager, PammInvestor } from '../models/index.js';
import { NotFoundError, BusinessError, ConflictError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import mt5Service from '../services/mt5.service.js';
import { setFollower, removeFollower } from '../redis/client.js';
import { getPermissions } from '../utils/brokerPermissions.js';
import axios from 'axios';
import emailService from '../services/email.service.js';

/**
 * Push follow/unfollow events to Gateway Manager so it can update its Redis
 * and the copy engine starts copying immediately.
 * Fire-and-forget — never blocks the user-facing response.
 */
async function notifyGateway(action, masterLogin, followerLogin, settings = {}) {
  const url = process.env.GATEWAY_MANAGER_URL;
  const key = process.env.GATEWAY_MANAGER_API_KEY;
  if (!url || !key) return;
  try {
    const endpoint = `${url}/api/copy/subscribe`;
    if (action === 'subscribe') {
      await axios.post(endpoint, { masterLogin, followerLogin, settings }, {
        headers: { 'x-api-key': key },
        timeout: 5000,
      });
    } else {
      await axios.delete(endpoint, {
        data: { masterLogin, followerLogin },
        headers: { 'x-api-key': key },
        timeout: 5000,
      });
    }
  } catch (e) {
    console.error('[CopyTrade] Gateway notify failed:', e.message);
  }
}

/**
 * Sync a follower subscription into the Redis hash read by the copy engine.
 * Safe to call fire-and-forget — errors are logged but not thrown.
 */
async function syncToRedis(masterMt5Login, followerMt5Login, settings) {
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
  } catch (e) {
    console.error('[CopyTrade] Redis syncToRedis failed:', e.message);
  }
}

async function removeFromRedis(masterMt5Login, followerMt5Login) {
  if (!masterMt5Login || !followerMt5Login) return;
  try {
    await removeFollower(String(masterMt5Login), String(followerMt5Login));
  } catch (e) {
    console.error('[CopyTrade] Redis removeFromRedis failed:', e.message);
  }
}

// ============================================================================
// COPY TRADING — MASTER
// ============================================================================

/**
 * Apply to become a master trader
 */
export const applyAsMaster = async (req, res, next) => {
  try {
    const { mt5AccountId, displayName, description, tradingStyle, minInvestment } = req.body;

    // ── Broker permission check ───────────────────────────────────────────────
    const perms = await getPermissions();
    if (!perms.copy_allow_masters) {
      throw new BusinessError('Becoming a master trader is currently disabled on this platform.');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check if already applied
    const existing = await CopyTradeMaster.findOne({ where: { userId: req.user.id } });
    if (existing) {
      if (existing.status === 'rejected') {
        // Allow re-application
        await existing.update({
          mt5AccountId: mt5AccountId || existing.mt5AccountId,
          displayName: displayName || existing.displayName,
          description: description || existing.description,
          tradingStyle: tradingStyle || existing.tradingStyle,
          minInvestment: minInvestment || existing.minInvestment,
          status: 'pending',
          rejectionReason: null
        });
        return res.json(successResponse(existing, 'Master application resubmitted'));
      }
      throw new ConflictError('You have already applied as a master trader');
    }

    // Verify MT5 account belongs to user
    let mt5AccId = mt5AccountId;
    if (!mt5AccId) {
      const userAccount = await Mt5Account.findOne({ where: { userId: req.user.id } });
      if (!userAccount) throw new BusinessError('You need an MT5 account to become a master');
      mt5AccId = userAccount.id;
    } else {
      const acc = await Mt5Account.findOne({ where: { id: mt5AccountId, userId: req.user.id } });
      if (!acc) throw new BusinessError('MT5 account not found or does not belong to you');
    }

    const master = await CopyTradeMaster.create({
      userId: req.user.id,
      mt5AccountId: mt5AccId,
      displayName: displayName || `Trader ${req.user.id}`,
      description: description || '',
      tradingStyle: tradingStyle || '',
      minInvestment: minInvestment || 100,
      status: 'pending',
      isActive: false  // not active until approved
    });

    res.status(201).json(successResponse(master, 'Master application submitted. Awaiting admin approval.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's master profile (if any)
 */
export const getMyMasterProfile = async (req, res, next) => {
  try {
    const master = await CopyTradeMaster.findOne({
      where: { userId: req.user.id },
      include: [
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    if (!master) {
      return res.json(successResponse(null, 'Not a master trader'));
    }

    // Get live stats
    const followerCount = await CopyTradeFollower.count({ where: { masterId: master.id, status: 'active' } });
    const copyTradeCount = await CopyTrade.count({ where: { masterId: master.id } });

    res.json(successResponse({
      ...master.toJSON(),
      activeFollowers: followerCount,
      totalCopyTrades: copyTradeCount
    }, 'Master profile retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get approved masters (leaderboard) — LIVE MT5 data
 */
export const getMasters = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await CopyTradeMaster.findAndCountAll({
      where: { status: 'approved', isActive: true },
      limit: parseInt(limit),
      offset,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }
      ],
      order: [['totalProfit', 'DESC']]
    });

    // Enrich each master with LIVE MT5 data
    const enriched = await Promise.all(rows.map(async (master) => {
      const json = master.toJSON();
      const mt5Login = master.account?.mt5Login;
      if (!mt5Login) return json;

      try {
        // Fetch live account info from MT5 — bridge returns { success, data: { balance, equity, ... } }
        const accRaw = await mt5Service.getAccountInfo(mt5Login);
        const accInfo = accRaw?.data || accRaw || {};
        json.liveEquity = accInfo.equity || 0;
        json.liveBalance = accInfo.balance || 0;
        json.liveMargin = accInfo.margin || 0;
        json.liveFreeMargin = accInfo.margin_free || accInfo.freeMargin || 0;
        json.liveProfit = accInfo.profit || 0; // unrealized P&L

        // Fetch live open positions count
        const positions = await mt5Service.getOpenPositions(mt5Login);
        const posArr = Array.isArray(positions) ? positions : (positions?.positions || []);
        json.openPositionsCount = posArr.length;

        // Compute live stats from deal history (last 30 days)
        try {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 30);
          const deals = await mt5Service.getDealHistory(mt5Login, fromDate, new Date());
          const dealArr = Array.isArray(deals) ? deals : (deals?.deals || []);
          // Only count actual trade deals (not balance operations)
          const tradeDeals = dealArr.filter(d =>
            (d.action !== undefined ? (d.action === 0 || d.action === 1) : true) &&
            d.profit !== undefined && d.profit !== null
          );
          const totalTrades = tradeDeals.length;
          const winningTrades = tradeDeals.filter(d => parseFloat(d.profit) > 0).length;
          const totalProfit = tradeDeals.reduce((sum, d) => sum + (parseFloat(d.profit) || 0), 0);
          json.liveWinRate = totalTrades > 0 ? parseFloat((winningTrades / totalTrades * 100).toFixed(1)) : 0;
          json.liveTotalTrades = totalTrades;
          json.liveTotalProfit = parseFloat(totalProfit.toFixed(2));
        } catch (e) { /* deal history fetch failed, keep DB values */ }
      } catch (e) {
        // MT5 bridge unreachable — keep DB values
        console.error(`[CopyTrade] Live data fetch failed for ${mt5Login}:`, e.message);
      }
      return json;
    }));

    res.json(paginatedResponse(enriched, count, parseInt(page), parseInt(limit), 'Masters retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get master details — LIVE MT5 data, positions, deal history
 */
export const getMasterDetails = async (req, res, next) => {
  try {
    const { masterId } = req.params;

    const master = await CopyTradeMaster.findByPk(masterId, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }
      ]
    });

    if (!master) throw new NotFoundError('Master not found');

    const followerCount = await CopyTradeFollower.count({ where: { masterId, status: 'active' } });
    const json = master.toJSON();
    json.followerCount = followerCount;
    json.mt5Login = master.account?.mt5Login || null;

    const mt5Login = master.account?.mt5Login;
    if (mt5Login) {
      // LIVE account info — bridge returns { success, data: { balance, equity, ... } }
      try {
        const accRaw = await mt5Service.getAccountInfo(mt5Login);
        const accInfo = accRaw?.data || accRaw || {};
        json.liveAccount = {
          equity: accInfo.equity || 0,
          balance: accInfo.balance || 0,
          margin: accInfo.margin || 0,
          freeMargin: accInfo.margin_free || accInfo.freeMargin || 0,
          profit: accInfo.profit || 0, // unrealized P&L
          leverage: accInfo.leverage || 0
        };
      } catch (e) {
        console.error('[CopyTrade] getAccountInfo error:', e.message);
        json.liveAccount = null;
      }

      // LIVE open positions — bridge returns { positions: [...] } with type "BUY"/"SELL"
      try {
        const positions = await mt5Service.getOpenPositions(mt5Login);
        const posArr = Array.isArray(positions) ? positions : (positions?.positions || []);
        json.livePositions = posArr.map(p => {
          // Normalize type: bridge returns "BUY"/"SELL" strings, or numeric 0/1
          let tradeType = 'unknown';
          if (typeof p.type === 'string') {
            tradeType = p.type.toLowerCase(); // "BUY" → "buy", "SELL" → "sell"
          } else if (p.type === 0) {
            tradeType = 'buy';
          } else if (p.type === 1) {
            tradeType = 'sell';
          }
          return {
            ticket: p.ticket || p.position,
            symbol: p.symbol,
            type: tradeType,
            volume: p.volume || p.lots,
            openPrice: p.price_open || p.openPrice,
            currentPrice: p.price_current || p.currentPrice,
            profit: p.profit,
            swap: p.swap || 0,
            openTime: p.time_create || p.openTime
          };
        });
      } catch (e) { json.livePositions = []; }

      // LIVE deal history (last 30 days)
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        const deals = await mt5Service.getDealHistory(mt5Login, fromDate, new Date());
        const dealArr = Array.isArray(deals) ? deals : (deals?.deals || []);

        // Filter to actual trade entries/exits
        const tradeDeals = dealArr.filter(d => d.profit !== undefined && d.profit !== null);
        const totalTrades = tradeDeals.length;
        const winningTrades = tradeDeals.filter(d => parseFloat(d.profit) > 0).length;
        const losingTrades = tradeDeals.filter(d => parseFloat(d.profit) < 0).length;
        const totalProfit = tradeDeals.reduce((sum, d) => sum + (parseFloat(d.profit) || 0), 0);
        const winRate = totalTrades > 0 ? parseFloat((winningTrades / totalTrades * 100).toFixed(1)) : 0;

        json.liveStats = {
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          totalProfit: parseFloat(totalProfit.toFixed(2)),
          avgProfit: totalTrades > 0 ? parseFloat((totalProfit / totalTrades).toFixed(2)) : 0
        };

        // Recent deals for display (last 20)
        json.recentDeals = tradeDeals.slice(0, 20).map(d => ({
          deal: d.deal || d.ticket,
          symbol: d.symbol,
          type: d.action === 0 ? 'buy' : d.action === 1 ? 'sell' : (d.type_str || 'trade'),
          volume: d.volume || d.lots,
          price: d.price,
          profit: d.profit,
          commission: d.commission || 0,
          swap: d.swap || 0,
          time: d.time || d.time_create
        }));
      } catch (e) {
        json.liveStats = null;
        json.recentDeals = [];
      }
    }

    // Also include recent copy trades from DB
    const recentCopyTrades = await CopyTrade.findAll({
      where: { masterId },
      limit: 10,
      order: [['createdAt', 'DESC']]
    });
    json.recentCopyTrades = recentCopyTrades;

    res.json(successResponse(json, 'Master details retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get master's LIVE open positions (for followers to watch)
 */
export const getMasterLivePositions = async (req, res, next) => {
  try {
    const { masterId } = req.params;

    const master = await CopyTradeMaster.findByPk(masterId, {
      include: [{ model: Mt5Account, as: 'account', attributes: ['mt5Login'] }]
    });
    if (!master) throw new NotFoundError('Master not found');
    if (master.status !== 'approved') throw new BusinessError('Master is not active');

    const mt5Login = master.account?.mt5Login;
    if (!mt5Login) throw new BusinessError('Master has no MT5 account linked');

    // Fetch LIVE positions from MT5 bridge
    const positions = await mt5Service.getOpenPositions(mt5Login);
    const posArr = Array.isArray(positions) ? positions : (positions?.positions || []);

    // Fetch LIVE account info — bridge returns { success, data: { ... } }
    let accountInfo = {};
    try {
      const accRaw = await mt5Service.getAccountInfo(mt5Login) || {};
      accountInfo = accRaw?.data || accRaw || {};
    } catch (e) { /* ignore */ }

    const livePositions = posArr.map(p => {
      let tradeType = 'unknown';
      if (typeof p.type === 'string') tradeType = p.type.toLowerCase();
      else if (p.type === 0) tradeType = 'buy';
      else if (p.type === 1) tradeType = 'sell';
      return {
        ticket: p.ticket || p.position,
        symbol: p.symbol,
        type: tradeType,
        volume: p.volume || p.lots,
        openPrice: p.price_open || p.openPrice,
        currentPrice: p.price_current || p.currentPrice,
        profit: p.profit,
        swap: p.swap || 0,
        openTime: p.time_create || p.openTime
      };
    });

    res.json(successResponse({
      masterId: master.id,
      mt5Login,
      displayName: master.displayName,
      equity: accountInfo.equity || 0,
      balance: accountInfo.balance || 0,
      unrealizedPL: accountInfo.profit || 0,
      positions: livePositions,
      positionsCount: livePositions.length
    }, 'Live positions retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Build default followerSettings — all options enabled with wide limits
 */
const defaultFollowerSettings = () => ({
  allowCopyRatio:      true,
  copyRatioMin:        0.01,
  copyRatioMax:        10.0,
  allowFixedLot:       true,
  fixedLotMin:         0.01,
  fixedLotMax:         100.0,
  allowEquityPct:      true,
  equityPctMin:        1,
  equityPctMax:        100,
  allowMaxLotPerTrade: true,
  maxLotPerTradeMax:   50.0,
  maxFollowersPerUser: 5,
  defaultCopyRatio:    1.0,
});

/**
 * Validate follower's requested settings against the master's broker-controlled limits.
 * Returns validated/clamped values or throws BusinessError.
 */
function validateFollowerSettings(requested, masterSettings) {
  const s = { ...defaultFollowerSettings(), ...(masterSettings || {}) };
  const lotMode  = requested.lotMode || 'ratio';
  const allowed  = [];
  if (s.allowCopyRatio)      allowed.push('ratio');
  if (s.allowFixedLot)       allowed.push('fixed');
  if (s.allowEquityPct)      allowed.push('equity_pct');
  if (!allowed.length)       allowed.push('ratio'); // fallback

  if (!allowed.includes(lotMode)) {
    throw new BusinessError(`Lot mode '${lotMode}' is not allowed for this master`);
  }

  let copyRatio      = parseFloat(requested.copyRatio ?? s.defaultCopyRatio);
  let fixedLot       = requested.fixedLot       != null ? parseFloat(requested.fixedLot)       : null;
  let equityPct      = requested.equityPct      != null ? parseFloat(requested.equityPct)      : null;
  let maxLotPerTrade = requested.maxLotPerTrade != null ? parseFloat(requested.maxLotPerTrade) : null;

  // Validate copyRatio (used in ratio mode; also stored for reference in other modes)
  if (s.allowCopyRatio) {
    if (isNaN(copyRatio) || copyRatio < s.copyRatioMin || copyRatio > s.copyRatioMax) {
      throw new BusinessError(`Copy ratio must be between ${s.copyRatioMin} and ${s.copyRatioMax}`);
    }
  }

  // Validate fixed lot
  if (lotMode === 'fixed') {
    if (fixedLot == null || isNaN(fixedLot)) throw new BusinessError('Fixed lot size is required');
    if (fixedLot < s.fixedLotMin || fixedLot > s.fixedLotMax) {
      throw new BusinessError(`Fixed lot must be between ${s.fixedLotMin} and ${s.fixedLotMax}`);
    }
  }

  // Validate equity %
  if (lotMode === 'equity_pct') {
    if (equityPct == null || isNaN(equityPct)) throw new BusinessError('Equity % is required');
    if (equityPct < s.equityPctMin || equityPct > s.equityPctMax) {
      throw new BusinessError(`Equity % must be between ${s.equityPctMin} and ${s.equityPctMax}`);
    }
  }

  // Validate max lot per trade cap
  if (maxLotPerTrade != null && s.allowMaxLotPerTrade) {
    if (maxLotPerTrade > s.maxLotPerTradeMax) {
      throw new BusinessError(`Max lot per trade cannot exceed ${s.maxLotPerTradeMax}`);
    }
  } else {
    maxLotPerTrade = null; // not allowed or not set
  }

  return { lotMode, copyRatio, fixedLot, equityPct, maxLotPerTrade };
}

export const followMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;
    const {
      allocationAmount = 100,
      followerMt5AccountId,
      copyRatio,
      lotMode,
      fixedLot,
      equityPct,
      maxLotPerTrade,
    } = req.body;

    // ── Broker permission checks ──────────────────────────────────────────────
    const perms = await getPermissions();
    if (!perms.copy_allow_followers) {
      throw new BusinessError('Copy trading subscriptions are currently disabled on this platform.');
    }
    // Allocation limits
    const alloc = parseFloat(allocationAmount) || 100;
    if (perms.copy_min_allocation > 0 && alloc < perms.copy_min_allocation) {
      throw new BusinessError(`Minimum allocation is $${perms.copy_min_allocation}.`);
    }
    if (perms.copy_max_allocation > 0 && alloc > perms.copy_max_allocation) {
      throw new BusinessError(`Maximum allocation is $${perms.copy_max_allocation}.`);
    }
    // Lot mode allowed
    if (lotMode) {
      const allowedModes = (perms.copy_lot_modes_allowed || '').split(',').map(s => s.trim()).filter(Boolean);
      if (allowedModes.length > 0 && !allowedModes.includes(lotMode)) {
        throw new BusinessError(`Lot sizing mode "${lotMode}" is not allowed. Allowed: ${allowedModes.join(', ')}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const master = await CopyTradeMaster.findByPk(masterId, {
      include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }]
    });
    if (!master) throw new NotFoundError('Master not found');
    if (master.status !== 'approved') throw new BusinessError('This master is not available for copying');
    if (master.userId === req.user.id) throw new BusinessError('Cannot follow yourself');

    // Check if already following
    const existing = await CopyTradeFollower.findOne({
      where: { masterId, followerUserId: req.user.id, status: 'active' }
    });
    if (existing) throw new ConflictError('Already following this master');

    // Check platform-level max followers per master
    const platformMaxFollowers = perms.copy_max_followers_per_master;
    if (platformMaxFollowers > 0) {
      const currentFollowers = await CopyTradeFollower.count({ where: { masterId, status: 'active' } });
      if (currentFollowers >= platformMaxFollowers) {
        throw new BusinessError(`This master has reached the platform limit of ${platformMaxFollowers} followers.`);
      }
    }

    // Check master's own max followers (overrides platform if stricter)
    if (master.maxFollowers > 0) {
      const currentFollowers = await CopyTradeFollower.count({ where: { masterId, status: 'active' } });
      if (currentFollowers >= master.maxFollowers) throw new BusinessError('This master has reached maximum followers');
    }

    // Check max followers per user
    const effectiveSettings = { ...defaultFollowerSettings(), ...(master.followerSettings || {}) };
    const perUserMax = effectiveSettings.maxFollowersPerUser || 5;
    const userActiveCount = await CopyTradeFollower.count({
      where: { masterId, followerUserId: req.user.id, status: 'active' }
    });
    if (userActiveCount >= perUserMax) {
      throw new BusinessError(`You can follow this master with at most ${perUserMax} account(s)`);
    }

    // Check min investment
    if (parseFloat(allocationAmount) < parseFloat(master.minInvestment)) {
      throw new BusinessError(`Minimum investment is $${master.minInvestment}`);
    }

    // Validate & normalise broker-controlled settings
    const validated = validateFollowerSettings(
      { lotMode, copyRatio, fixedLot, equityPct, maxLotPerTrade },
      master.followerSettings
    );

    // Get follower's MT5 account
    let followerAccId = followerMt5AccountId;
    if (!followerAccId) {
      const userAccount = await Mt5Account.findOne({ where: { userId: req.user.id } });
      if (!userAccount) throw new BusinessError('You need an MT5 account to follow a master');
      followerAccId = userAccount.id;
    } else {
      const acc = await Mt5Account.findOne({ where: { id: followerAccId, userId: req.user.id } });
      if (!acc) throw new BusinessError('MT5 account not found or does not belong to you');
    }

    // Reactivate stopped subscription if exists
    const stopped = await CopyTradeFollower.findOne({
      where: { masterId, followerMt5AccountId: followerAccId, status: 'stopped' }
    });

    let follower;
    if (stopped) {
      await stopped.update({
        status: 'active',
        followerUserId: req.user.id,
        allocationAmount,
        ...validated,
        startedAt: new Date(),
        stoppedAt: null
      });
      follower = stopped;
    } else {
      follower = await CopyTradeFollower.create({
        masterId,
        followerMt5AccountId: followerAccId,
        followerUserId: req.user.id,
        allocationAmount,
        ...validated,
        status: 'active',
        startedAt: new Date()
      });
    }

    // Update master follower count
    const activeCount = await CopyTradeFollower.count({ where: { masterId, status: 'active' } });
    await master.update({ totalFollowers: activeCount });

    // Sync to local Redis + notify Gateway Manager
    const followerAcc = await Mt5Account.findByPk(followerAccId, { attributes: ['mt5Login'] });
    await syncToRedis(master.account?.mt5Login, followerAcc?.mt5Login, validated);
    notifyGateway('subscribe', master.account?.mt5Login, followerAcc?.mt5Login, validated);

    // Email: copy trade follow
    User.findByPk(req.user.id, { attributes: ['email', 'firstName'] }).then(u => {
      if (u) emailService.sendCopyTradeFollowEmail(u.email, u.firstName, {
        masterName: master.displayName || `Master #${masterId}`,
        allocation: allocationAmount,
        copyRatio: validated.copyRatio || 1
      }).catch(() => {});
    }).catch(() => {});

    res.status(201).json(successResponse(follower, 'Now following this master trader'));
  } catch (error) {
    next(error);
  }
};

export const unfollowMaster = async (req, res, next) => {
  try {
    const { masterId } = req.params;

    const follower = await CopyTradeFollower.findOne({
      where: { masterId, followerUserId: req.user.id, status: 'active' },
      include: [{ model: Mt5Account, as: 'followerAccount', attributes: ['mt5Login'] }]
    });
    if (!follower) throw new NotFoundError('Not following this master');

    await follower.update({ status: 'stopped', stoppedAt: new Date() });

    // Update master follower count
    const activeCount = await CopyTradeFollower.count({ where: { masterId, status: 'active' } });
    await CopyTradeMaster.update({ totalFollowers: activeCount }, { where: { id: masterId } });

    // Remove from Redis + notify Gateway Manager
    const master = await CopyTradeMaster.findByPk(masterId, {
      include: [{ model: Mt5Account, as: 'account', attributes: ['mt5Login'] }]
    });
    await removeFromRedis(master?.account?.mt5Login, follower.followerAccount?.mt5Login);
    notifyGateway('unsubscribe', master?.account?.mt5Login, follower.followerAccount?.mt5Login);

    res.json(successResponse(null, 'Master unfollowed'));
  } catch (error) {
    next(error);
  }
};

export const getUserFollowings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await CopyTradeFollower.findAndCountAll({
      where: { followerUserId: req.user.id },
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: CopyTradeMaster, as: 'master',
          include: [
            { model: User, attributes: ['firstName', 'lastName', 'email'], as: 'user' },
            { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login'] }
          ]
        },
        { model: Mt5Account, as: 'followerAccount', attributes: ['id', 'mt5Login', 'accountType'] },
        { model: CopyTradeSettings, as: 'settings' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Followings retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getUserCopyTrades = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's follower IDs
    const followerRecords = await CopyTradeFollower.findAll({
      where: { followerUserId: req.user.id },
      attributes: ['id']
    });
    const followerIds = followerRecords.map(f => f.id);

    if (followerIds.length === 0) {
      return res.json(paginatedResponse([], 0, parseInt(page), parseInt(limit), 'No copy trades'));
    }

    const { count, rows } = await CopyTrade.findAndCountAll({
      where: { followerId: followerIds },
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

export const updateFollowingSettings = async (req, res, next) => {
  try {
    const { followingId } = req.params;
    const {
      copyRatio, allocationAmount,
      lotMode, fixedLot, equityPct, maxLotPerTrade,
      maxTradeSize, stopLossPct, takeProfitPct, copyPendingOrders, reverseCopy
    } = req.body;

    // Broker permission: check if users are allowed to self-modify copy settings
    const perms = await getPermissions();
    if (perms.copy_user_can_modify_settings === false) {
      throw new BusinessError('Modifying copy trading settings is currently disabled. Please contact support.');
    }

    const follower = await CopyTradeFollower.findOne({
      where: { id: followingId, followerUserId: req.user.id },
      include: [{ model: CopyTradeMaster, as: 'master', attributes: ['followerSettings', 'minInvestment'] }]
    });
    if (!follower) throw new NotFoundError('Following not found');

    const followerUpdates = {};

    // Validate broker-controlled lot settings if any are being changed
    if (lotMode !== undefined || copyRatio !== undefined || fixedLot !== undefined ||
        equityPct !== undefined || maxLotPerTrade !== undefined) {
      const validated = validateFollowerSettings(
        {
          lotMode:        lotMode        ?? follower.lotMode,
          copyRatio:      copyRatio      ?? follower.copyRatio,
          fixedLot:       fixedLot       ?? follower.fixedLot,
          equityPct:      equityPct      ?? follower.equityPct,
          maxLotPerTrade: maxLotPerTrade ?? follower.maxLotPerTrade,
        },
        follower.master?.followerSettings
      );
      Object.assign(followerUpdates, validated);
    }

    if (allocationAmount !== undefined) {
      const minInv = parseFloat(follower.master?.minInvestment || 0);
      if (parseFloat(allocationAmount) < minInv) throw new BusinessError(`Minimum investment is $${minInv}`);
      followerUpdates.allocationAmount = allocationAmount;
    }

    if (Object.keys(followerUpdates).length > 0) await follower.update(followerUpdates);

    // Update advanced settings (CopyTradeSettings table)
    const settingsData = {};
    if (maxTradeSize      !== undefined) settingsData.maxTradeSize      = maxTradeSize;
    if (stopLossPct       !== undefined) settingsData.stopLossPct       = stopLossPct;
    if (takeProfitPct     !== undefined) settingsData.takeProfitPct     = takeProfitPct;
    if (copyPendingOrders !== undefined) settingsData.copyPendingOrders = copyPendingOrders;
    if (reverseCopy       !== undefined) settingsData.reverseCopy       = reverseCopy;

    if (Object.keys(settingsData).length > 0) {
      const [settings] = await CopyTradeSettings.findOrCreate({
        where: { followerId: follower.id },
        defaults: settingsData
      });
      if (!settings.isNewRecord) await settings.update(settingsData);
    }

    await follower.reload();

    // Re-sync Redis so engine gets updated lot settings immediately
    if (follower.status === 'active') {
      const masterRec = await CopyTradeMaster.findByPk(follower.masterId, {
        include: [{ model: Mt5Account, as: 'account', attributes: ['mt5Login'] }]
      });
      const followerAccRec = await Mt5Account.findByPk(follower.followerMt5AccountId, { attributes: ['mt5Login'] });
      await syncToRedis(masterRec?.account?.mt5Login, followerAccRec?.mt5Login, follower);
    }

    res.json(successResponse(follower, 'Settings updated'));
  } catch (error) {
    next(error);
  }
};

export const pauseFollowing = async (req, res, next) => {
  try {
    const { followingId } = req.params;
    const follower = await CopyTradeFollower.findOne({
      where: { id: followingId, followerUserId: req.user.id, status: 'active' },
      include: [
        { model: CopyTradeMaster, as: 'master', include: [{ model: Mt5Account, as: 'account', attributes: ['mt5Login'] }] },
        { model: Mt5Account, as: 'followerAccount', attributes: ['mt5Login'] }
      ]
    });
    if (!follower) throw new NotFoundError('Active following not found');
    await follower.update({ status: 'paused' });
    await removeFromRedis(follower.master?.account?.mt5Login, follower.followerAccount?.mt5Login);
    notifyGateway('unsubscribe', follower.master?.account?.mt5Login, follower.followerAccount?.mt5Login);
    res.json(successResponse(follower, 'Following paused'));
  } catch (error) {
    next(error);
  }
};

export const resumeFollowing = async (req, res, next) => {
  try {
    const { followingId } = req.params;
    const follower = await CopyTradeFollower.findOne({
      where: { id: followingId, followerUserId: req.user.id, status: 'paused' },
      include: [
        { model: CopyTradeMaster, as: 'master', include: [{ model: Mt5Account, as: 'account', attributes: ['mt5Login'] }] },
        { model: Mt5Account, as: 'followerAccount', attributes: ['mt5Login'] }
      ]
    });
    if (!follower) throw new NotFoundError('Paused following not found');
    await follower.update({ status: 'active' });
    await syncToRedis(follower.master?.account?.mt5Login, follower.followerAccount?.mt5Login, follower);
    notifyGateway('subscribe', follower.master?.account?.mt5Login, follower.followerAccount?.mt5Login, follower);
    res.json(successResponse(follower, 'Following resumed'));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// MAM (unchanged)
// ============================================================================

export const getManagers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await MamManager.findAndCountAll({
      where: { isActive: true },
      limit: parseInt(limit), offset,
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Managers retrieved'));
  } catch (error) { next(error); }
};

export const getManagerDetails = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const manager = await MamManager.findByPk(managerId, {
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' }]
    });
    if (!manager) throw new NotFoundError('Manager not found');
    const accountCount = await MamAccount.count({ where: { managerId } });
    res.json(successResponse({ ...manager.toJSON(), accountCount }, 'Manager details retrieved'));
  } catch (error) { next(error); }
};

export const investInMam = async (req, res, next) => {
  try {
    const { managerId, amount, allocationPct = 100 } = req.body;
    const manager = await MamManager.findByPk(managerId);
    if (!manager) throw new NotFoundError('Manager not found');
    const investorAccount = await Mt5Account.findOne({ where: { userId: req.user.id } });
    if (!investorAccount) throw new BusinessError('You need an MT5 account to invest in MAM');
    const mamAccount = await MamAccount.create({
      managerId, investorUserId: req.user.id, investorMt5AccountId: investorAccount.id,
      investedAmount: amount, allocationPct, currentValue: amount, status: 'active', joinedAt: new Date()
    });
    res.status(201).json(successResponse(mamAccount, 'Invested in MAM'));
  } catch (error) { next(error); }
};

export const getUserMamInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await MamAccount.findAndCountAll({
      where: { investorUserId: req.user.id }, limit: parseInt(limit), offset,
      include: [{ model: MamManager, as: 'manager', include: [{ model: User, attributes: ['firstName', 'lastName'], as: 'user' }] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'MAM investments retrieved'));
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

// ============================================================================
// PAMM (unchanged)
// ============================================================================

export const getPools = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await PammManager.findAndCountAll({
      where: { isActive: true }, limit: parseInt(limit), offset,
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Pools retrieved'));
  } catch (error) { next(error); }
};

export const getPoolDetails = async (req, res, next) => {
  try {
    const { poolId } = req.params;
    const pool = await PammManager.findByPk(poolId, {
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'], as: 'user' }]
    });
    if (!pool) throw new NotFoundError('Pool not found');
    const investorCount = await PammInvestor.count({ where: { pammManagerId: poolId } });
    res.json(successResponse({ ...pool.toJSON(), investorCount }, 'Pool details retrieved'));
  } catch (error) { next(error); }
};

export const investInPamm = async (req, res, next) => {
  try {
    const { poolId, amount } = req.body;
    const pool = await PammManager.findByPk(poolId);
    if (!pool) throw new NotFoundError('Pool not found');
    const pammInvestor = await PammInvestor.create({
      pammManagerId: poolId, investorUserId: req.user.id,
      investedAmount: amount, currentSharePct: 0, status: 'active', joinedAt: new Date()
    });
    res.status(201).json(successResponse(pammInvestor, 'Invested in PAMM'));
  } catch (error) { next(error); }
};

export const getUserPammInvestments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { count, rows } = await PammInvestor.findAndCountAll({
      where: { investorUserId: req.user.id }, limit: parseInt(limit), offset,
      include: [{ model: PammManager, as: 'manager', include: [{ model: User, attributes: ['firstName', 'lastName'], as: 'user' }] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'PAMM investments retrieved'));
  } catch (error) { next(error); }
};

export const updatePammAllocation = async (req, res, next) => {
  try {
    const { pammInvestorId } = req.params;
    const { investedAmount } = req.body;
    const pammInvestor = await PammInvestor.findByPk(pammInvestorId);
    if (!pammInvestor || pammInvestor.investorUserId !== req.user.id) throw new NotFoundError('PAMM investment not found');
    await pammInvestor.update({ investedAmount });
    res.json(successResponse(pammInvestor, 'PAMM allocation updated'));
  } catch (error) { next(error); }
};

export const stopPammInvestment = async (req, res, next) => {
  try {
    const { pammInvestorId } = req.params;
    const pammInvestor = await PammInvestor.findByPk(pammInvestorId);
    if (!pammInvestor || pammInvestor.investorUserId !== req.user.id) throw new NotFoundError('PAMM investment not found');
    await pammInvestor.update({ status: 'withdrawn' });
    res.json(successResponse(null, 'PAMM investment stopped'));
  } catch (error) { next(error); }
};

/**
 * Public copy trading config — returns broker-controlled permissions for the user portal.
 * No sensitive data — safe to call without auth.
 */
export const getCopyConfig = async (req, res, next) => {
  try {
    const perms = await getPermissions();
    res.json(successResponse({
      copy_user_can_modify_settings: perms.copy_user_can_modify_settings !== false,
      copy_allow_masters:    perms.copy_allow_masters    !== false,
      copy_allow_followers:  perms.copy_allow_followers  !== false,
    }, 'Config retrieved'));
  } catch (error) {
    next(error);
  }
};

export default {
  applyAsMaster, getMyMasterProfile, getCopyConfig,
  getMasters, getMasterDetails, getMasterLivePositions, followMaster, unfollowMaster, getUserFollowings, getUserCopyTrades,
  updateFollowingSettings, pauseFollowing, resumeFollowing,
  getManagers, getManagerDetails, investInMam, getUserMamInvestments, updateMamAllocation, stopMamInvestment,
  getPools, getPoolDetails, investInPamm, getUserPammInvestments, updatePammAllocation, stopPammInvestment
};
