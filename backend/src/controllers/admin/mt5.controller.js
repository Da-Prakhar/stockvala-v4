import { Mt5Account, User, BrokerSetting, Wallet, WalletTransaction } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import * as mt5Service from '../../services/mt5.service.js';
import axios from 'axios';
import { getServerDisplayName } from '../account.controller.js';

/**
 * Reserve the next sequential MT5 login ID from broker_settings.
 * Returns null if the series feature is disabled or not configured.
 * Reads + increments the counter in a single atomic UPDATE so two
 * concurrent account creations can never get the same login number.
 */
async function reserveNextLogin() {
  try {
    // Check if feature is enabled
    const enabled = await BrokerSetting.findOne({ where: { key: 'mt5_login_series_enabled' } });
    if (!enabled || enabled.value !== 'true') return null;

    const row = await BrokerSetting.findOne({ where: { key: 'mt5_login_series_next' } });
    if (!row) return null;

    const loginHint = parseInt(row.value, 10);
    if (!loginHint || loginHint <= 0) return null;

    // Atomic increment — only update if value still matches what we read
    // (optimistic concurrency: if two requests race, the second gets loginHint+1)
    await BrokerSetting.update(
      { value: String(loginHint + 1) },
      { where: { key: 'mt5_login_series_next', value: String(loginHint) } }
    );

    return loginHint;
  } catch (err) {
    console.warn('[MT5] reserveNextLogin error (non-fatal):', err.message);
    return null;
  }
}

/**
 * Write a WalletTransaction so the client can see admin-initiated MT5 operations.
 * The wallet balance is NOT changed — funds move directly in MT5.
 */
const logClientTransaction = async ({ userId, type, amount, mt5Login, description, referenceType }) => {
  try {
    let wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0, currency: 'USD' });
    const bal = parseFloat(wallet.balance) || 0;
    await WalletTransaction.create({
      walletId: wallet.id,
      type,
      amount: type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount),
      balanceBefore: bal,
      balanceAfter: bal,   // wallet balance unchanged — MT5 direct
      referenceType,
      description,
    });
  } catch (err) {
    console.warn('[MT5Ctrl] Failed to log client transaction (non-critical):', err.message);
  }
};

/**
 * Quick-fail wrapper — rejects after `ms` so the browser connection isn't held open
 */
const withTimeout = (promise, ms = 5000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Bridge timeout')), ms))
  ]);

/**
 * MT5 Health Check (5s timeout so it doesn't block the browser connection pool)
 */
export const healthCheck = async (req, res, next) => {
  try {
    const result = await withTimeout(mt5Service.ping(), 5000);
    res.json(successResponse(result, 'MT5 health check'));
  } catch (error) {
    // Return a structured error instead of hanging — the frontend can show "Disconnected"
    res.json(successResponse({ status: 'error', connected: false, message: error.message }, 'MT5 health check'));
  }
};

/**
 * Connect to MT5 server
 * If no body params, reads credentials from DB/env via getStoredConfig()
 */
