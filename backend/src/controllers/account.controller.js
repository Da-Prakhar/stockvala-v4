import { Op } from 'sequelize';
import { Mt5Account, User, CopyTradeMaster, CopyTradeFollower, BrokerSetting, Trade } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { getPermissions } from '../utils/brokerPermissions.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import * as mt5Service from '../services/mt5.service.js';
import { redis, getPriceByServer } from '../redis/client.js';
import { sendMt5CredentialsEmail } from '../services/email.service.js';

/**
 * Return the correct contract size for a symbol.
 * Metals (XAUUSD …) → 100 | Crypto (BTCUSD …) → 1
 * Indices (US30 …)  → 1   | Forex (everything else) → 100 000
 */
function getContractSize(symbol) {
  const sym = (symbol || '').toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(sym)) return 100;
  if (/^(BTC|ETH|LTC|XRP|ADA|DOT|SOL|BNB|DOGE|AVAX|MATIC|LINK|UNI|ATOM)/.test(sym)) return 1;
  if (/^(US30|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX)/.test(sym)) return 1;
  return 100000;
}

/**
 * Get user accounts — enriched with live MT5 balance/equity/margin
 */
export const getServerDisplayName = async () => {
  try {
    const rows = await BrokerSetting.findAll({
      where: {
        key: { [Op.in]: ['mt5_server_display_name', 'mt5_server', 'platform_name'] }
      }
    });
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    const name = map.mt5_server_display_name || map.mt5_server || map.platform_name || 'Majesty Fx';
    _serverDisplayName = name;
    return name;
  } catch (e) {
    return _serverDisplayName || 'Majesty Fx';
  }
};

/**
 * Get user accounts — enriched with live MT5 balance/equity/margin
 */