export const connectServer = async (req, res, next) => {
  try {
    let { server, login, password } = req.body || {};

    // If not provided in body, use stored config (DB → env fallback)
    if (!server || !login) {
      const stored = await mt5Service.getStoredConfig();
      server = server || stored.server;
      login = login || stored.managerLogin;
      password = password || stored.managerPassword;
    }

    if (!server || !login) {
      throw new BusinessError('MT5 server and manager login are required. Configure them in Settings → MT5 Configuration.');
    }

    const result = await mt5Service.connect(server, login, password);
    res.json(successResponse(result, 'Connected to MT5 server'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update MT5 Bridge configuration
 */
export const updateConfig = async (req, res, next) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await BrokerSetting.upsert({ key, value, category: 'mt5' });
    }
    // Reload bridge config in memory
    await mt5Service.reloadConfigFromDB?.();
    res.json(successResponse({}, 'MT5 Bridge configuration updated'));
  } catch (error) {
    next(error);
  }
};

/**
 * List all MT5 accounts from server
 */
export const listMT5Accounts = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (status) where.status = status;
    const { count, rows } = await Mt5Account.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    res.json(successResponse({ accounts: rows, total: count, page: parseInt(page), limit: parseInt(limit) }, 'MT5 accounts retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Create MT5 account (admin creates for a user)
 */
export const createMT5Account = async (req, res, next) => {
  try {
    const { userId, group, leverage, password } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Reserve sequential login ID if the series feature is enabled in broker settings
    const loginHint = await reserveNextLogin();
    if (loginHint) {
      console.log(`[MT5] Sequential login series: reserving login=${loginHint} for user ${userId}`);
    }

    // Create on MT5 server
    const mt5Result = await mt5Service.createAccount({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phoneNumber || '',
      password: password || '',
      group: group || 'demo\\\\default',
      leverage: leverage || 100,
      initialBalance: 0,
      loginHint,          // null if series disabled; gateway uses it as MT5 login suggestion
    });

    if (!mt5Result.login) {
      return res.status(500).json({ success: false, message: 'MT5 account creation failed', error: mt5Result.error });
    }

    // Sync the series counter to actual assigned login + 1.
    // MT5 may ignore our hint (e.g. if the number is taken) — this keeps the counter accurate.
    if (loginHint) {
      const actualLogin = parseInt(mt5Result.login, 10);
      const nextAfterActual = actualLogin + 1;
      await BrokerSetting.update(
        { value: String(nextAfterActual) },
        { where: { key: 'mt5_login_series_next' } }
      );
      console.log(`[MT5] Series counter updated → next=${nextAfterActual} (actual assigned login=${actualLogin})`);
    }

    const serverDisplayName = await getServerDisplayName();

    // Different bridge versions return passwords under different keys
    const tradingPw  = mt5Result.trading_password  || mt5Result.password        || mt5Result.trader_password  || null;
    const investorPw = mt5Result.investor_password || mt5Result.investor_pass    || mt5Result.read_password    || null;

    // Save to local database (also remember the passwords — MT5 has no
    // password-retrieval API, so this is our only record of them)
    const account = await Mt5Account.create({
      userId: user.id,
      mt5Login: mt5Result.login,
      mt5Group: mt5Result.group || group,
      accountType: (group && group.includes('demo')) ? 'demo' : 'live',
      leverage: mt5Result.leverage || leverage,
      balance: 0,
      equity: 0,
      status: 'active',
      serverName: serverDisplayName,
      tradingPassword: tradingPw,
      investorPassword: investorPw,
    });

    res.status(201).json(successResponse({
      account: account.toJSON(),
      tradingPassword: tradingPw,
      investorPassword: investorPw
    }, 'MT5 account created'));
  } catch (error) {
    next(error);
  }
};

/**
 * Link an existing MT5 account to a user (admin-only, for accounts created in MT5 Manager)
 * POST /api/admin/mt5/accounts/link
 */
export const linkMT5Account = async (req, res, next) => {
  try {
    const { userId, mt5Login, accountType = 'live', leverage = 100 } = req.body;

    if (!userId || !mt5Login) {
      return res.status(400).json({ success: false, message: 'userId and mt5Login are required' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already linked
    const existing = await Mt5Account.findOne({ where: { mt5Login: String(mt5Login) } });
    if (existing) {
      return res.status(409).json({ success: false, message: `MT5 login ${mt5Login} is already linked to user ${existing.userId}` });
    }

    // Fetch live account info from gateway to get real balance/equity
    let balance = 0, equity = 0, mt5Group = '', serverName = '';
    try {
      const info = await mt5Service.getAccountInfo(String(mt5Login));
      const d = info?.data || info;
      balance = parseFloat(d?.balance) || 0;
      equity = parseFloat(d?.equity) || 0;
      mt5Group = d?.group || '';
      serverName = await getServerDisplayName();
    } catch { /* use defaults if gateway unavailable */ }

    const account = await Mt5Account.create({
      userId,
      mt5Login: String(mt5Login),
      mt5Group,
      accountType,
      leverage,
      balance,
      equity,
      status: 'active',
      serverName
    });

    console.log(`[Admin] Linked MT5 ${mt5Login} to user ${userId}`);

    res.status(201).json(successResponse({ account: account.toJSON() }, `MT5 account ${mt5Login} linked to ${user.firstName} ${user.lastName}`));
  } catch (error) {
    next(error);
  }
};

/**
 * Get MT5 account details from bridge (live data)
 */
export const getAccountDetails = async (req, res, next) => {
  try {
    const { login } = req.params;
    const result = await withTimeout(mt5Service.getAccountInfo(login), 8000);
    res.json(successResponse(result, 'Account details retrieved'));
  } catch (error) {
    // Return partial data instead of hanging the browser connection
    if (error.message === 'Bridge timeout') {
      return res.json(successResponse({ login, balance: 0, equity: 0, error: 'MT5 unreachable' }, 'Account details unavailable'));
    }
    next(error);
  }
};

/**
 * Deposit funds to MT5 account
 */
export const depositFunds = async (req, res, next) => {
  try {
    const { login, amount, comment } = req.body;
    const note = comment || `Direct deposit by admin`;
    const result = await withTimeout(mt5Service.deposit(login, amount, note), 9000);

    // Log so the client can see it in their wallet history
    const account = await Mt5Account.findOne({ where: { mt5Login: String(login) } });
    if (account?.userId) {
      await logClientTransaction({
        userId: account.userId,
        type: 'deposit',
        amount: parseFloat(amount),
        mt5Login: login,
        description: `Admin deposit — MT5 account ${login}${comment ? ': ' + comment : ''}`,
        referenceType: 'admin_mt5_deposit',
      });
    }

    res.json(successResponse(result, 'Deposit successful'));
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw funds from MT5 account
 */
export const withdrawFunds = async (req, res, next) => {
  try {
    const { login, amount, comment } = req.body;
    const note = comment || `Direct withdrawal by admin`;
    const result = await withTimeout(mt5Service.withdraw(login, amount, note), 9000);

    // Log so the client can see it in their wallet history
    const account = await Mt5Account.findOne({ where: { mt5Login: String(login) } });
    if (account?.userId) {
      await logClientTransaction({
        userId: account.userId,
        type: 'withdrawal',
        amount: parseFloat(amount),
        mt5Login: login,
        description: `Admin withdrawal — MT5 account ${login}${comment ? ': ' + comment : ''}`,
        referenceType: 'admin_mt5_withdrawal',
      });
    }

    res.json(successResponse(result, 'Withdrawal successful'));
  } catch (error) {
    next(error);
  }
};

/**
 * Unwrap positions from bridge response (bridge double-wraps: { success, data: [...] })
 */
function extractPositions(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (raw?.positions && Array.isArray(raw.positions)) return raw.positions;
  return [];
}

/**
 * Get all open positions
 */
export const getAllPositions = async (req, res, next) => {
  try {
    // Gather positions from all active MT5 accounts via gateway
    const accounts = await Mt5Account.findAll({ where: { status: 'active' }, attributes: ['mt5Login'], limit: 100 });
    const allPositions = [];
    await Promise.allSettled(accounts.map(async (acc) => {
      try {
        const raw = await mt5Service.getOpenPositions(String(acc.mt5Login));
        extractPositions(raw).forEach(p => allPositions.push({ ...p, login: acc.mt5Login }));
      } catch { /* skip failed accounts */ }
    }));
    res.json(successResponse({ positions: allPositions, total: allPositions.length }, 'All positions retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get positions for a specific login
 */
export const getPositionsByLogin = async (req, res, next) => {
  try {
    const { login } = req.params;
    const raw = await mt5Service.getOpenPositions(login);
    res.json(successResponse({ positions: extractPositions(raw) }, 'Positions retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get deal history for a specific login
 */
export const getDealHistory = async (req, res, next) => {
  try {
    const { login } = req.params;
    const { from, to } = req.query;
    const raw = await mt5Service.getDealHistory(login, from || null, to || null);
    let deals = [];
    if (Array.isArray(raw)) deals = raw;
    else if (raw?.data && Array.isArray(raw.data)) deals = raw.data;
    else if (raw?.deals && Array.isArray(raw.deals)) deals = raw.deals;
    res.json(successResponse({ deals }, 'Deal history retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get available trading groups
 */
export const getGroups = async (req, res, next) => {
  try {
    const result = await withTimeout(mt5Service.getGroups(), 5000);
    res.json(successResponse(result, 'Groups retrieved'));
  } catch (error) {
    // Return empty groups instead of hanging when bridge is down
    res.json(successResponse({ groups: [] }, 'Groups unavailable — bridge offline'));
  }
};

/**
 * Get risk monitor data
 */
export const getRiskMonitor = async (req, res, next) => {
  try {
    const { login } = req.params;
    const result = await mt5Service.getRiskMonitor(login);
    res.json(successResponse(result, 'Risk data retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get IB hierarchy
 */
export const getIBHierarchy = async (req, res, next) => {
  try {
    const { masterLogin } = req.params;
    const result = await mt5Service.getIBHierarchy(masterLogin);
    res.json(successResponse(result, 'IB hierarchy retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Change account leverage
 */
export const changeLeverage = async (req, res, next) => {
  try {
    const { login, leverage } = req.body;
    const result = await mt5Service.updateLeverage(login, leverage);

    // Also update local DB if we have the account
    const account = await Mt5Account.findOne({ where: { mt5Login: login } });
    if (account) {
      await account.update({ leverage });
    }

    res.json(successResponse(result, 'Leverage updated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Change MT5 account password (trader or investor)
 */
export const changeAccountPassword = async (req, res, next) => {
  try {
    const { login } = req.params;
    const { password, type } = req.body; // type: 'trader' or 'investor'

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Call the bridge — it uses /users/:login/password
    const result = await withTimeout(mt5Service.changePassword(login, password, type || 'trader'), 9000);

    // Remember the password we just set — MT5 has no password-retrieval API,
    // so this is our only record of it (used by the admin "Show Password" feature).
    const account = await Mt5Account.findOne({ where: { mt5Login: String(login) } });
    if (account) {
      if (type === 'investor') {
        await account.update({ investorPassword: password });
      } else {
        await account.update({ tradingPassword: password });
      }
    }

    res.json(successResponse(result, `${type === 'investor' ? 'Investor' : 'Trader'} password changed for account ${login}`));
  } catch (error) {
    next(error);
  }
};

/**
 * Get the last known MT5 password(s) for an account, as remembered by our system.
 * MT5's bridge API has no password-retrieval endpoint — passwords can only be
 * set, never read back — so this returns whatever we captured/stored ourselves
 * the last time a password was set (on creation or via change-password).
 * GET /admin/mt5/accounts/:login/password
 */
export const getAccountPassword = async (req, res, next) => {
  try {
    const { login } = req.params;
    const account = await Mt5Account.findOne({ where: { mt5Login: String(login) } });
    if (!account) throw new NotFoundError('Account not found');

    res.json(successResponse({
      tradingPassword: account.tradingPassword || null,
      investorPassword: account.investorPassword || null,
    }, 'Stored MT5 passwords retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Sync user accounts from MT5
 */
export const syncUserAccounts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await mt5Service.syncUserAccounts(userId);
    res.json(successResponse(result, 'Accounts synced'));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// TEST CONNECTION — pings bridge URL from DB settings (not the live mt5Service)
// ============================================================================

/**
 * Test MT5 bridge connection using settings from BrokerSetting table.
 * This lets admins verify their config before saving/applying.
 * Body (optional): { bridgeUrl, apiKey } — overrides DB values for the test.
 */
export const testConnection = async (req, res, next) => {
  try {
    let bridgeUrl = req.body?.bridgeUrl;
    let apiKey = req.body?.apiKey;

    // If not provided in body, read from DB settings
    if (!bridgeUrl) {
      const setting = await BrokerSetting.findOne({ where: { key: 'mt5_bridge_url' } });
      bridgeUrl = setting?.value || process.env.PYTHON_BRIDGE_URL || '';
    }
    if (!apiKey) {
      const setting = await BrokerSetting.findOne({ where: { key: 'mt5_api_key' } });
      apiKey = setting?.value || process.env.PYTHON_BRIDGE_API_KEY || '';
    }

    // Clean up URL
    bridgeUrl = bridgeUrl.replace(/\/+$/, '');

    const startTime = Date.now();
    try {
      const response = await axios.get(`${bridgeUrl}/health`, {
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      const latency = Date.now() - startTime;

      res.json(successResponse({
        connected: true,
        bridgeUrl,
        latencyMs: latency,
        bridgeStatus: response.data?.status || 'ok',
        server: response.data?.server || response.data?.mt5_server || null,
        version: response.data?.version || null,
        uptime: response.data?.uptime || null,
      }, 'MT5 bridge connection successful'));
    } catch (pingErr) {
      const latency = Date.now() - startTime;
      res.json(successResponse({
        connected: false,
        bridgeUrl,
        latencyMs: latency,
        error: pingErr.code === 'ECONNREFUSED' ? 'Connection refused — bridge is not running'
          : pingErr.code === 'ENOTFOUND' ? 'Host not found — check the URL'
          : pingErr.code === 'ETIMEDOUT' ? 'Connection timed out'
          : pingErr.response?.status === 401 ? 'Authentication failed — check API key'
          : pingErr.response?.status === 403 ? 'Forbidden — check API key'
          : pingErr.message
      }, 'MT5 bridge connection failed'));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Reload MT5 service config from DB settings.
 * Called after saving new settings so the running service picks them up.
 */
export const reloadConfig = async (req, res, next) => {
  try {
    await mt5Service.reloadConfigFromDB();
    res.json(successResponse(null, 'MT5 service configuration reloaded from database'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current MT5 configuration (from DB → env fallback).
 * Password is masked for security.
 */
export const getConfig = async (req, res, next) => {
  try {
    const stored = await mt5Service.getStoredConfig();

    // Also read group mappings from DB
    const groupRows = await BrokerSetting.findAll({ where: { category: 'trading' } });
    const groupMap = {};
    groupRows.forEach(r => { groupMap[r.key] = r.value; });

    // Read all mt5-category settings for the full picture
    const mt5Rows = await BrokerSetting.findAll({ where: { category: 'mt5' } });
    const mt5Settings = {};
    mt5Rows.forEach(r => { mt5Settings[r.key] = r.value; });

    res.json(successResponse({
      bridgeUrl: stored.bridgeUrl,
      apiKey: stored.apiKey ? '••••' + stored.apiKey.slice(-4) : '',
      apiKeySet: !!stored.apiKey,
      server: stored.server,
      managerLogin: stored.managerLogin,
      managerPasswordSet: !!stored.managerPassword,
      // Group mappings
      mt5_group_forex: groupMap.mt5_group_forex || mt5Settings.mt5_group_forex || '',
      mt5_group_comex: groupMap.mt5_group_comex || mt5Settings.mt5_group_comex || '',
      mt5_group_mcx_nse: groupMap.mt5_group_mcx_nse || mt5Settings.mt5_group_mcx_nse || '',
      mt5_group_cent: groupMap.mt5_group_cent || mt5Settings.mt5_group_cent || '',
      // Extra settings
      default_leverage: mt5Settings.default_leverage || '100',
      demo_initial_balance: mt5Settings.demo_initial_balance || '10000',
    }, 'MT5 configuration retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * ── B-BOOK RISK MONITOR ─────────────────────────────────────────────────────
 * Aggregates risk data across ALL active accounts:
 *  • stop-out risk (margin level < 120 %)
 *  • scalpers (avg closed trade duration < 15 min)
 *  • serial winners / losers (win-rate in last 24 h)
 *  • net broker exposure per symbol
 *  • biggest open P&L (both directions)
 */
export const getBBookRiskMonitor = async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;   // how many hours of deal history to scan

    // 1. All active MT5 accounts from DB
    const accounts = await Mt5Account.findAll({
      where: { status: 'active' },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      limit: 300,
      order: [['updatedAt', 'DESC']],
    });

    const TIMEOUT = 2500;
    const safe = (promise) => Promise.race([promise, new Promise(r => setTimeout(() => r(null), TIMEOUT))]);

    // 2. Parallel fetch: account info + open positions for every account
    const enriched = await Promise.all(accounts.map(async (acc) => {
      const login = acc.mt5Login;
      const [info, posRaw] = await Promise.all([
        safe(mt5Service.getAccountInfo(login).catch(() => null)),
        safe(mt5Service.getOpenPositions(login).catch(() => null)),
      ]);

      const equity   = parseFloat(info?.equity   ?? info?.Equity   ?? acc.equity   ?? 0);
      const balance  = parseFloat(info?.balance  ?? info?.Balance  ?? acc.balance  ?? 0);
      const margin   = parseFloat(info?.margin   ?? info?.Margin   ?? 0);
      const freeMargin = parseFloat(info?.freeMargin ?? info?.FreeMargin ?? 0);
      const marginLevel = margin > 0 ? (equity / margin) * 100 : 999;

      const positions = (() => {
        if (!posRaw) return [];
        if (Array.isArray(posRaw)) return posRaw;
        if (Array.isArray(posRaw?.positions)) return posRaw.positions;
        return [];
      })();

      const openPnl = positions.reduce((s, p) => s + (parseFloat(p.profit ?? p.Profit ?? 0)), 0);

      return {
        login,
        name: acc.user ? `${acc.user.firstName} ${acc.user.lastName}`.trim() : login,
        email: acc.user?.email || '',
        userId: acc.userId,
        equity, balance, margin, freeMargin,
        marginLevel: parseFloat(marginLevel.toFixed(1)),
        openPnl: parseFloat(openPnl.toFixed(2)),
        positions,
        accountType: acc.accountType,
        leverage: acc.leverage,
      };
    }));

    // 3. Deal history for scalp/win-rate analysis (last N hours)
    const fromDate = new Date(Date.now() - parseInt(hours) * 3600 * 1000);
    const dealData = await Promise.all(enriched.map(async (acc) => {
      const raw = await safe(mt5Service.getDealHistory(acc.login, fromDate, new Date()).catch(() => null));
      const deals = (() => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.deals)) return raw.deals;
        if (Array.isArray(raw?.data)) return raw.data;
        return [];
      })();
      return { login: acc.login, deals };
    }));

    const dealMap = {};
    dealData.forEach(d => { dealMap[d.login] = d.deals; });

    // 4. Compute per-account risk metrics
    const riskAccounts = enriched.map(acc => {
      const deals = dealMap[acc.login] || [];

      // Only closed trades (entry == 2 in MT5 deal types, or action == 'sell'/'buy' with non-zero profit)
      const closedDeals = deals.filter(d => {
        const entry = d.entry ?? d.Entry;
        return entry === 2 || entry === 'out' || entry === 'OUT' || String(entry).toLowerCase() === 'out';
      });

      // Scalp detection: pair In/Out deals by position ticket
      const inDeals  = deals.filter(d => { const e = d.entry ?? d.Entry; return e === 0 || String(e).toLowerCase() === 'in'; });
      const outDeals = deals.filter(d => { const e = d.entry ?? d.Entry; return e === 2 || String(e).toLowerCase() === 'out'; });

      let totalDuration = 0, scalp5 = 0, scalp10 = 0, scalp15 = 0, pairedCount = 0;
      outDeals.forEach(out => {
        const posId = out.positionId ?? out.PositionId ?? out.position_id;
        const inD = inDeals.find(i => (i.positionId ?? i.PositionId ?? i.position_id) === posId);
        if (inD) {
          const tIn  = (inD.time  ?? inD.Time  ?? 0);
          const tOut = (out.time  ?? out.Time  ?? 0);
          const durSec = Math.abs(tOut - tIn);
          if (durSec > 0) {
            totalDuration += durSec;
            pairedCount++;
            if (durSec <  5 * 60) scalp5++;
            if (durSec < 10 * 60) scalp10++;
            if (durSec < 15 * 60) scalp15++;
          }
        }
      });
      const avgDurationSec = pairedCount > 0 ? totalDuration / pairedCount : null;

      // Win-rate from closed deals with profit field
      const profitDeals = closedDeals.filter(d => (d.profit ?? d.Profit) !== undefined);
      const wins   = profitDeals.filter(d => parseFloat(d.profit ?? d.Profit) > 0).length;
      const losses = profitDeals.filter(d => parseFloat(d.profit ?? d.Profit) < 0).length;
      const total  = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
      const realizedPnl = profitDeals.reduce((s, d) => s + parseFloat(d.profit ?? d.Profit ?? 0), 0);

      // Risk score (0–100): higher = more dangerous to B-book
      let riskScore = 0;
      if (winRate !== null && winRate >= 70) riskScore += 30;
      if (winRate !== null && winRate >= 85) riskScore += 20;
      if (avgDurationSec !== null && avgDurationSec < 900)  riskScore += 20; // < 15 min
      if (avgDurationSec !== null && avgDurationSec < 300)  riskScore += 20; // < 5 min
      if (realizedPnl > 500)  riskScore += 10;
      if (acc.openPnl > 1000) riskScore += 10;
      if (acc.marginLevel < 150) riskScore -= 10; // losing heavily = less B-book risk

      return {
        ...acc,
        deals: deals.length,
        closedDeals: closedDeals.length,
        wins, losses,
        winRate,
        realizedPnl: parseFloat(realizedPnl.toFixed(2)),
        avgDurationSec: avgDurationSec ? Math.round(avgDurationSec) : null,
        scalp5, scalp10, scalp15,
        riskScore: Math.max(0, Math.min(100, riskScore)),
      };
    });

    // 5. Symbol exposure aggregation from open positions
    const exposure = {};
    enriched.forEach(acc => {
      acc.positions.forEach(p => {
        const sym  = p.symbol ?? p.Symbol ?? 'UNKNOWN';
        const type = (p.type ?? p.Type ?? 0);   // 0=buy, 1=sell
        const vol  = parseFloat(p.volume ?? p.Volume ?? 0);
        const pnl  = parseFloat(p.profit ?? p.Profit ?? 0);
        if (!exposure[sym]) exposure[sym] = { symbol: sym, buyLots: 0, sellLots: 0, netPnl: 0, traders: new Set() };
        if (type === 0 || String(type).toLowerCase() === 'buy') exposure[sym].buyLots  += vol;
        else                                                     exposure[sym].sellLots += vol;
        exposure[sym].netPnl += pnl;
        exposure[sym].traders.add(acc.login);
      });
    });
    const exposureList = Object.values(exposure)
      .map(e => ({ ...e, traders: e.traders.size, netLots: parseFloat((e.buyLots - e.sellLots).toFixed(2)), netPnl: parseFloat(e.netPnl.toFixed(2)), buyLots: parseFloat(e.buyLots.toFixed(2)), sellLots: parseFloat(e.sellLots.toFixed(2)) }))
      .sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl));

    // 6. Summary KPIs
    const activeTraders = riskAccounts.filter(a => a.positions.length > 0 || a.deals > 0).length;
    const stopOutRisk   = riskAccounts.filter(a => a.marginLevel < 120 && a.margin > 0);
    const scalpers      = riskAccounts.filter(a => a.scalp15 >= 2).sort((a, b) => b.scalp15 - a.scalp15);
    const winners       = riskAccounts.filter(a => a.winRate !== null && a.winRate >= 65 && a.total > 2).sort((a, b) => (b.winRate - a.winRate) || (b.realizedPnl - a.realizedPnl));
    const losers        = riskAccounts.filter(a => a.winRate !== null && a.winRate <= 35 && a.total > 2).sort((a, b) => (a.winRate - b.winRate) || (a.realizedPnl - b.realizedPnl));
    const highRisk      = riskAccounts.filter(a => a.riskScore >= 40).sort((a, b) => b.riskScore - a.riskScore);
    const brokerNetPnl  = exposureList.reduce((s, e) => s + e.netPnl, 0);

    res.json(successResponse({
      summary: {
        totalAccounts: accounts.length,
        activeTraders,
        openPositions: enriched.reduce((s, a) => s + a.positions.length, 0),
        brokerNetPnl: parseFloat(brokerNetPnl.toFixed(2)),
        stopOutAlerts: stopOutRisk.length,
        scalperAlerts: scalpers.length,
        highRiskTraders: highRisk.length,
        scanHours: parseInt(hours),
      },
      stopOutRisk: stopOutRisk.slice(0, 20),
      scalpers: scalpers.slice(0, 20),
      winners: winners.slice(0, 20),
      losers: losers.slice(0, 20),
      highRisk: highRisk.slice(0, 20),
      exposure: exposureList.slice(0, 30),
      accounts: riskAccounts.sort((a, b) => b.riskScore - a.riskScore).slice(0, 100),
    }, 'B-Book risk monitor data'));
  } catch (error) {
    next(error);
  }
};

/**
 * Close a position by ticket number (admin action)
 * POST /admin/mt5/positions/:login/:ticket/close
 */
export const closePosition = async (req, res, next) => {
  try {
    const { login, ticket } = req.params;
    const { symbol = '', comment = 'Admin CRM Close', volume = 0 } = req.body;

    if (!login || !ticket) {
      return res.status(400).json({ success: false, message: 'login and ticket are required' });
    }

    const result = await mt5Service.closeTrade(login, parseInt(ticket), parseFloat(volume), symbol, comment);
    res.json(successResponse(result, `Position #${ticket} closed on account ${login}`));
  } catch (error) {
    console.error(`[ClosePosition] Error closing ticket ${req.params.ticket}:`, error.message);
    next(error);
  }
};

export default {
  healthCheck,
  connectServer,
  updateConfig,
  getConfig,
  listMT5Accounts,
  createMT5Account,
  linkMT5Account,
  getAccountDetails,
  depositFunds,
  withdrawFunds,
  getAllPositions,
  getPositionsByLogin,
  getDealHistory,
  getGroups,
  getRiskMonitor,
  getBBookRiskMonitor,
  getIBHierarchy,
  changeLeverage,
  changeAccountPassword,
  getAccountPassword,
  closePosition,
  syncUserAccounts,
  testConnection,
  reloadConfig
};