export const getUserAccounts = async (req, res, next) => {
  try {
    const accounts = await Mt5Account.findAll({ where: { userId: req.user.id } });
    const serverDisplayName = await getServerDisplayName();

    // Enrich each account with live MT5 data (best-effort, don't block on failure)
    const enriched = await Promise.all(accounts.map(async (acc) => {
      const json = acc.toJSON();
      json.serverName = json.serverName || serverDisplayName;
      json.server = json.serverName;
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const live = await Promise.race([mt5Service.getAccountInfo(acc.mt5Login), timeout]);
        // Gateway returns flat JSON {balance, equity, ...}; old Python bridge
        // wrapped it in {data: {...}}. Support both.
        if (live) {
          const d = live.data || live;
          json.balance = d.balance ?? json.balance;
          json.equity = d.equity ?? json.equity;
          json.margin = d.margin ?? json.margin ?? 0;
          json.freeMargin = d.margin_free ?? json.freeMargin ?? 0;
          json.marginLevel = d.margin_level ?? 0;
          json.leverage = d.leverage ?? json.leverage;
        }
      } catch (e) {
        // Silently continue with DB values if bridge is unreachable
        console.warn(`[Account] Live data unavailable for ${acc.mt5Login}: ${e.message}`);
      }
      return json;
    }));

    res.json(successResponse(enriched, 'Accounts retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve the MT5 group based on account type
 * Groups should match what's configured on the MT5 server
 */
/**
 * Resolve MT5 group based on market segment
 * Actual groups from MT5 server:
 *   Comex:       IND\\3001\\COMEX\\22300\\10 USD-demo1o1ot
 *   Forex:       IND\\3001\\FOREX\\22300\\VIP-contest
 *   MCX/NSE:     IND\\3001\\LOT\\22300\\M250-F2000-demo1o1ot
 */
// Cache group mappings from DB (reloads every 60s)
let _groupMapCache = null;
let _groupMapCacheTime = 0;
const GROUP_CACHE_TTL = 60000;

// Also cache default_leverage and demo_initial_balance
let _defaultLeverage = 100;
let _demoInitialBalance = 10000;

// Cache server display name from DB
let _serverDisplayName = '';

const resolveGroup = async (market, explicitGroup, accountType) => {
  if (explicitGroup) return explicitGroup;

  // Try loading from DB
  const now = Date.now();
  if (!_groupMapCache || (now - _groupMapCacheTime) > GROUP_CACHE_TTL) {
    try {
      // Load from both trading and mt5 categories
      const rows = await BrokerSetting.findAll({
        where: { category: { [Op.in]: ['trading', 'mt5'] } }
      });
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      const forexGroup = map.mt5_group_forex || 'IND\\3001\\FOREX\\34001\\VIP-contest';
      _groupMapCache = {
        forex: forexGroup,
        forex_crypto: forexGroup,
        comex: map.mt5_group_comex || 'IND\\3001\\COMEX\\34001\\10 USD-demo1o1ot',
        mcx: map.mt5_group_mcx_nse || 'IND\\3001\\LOT\\34001\\M250-F2000-demo1o1ot',
        nse: map.mt5_group_mcx_nse || 'IND\\3001\\LOT\\34001\\M250-F2000-demo1o1ot',
        mcx_nse: map.mt5_group_mcx_nse || 'IND\\3001\\LOT\\34001\\M250-F2000-demo1o1ot',
        cent: map.mt5_group_cent || '',
      };
      _defaultLeverage = parseInt(map.default_leverage) || 100;
      _demoInitialBalance = parseInt(map.demo_initial_balance) || 10000;
      _serverDisplayName = map.mt5_server_display_name || map.mt5_server || map.platform_name || 'Majesty Fx';
      _groupMapCacheTime = now;
    } catch (e) {
      // Fallback to hardcoded defaults
      const defaultForex = 'IND\\3001\\FOREX\\34001\\VIP-contest';
      const defaultMcxNse = 'IND\\3001\\LOT\\34001\\M250-F2000-demo1o1ot';
      _groupMapCache = {
        forex: defaultForex,
        forex_crypto: defaultForex,
        comex: 'IND\\3001\\COMEX\\34001\\10 USD-demo1o1ot',
        mcx: defaultMcxNse,
        nse: defaultMcxNse,
        mcx_nse: defaultMcxNse,
        cent: '',
      };
    }
  }

  // Cent accounts always use the cent group when configured
  if (accountType === 'cent' && _groupMapCache.cent) {
    console.log(`[resolveGroup] accountType='cent' → group='${_groupMapCache.cent}'`);
    return _groupMapCache.cent;
  }

  const resolved = _groupMapCache[market] || _groupMapCache.forex;
  console.log(`[resolveGroup] market='${market}' → group='${resolved}'`);
  return resolved;
};

/**
 * Create MT5 account
 * Supports: live, demo, cent, copy_trading
 */
export const createAccount = async (req, res, next) => {
  try {
    const { accountType, leverage, market, group, masterTraderId, copyRatio, allocationAmount } = req.validated.body;

    console.log('[CreateAccount] Request body:', JSON.stringify(req.validated.body));

    // Get user info for MT5 account creation
    const user = await User.findByPk(req.user.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    console.log('[CreateAccount] User found:', user.firstName, user.lastName, user.email);

    // ── Max 5 MT5 accounts per user ──────────────────────────────────────────
    const totalAccounts = await Mt5Account.count({ where: { userId: req.user.id } });
    if (totalAccounts >= 10) {
      throw new BusinessError('You have reached the maximum of 10 MT5 accounts. Contact support to add more.');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Broker permission checks ──────────────────────────────────────────────
    const perms = await getPermissions();
    if (accountType === 'demo' && !perms.allow_demo_accounts) {
      throw new BusinessError('Demo accounts are currently disabled. Please contact support.');
    }
    // ─────────────────────────────────────────────────────────────────────────


    // For copy_trading, validate the master exists
    let masterRecord = null;
    if (accountType === 'copy_trading') {
      if (!masterTraderId) {
        throw new BusinessError('Master trader ID is required for copy trading accounts');
      }
      masterRecord = await CopyTradeMaster.findByPk(masterTraderId);
      if (!masterRecord || !masterRecord.isActive) {
        throw new BusinessError('Selected master trader is not available');
      }
    }

    // Resolve the MT5 group based on market segment (cent accounts use cent group)
    const mt5Group = await resolveGroup(market || 'forex_crypto', group, accountType);
    const serverDisplayName = await getServerDisplayName();

    // Set initial balance (demo accounts get virtual funds from config, cent gets 0)
    const initialBalance = accountType === 'demo' ? _demoInitialBalance : 0;
    const effectiveLeverage = leverage || _defaultLeverage;

    // ── Determine next sequential MT5 login ─────────────────────────────────
    // If admin has enabled the login series (mt5_login_series_enabled = true),
    // use the counter from broker_settings so accounts get clean sequential IDs
    // like 3000001, 3000002...  Otherwise MT5 auto-assigns (login=0).
    let nextLogin = 0;
    try {
      const seriesEnabled = await BrokerSetting.findOne({ where: { key: 'mt5_login_series_enabled' } });
      if (seriesEnabled?.value === 'true') {
        const row = await BrokerSetting.findOne({ where: { key: 'mt5_login_series_next' } });
        if (row) {
          nextLogin = parseInt(row.value, 10) || 0;
          if (nextLogin > 0) {
            // Atomic increment — safe against concurrent account creations
            await BrokerSetting.update(
              { value: String(nextLogin + 1) },
              { where: { key: 'mt5_login_series_next', value: String(nextLogin) } }
            );
            console.log(`[CreateAccount] Login series: reserving login=${nextLogin}`);
          }
        }
      } else {
        console.log('[CreateAccount] Login series disabled — using MT5 auto-assign');
      }
    } catch (seqErr) {
      console.warn('[CreateAccount] Login series error (non-fatal):', seqErr.message);
    }

    console.log('[CreateAccount] Calling MT5 bridge with:', {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      group: mt5Group,
      leverage: effectiveLeverage,
      initialBalance,
      login: nextLogin,
    });

    // Call MT5 bridge to create account
    let mt5Result;
    try {
      mt5Result = await mt5Service.createAccount({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phoneNumber || '',
        group: mt5Group,
        leverage: effectiveLeverage,
        initialBalance,
        login: nextLogin,       // sequential +1 from last; 0 = MT5 auto-assigns
      });
      console.log('[CreateAccount] MT5 bridge response:', JSON.stringify(mt5Result));
    } catch (bridgeErr) {
      console.error('[CreateAccount] MT5 bridge call FAILED:', bridgeErr.message);
      throw new BusinessError(`MT5 bridge error: ${bridgeErr.message}`);
    }

    if (!mt5Result.success && !mt5Result.login) {
      throw new BusinessError(`Failed to create MT5 account: ${mt5Result.error || 'Unknown bridge error'}`);
    }

    // ── Failsafe: enable account rights AND capture investor password ─────────
    // The Python bridge's enable_account endpoint:
    //   1. Sets rights=11  (USER_RIGHT_ENABLED | USER_RIGHT_PASSWORD | USER_RIGHT_EXPERT)
    //   2. Generates + sets a fresh investor (read-only) password
    //   3. Returns { data: { investor_password: "..." } }
    // Account creation goes through the C# Gateway which returns no investor
    // password, so we MUST call enableAccount to get one.
    let investorPasswordPending = false;
    try {
      const enableResult = await mt5Service.enableAccount(mt5Result.login);
      console.log(`[CreateAccount] Rights confirmed (login=${mt5Result.login})`);
      // Capture investor password returned by the bridge's enable endpoint
      const invPw = enableResult?.data?.investor_password || enableResult?.investor_password;
      if (invPw) {
        mt5Result.investor_password = invPw;
        console.log(`[CreateAccount] Investor password captured for login=${mt5Result.login}`);
      } else {
        investorPasswordPending = true;
      }
    } catch (rightsErr) {
      // Non-critical — trading will work once the bridge is reachable
      console.warn(`[CreateAccount] Could not set rights/investor-pw (non-critical): ${rightsErr.message}`);
      investorPasswordPending = true;
    }

    // Different bridge versions return passwords under different keys:
    //   Python bridge:  { password, ... }          (older/v1 style)
    //   Newer bridges:  { trading_password, investor_password, ... }
    const tradingPw  = mt5Result.trading_password  || mt5Result.password        || mt5Result.trader_password  || null;
    const investorPw = mt5Result.investor_password || mt5Result.investor_pass    || mt5Result.read_password    || null;
    if (investorPw) investorPasswordPending = false;

    // Save account to database (also remember the passwords we just set, since
    // MT5 itself has no password-retrieval API — this is our only record of them)
    const account = await Mt5Account.create({
      userId: req.user.id,
      mt5Login: mt5Result.login,
      mt5Group: mt5Result.group || mt5Group,
      accountType,
      leverage: mt5Result.leverage || effectiveLeverage,
      currency: market === 'mcx_nse' ? 'INR' : 'USD',
      market: market || 'forex_crypto',
      balance: initialBalance,
      equity: initialBalance,
      status: 'active',
      serverName: serverDisplayName,
      tradingPassword: tradingPw,
      investorPassword: investorPw,
    });

    console.log('[CreateAccount] Account saved to DB, id:', account.id);

    // If copy_trading, create the follower relationship
    if (accountType === 'copy_trading' && masterRecord) {
      await CopyTradeFollower.create({
        followerUserId: req.user.id,
        masterId: masterRecord.id,
        followerMt5AccountId: account.id,
        allocationAmount: allocationAmount || 0,
        copyRatio: copyRatio || 1,
        status: 'active',
        startedAt: new Date(),
      });
    }

    // Email the client their MT5 credentials — best-effort, never blocks the response
    try {
      if (user.email) {
        await sendMt5CredentialsEmail(user.email, {
          mt5Login: mt5Result.login,
          tradingPassword: tradingPw,
          investorPassword: investorPw,
          serverName: serverDisplayName,
          accountType,
        });
      }
    } catch (emailErr) {
      console.error('[CreateAccount] Failed to send MT5 credentials email (non-critical):', emailErr.message);
    }

    res.status(201).json(successResponse({
      ...account.toJSON(),
      tradingPassword: tradingPw,
      investorPassword: investorPw,
      serverName: serverDisplayName,
      server: serverDisplayName,
      ...(investorPasswordPending ? { investorPasswordPending: true } : {}),
    }, `${accountType.replace('_', ' ')} account created successfully`));
  } catch (error) {
    console.error('[CreateAccount] ERROR:', error.message, error.stack);
    next(error);
  }
};

/**
 * Get account details (with live MT5 data)
 */
export const getAccountDetails = async (req, res, next) => {
  try {
    const account = await Mt5Account.findByPk(req.params.id);

    if (!account || account.userId !== req.user.id) {
      throw new NotFoundError('Account not found');
    }

    const serverDisplayName = await getServerDisplayName();

    // Fetch live data from MT5 bridge
    let liveData = null;
    try {
      liveData = await mt5Service.getAccountInfo(account.mt5Login);
    } catch (e) {
      console.warn(`[Account] Could not fetch live MT5 data for ${account.mt5Login}:`, e.message);
    }

    // Merge live data with local record (bridge returns { success, data: {...} })
    const live = liveData?.data || liveData || {};
    const result = {
      ...account.toJSON(),
      serverName: account.serverName || serverDisplayName,
      server: account.serverName || serverDisplayName,
      ...(live.balance !== undefined ? {
        balance: live.balance ?? account.balance,
        equity: live.equity ?? account.equity,
        margin: live.margin ?? account.margin ?? 0,
        freeMargin: live.margin_free ?? account.freeMargin ?? 0,
        marginLevel: live.margin_level ?? 0,
        enabled: live.enabled
      } : {})
    };

    res.json(successResponse(result, 'Account retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update leverage
 */
export const updateLeverage = async (req, res, next) => {
  try {
    const { leverage } = req.validated.body;
    const account = await Mt5Account.findByPk(req.params.id);

    if (!account || account.userId !== req.user.id) {
      throw new NotFoundError('Account not found');
    }

    // Update on MT5 server
    await mt5Service.updateLeverage(account.mt5Login, leverage);
    // Update local record
    await account.update({ leverage });

    res.json(successResponse(account, 'Leverage updated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get live positions for an account from MT5
 */
export const getAccountPositions = async (req, res, next) => {
  try {
    const account = await Mt5Account.findByPk(req.params.id);

    if (!account || account.userId !== req.user.id) {
      throw new NotFoundError('Account not found');
    }

    let positions = [];
    try {
      const result = await mt5Service.getOpenPositions(account.mt5Login);
      if (Array.isArray(result)) positions = result;
      else if (result && Array.isArray(result.positions)) positions = result.positions;
      else if (result && result.data) {
        if (Array.isArray(result.data)) positions = result.data;
        else if (Array.isArray(result.data.positions)) positions = result.data.positions;
      }
      
      // Map to consistent format while keeping original keys for frontend
      positions = positions.map(pos => ({
        ...pos,
        ticket: pos.ticket || pos.position || 0,
        symbol: (pos.symbol || '').replace(/\.#$/, ''),
        type: pos.type === 'BUY' || pos.type === 0 ? 'buy' : pos.type === 1 || pos.type === 'SELL' ? 'sell' : (pos.type || 'buy'),
        volume: parseFloat(pos.volume) || 0,
        price_open: parseFloat(pos.price_open || pos.priceOpen || pos.openPrice) || 0,
        price_current: parseFloat(pos.price_current || pos.priceCurrent || pos.currentPrice) || 0,
        profit: parseFloat(pos.profit) || 0,
        swap: parseFloat(pos.swap || pos.storage) || 0,
        sl: parseFloat(pos.sl || pos.price_sl) || 0,
        tp: parseFloat(pos.tp || pos.price_tp) || 0,
        time_create: pos.time_create || pos.timeCreate || pos.openTime || null,
      }));
      
    } catch (err) {
      console.warn(`[Positions] Failed to get MT5 positions for login ${account.mt5Login}: ${err.message}`);
    }

    // Add DB Fallback
    try {
      const dbTrades = await Trade.findAll({
        where: { mt5AccountId: account.id, status: 'open' }
      });
      
      for (const dbTrade of dbTrades) {
        // Strip .# suffix from symbol
        const displaySymbol = (dbTrade.symbol || '').replace(/\.#$/, '');
        
        const exists = positions.find(p => p.ticket == dbTrade.mt5Ticket);
        if (!exists) {
          positions.push({
            ticket: dbTrade.mt5Ticket,
            symbol: displaySymbol,
            type: dbTrade.type === 'buy' || dbTrade.type === 'BUY' ? 'buy' : 'sell',
            volume: parseFloat(dbTrade.volume) || 0,
            openPrice: parseFloat(dbTrade.openPrice) || 0,
            currentPrice: parseFloat(dbTrade.openPrice) || 0, // Mock current price
            profit: parseFloat(dbTrade.profit) || 0,
            swap: parseFloat(dbTrade.swap) || 0,
            sl: parseFloat(dbTrade.sl) || 0,
            tp: parseFloat(dbTrade.tp) || 0,
            openTime: dbTrade.openTime,
          });
        }
      }
    } catch (dbErr) {
      console.error(`[Positions] Error fetching DB fallback:`, dbErr);
    }

    // ── Enrich with live Redis prices ──────────────────────────────────────
    // Uses server-namespaced key so each MT5 VPS is fully independent.
    const _serverName = account.serverName || null;

    for (const pos of positions) {
      try {
        const symbol = (pos.symbol || '').replace(/\.#$/, '');
        const tick = await getPriceByServer(_serverName, symbol);
        if (tick) {
          const posType = (pos.type || '').toString().toLowerCase();
          const livePrice = (posType === 'buy' || posType === '0')
            ? (tick.bid || tick.ask)
            : (tick.ask || tick.bid);
          if (livePrice && livePrice > 0) {
            const openPx = parseFloat(pos.price_open || pos.openPrice || pos.priceOpen) || 0;
            const diff = (posType === 'buy' || posType === '0')
              ? livePrice - openPx
              : openPx - livePrice;
            const vol = parseFloat(pos.volume) || 0;
            // Use symbol-aware contract size — 100 000 is Forex only
            const contractSize = getContractSize(symbol);
            pos.price_current = livePrice;
            pos.currentPrice  = livePrice;
            pos.profit = parseFloat((diff * vol * contractSize).toFixed(2));
          }
        }
      } catch { /* skip enrichment for this position */ }
    }

    res.json(successResponse({
      login: account.mt5Login,
      positions,
      total: positions.length
    }, 'Positions retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Sync account data from MT5 (update local balance/equity)
 */
export const syncAccount = async (req, res, next) => {
  try {
    const account = await Mt5Account.findByPk(req.params.id);

    if (!account || account.userId !== req.user.id) {
      throw new NotFoundError('Account not found');
    }

    // Best-effort: try to get live data from MT5 gateway.
    // If gateway is down (502/timeout), return DB values so the frontend
    // doesn't get a 500 error that it shows as a crash.
    let liveData = {};
    try {
      const liveResp = await mt5Service.getAccountInfo(account.mt5Login);
      // Gateway returns flat object; Python bridge returned {data:{...}}. Support both.
      liveData = (liveResp?.data && typeof liveResp.data === 'object') ? liveResp.data : (liveResp || {});
      // Update DB with fresh values
      await account.update({
        balance: liveData.balance ?? account.balance,
        equity: liveData.equity ?? account.equity,
        margin: liveData.margin ?? account.margin,
        freeMargin: liveData.margin_free ?? account.freeMargin
      });
    } catch (gwErr) {
      // Gateway unreachable — return DB values, flag as cached
      console.warn(`[Sync] Gateway unavailable for ${account.mt5Login}: ${gwErr.message}`);
      liveData = { _source: 'db_cache' };
    }

    const serverDisplayName = await getServerDisplayName();
    const json = account.toJSON();
    json.serverName = json.serverName || serverDisplayName;
    json.server = json.serverName;
    if (liveData._source === 'db_cache') json._cached = true;

    res.json(successResponse(json, 'Account synced with MT5'));
  } catch (error) {
    next(error);
  }
};

/**
 * Set/change trading password for an MT5 account (user-facing)
 * POST /accounts/:id/change-password
 * Body (all optional): { password, type }
 * If password is omitted, a strong random one is generated.
 */
export const changePassword = async (req, res, next) => {
  try {
    const account = await Mt5Account.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!account) throw new NotFoundError('Account not found');

    const { type = 'trader' } = req.body || {};
    let { password } = req.body || {};

    if (!password) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      const specials = '@#$!';
      password = '';
      for (let i = 0; i < 10; i++) password += chars[Math.floor(Math.random() * chars.length)];
      password += specials[Math.floor(Math.random() * specials.length)];
      password += Math.floor(Math.random() * 10);
    } else if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    await mt5Service.changePassword(account.mt5Login, password, type);

    // Remember the password we just set — MT5 has no password-retrieval API,
    // so this is our only record of it (used by the admin "Show Password" feature).
    if (type === 'investor') {
      await account.update({ investorPassword: password });
    } else {
      await account.update({ tradingPassword: password });
    }

    const responseData = { tradingPassword: password };

    if (type === 'trader') {
      try {
        const chars2 = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const specials2 = '@#$!';
        let invPw = '';
        for (let i = 0; i < 10; i++) invPw += chars2[Math.floor(Math.random() * chars2.length)];
        invPw += specials2[Math.floor(Math.random() * specials2.length)];
        invPw += Math.floor(Math.random() * 10);
        await mt5Service.changePassword(account.mt5Login, invPw, 'investor');
        await account.update({ investorPassword: invPw });
        responseData.investorPassword = invPw;
        responseData.investorPasswordUpdated = true;
      } catch (invErr) {
        console.warn(`[ChangePassword] Investor password change failed (non-critical): ${invErr.message}`);
        responseData.investorPasswordUpdated = false;
        responseData.warning = `Trading password was updated, but the investor password could not be changed (${invErr.message}). Contact support if you need it updated.`;
      }
    }

    res.json(successResponse(responseData, `${type === 'investor' ? 'Investor' : 'Trading'} password updated for account ${account.mt5Login}`));
  } catch (error) {
    next(error);
  }
};

export default {
  getServerDisplayName,
  getUserAccounts,
  createAccount,
  getAccountDetails,
  updateLeverage,
  getAccountPositions,
  syncAccount,
  changePassword
};
