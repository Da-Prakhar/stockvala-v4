import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the application root folder
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(__dirname, '../../.env') });

// â"€â"€â"€ V2: Redis fast-path for prices & positions (set by C# Gateway) â"€â"€â"€
// Imported lazily to avoid issues if Redis is not yet connected at module load.
let _redisClient = null;
async function getRedis() {
  if (_redisClient) return _redisClient;
  try {
    const m = await import('../redis/client.js');
    _redisClient = m.redis;
  } catch { /* Redis unavailable â€" fall through to bridge */ }
  return _redisClient;
}

/**
 * MT5 Service - V2
 * Prices / positions â†' Redis (zero-latency, populated by C# Gateway)
 * Account operations â†' Python Flask HTTP bridge (unchanged from V1)
 */

// â"€â"€â"€ Dynamic config: loaded from DB on first call, env vars as fallback â"€â"€â"€
let _bridgeUrl = process.env.PYTHON_BRIDGE_URL || '';
let _apiKey = process.env.PYTHON_BRIDGE_API_KEY || process.env.MT5_BRIDGE_API_KEY || 'stockvala-mt5-bridge-key';
let _mt5Server = process.env.MT5_SERVER || '';
let _mt5ManagerLogin = process.env.MT5_MANAGER_LOGIN || '';
let _mt5ManagerPassword = process.env.MT5_MANAGER_PASSWORD || '';
let _configLoaded = false;
let _configLoadedAt = 0;
const CONFIG_TTL_MS = 30000; // re-read DB every 30s so admin panel changes propagate

const DEFAULT_TIMEOUT = 8000;   // 8s â€" fail fast when bridge is down (was 30s)
const SYNC_TIMEOUT = 60000;
const MAX_RETRIES = 0;          // No retries â€" saves 16s of waiting when bridge is offline

let isConnected = false;

/**
 * Load MT5 config from BrokerSetting DB (lazy, once).
 * Falls back to env vars if DB has no settings.
 */
const ensureConfigLoaded = async () => {
  if (_configLoaded && (Date.now() - _configLoadedAt) < CONFIG_TTL_MS) return;
  try {
    // Dynamic import to avoid circular dependency at module load time
    const { default: BrokerSetting } = await import('../models/BrokerSetting.js');
    const rows = await BrokerSetting.findAll({ where: { category: 'mt5' } });
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });

    if (map.mt5_bridge_url) _bridgeUrl = map.mt5_bridge_url;
    if (map.mt5_api_key) _apiKey = map.mt5_api_key;
    if (map.mt5_server) _mt5Server = map.mt5_server;
    if (map.mt5_manager_login) _mt5ManagerLogin = map.mt5_manager_login;
    if (map.mt5_manager_password) _mt5ManagerPassword = map.mt5_manager_password;

    console.log(`[MT5] Config loaded from DB: bridge=${_bridgeUrl}, server=${_mt5Server}`);
  } catch (e) {
    console.log(`[MT5] DB config not available, using env vars: bridge=${_bridgeUrl}`);
  }
  _configLoaded = true;
  _configLoadedAt = Date.now();
};

/**
 * Force reload config from DB (called after admin saves new settings)
 */
export const reloadConfigFromDB = async () => {
  _configLoaded = false;
  await ensureConfigLoaded();
};

/**
 * Get current MT5 connection config (for admin connect with DB values)
 */
export const getStoredConfig = async () => {
  await ensureConfigLoaded();
  return {
    bridgeUrl: _bridgeUrl,
    apiKey: _apiKey,
    server: _mt5Server,
    managerLogin: _mt5ManagerLogin,
    managerPassword: _mt5ManagerPassword,
  };
};

/**
 * Create axios instance with proper headers
 */
const createBridgeClient = () => {
  return axios.create({
    baseURL: _bridgeUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': _apiKey
    }
  });
};

/**
 * Call the C# MT5 Gateway directly (for trade open/close).
 * The C# gateway is faster and doesn't require manager session re-auth.
 * Falls back to Python bridge if gateway URL not set.
 */
const _gatewayUrl = process.env.MT5_GATEWAY_URL || null;

const _gatewayApiKey = process.env.MT5_BRIDGE_API_KEY || '';

const callGateway = async (endpoint, method = 'post', data = null, timeout = SYNC_TIMEOUT) => {
  if (!_gatewayUrl) throw new Error('MT5_GATEWAY_URL not configured');
  const res = await axios({
    method,
    url: `${_gatewayUrl}${endpoint}`,
    data,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      ..._gatewayApiKey ? { 'X-API-Key': _gatewayApiKey } : {}
    }
  });
  return res.data;
};

/**
 * Base HTTP caller with retry logic
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {Object} data - Request data for POST/PUT
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise} Response data
 */
const callBridge = async (endpoint, method = 'get', data = null, timeout = DEFAULT_TIMEOUT) => {
  await ensureConfigLoaded();
  const client = createBridgeClient();
  const config = { timeout };

  // Use endpoint as-is — deployed bridge serves routes without /api prefix
  const apiEndpoint = endpoint;

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[MT5] Calling ${method.toUpperCase()} ${apiEndpoint} (attempt ${attempt + 1})`);

      let response;
      if (method === 'get' || method === 'delete') {
        response = await client[method](apiEndpoint, config);
      } else if (method === 'post' || method === 'put') {
        response = await client[method](apiEndpoint, data, config);
      }

      console.log(`[MT5] Success: ${method.toUpperCase()} ${apiEndpoint}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message
        || `HTTP ${error.response?.status || 'ERR'} — no message`;
      lastError = new Error(errorMsg);
      console.error(`[MT5] Attempt ${attempt + 1} failed: ${errorMsg}`);
      try {
        console.error(`[MT5] Response status: ${error.response?.status}, data:`, JSON.stringify(error.response?.data));
      } catch (_) {
        console.error(`[MT5] Response status: ${error.response?.status} (data not serializable)`);
      }

      if (attempt < MAX_RETRIES) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to call bridge endpoint ${apiEndpoint}: ${lastError?.message}`);
};

/**
 * Connect to MT5 server
 * @param {string} server - Server name
 * @param {string} login - Manager login
 * @param {string} password - Manager password
 * @returns {Promise} Connection response
 */
export const connect = async (server, login, password) => {
  try {
    const response = await callBridge('/connect', 'post', {
      server,
      login,
      password
    });
    isConnected = true;
    console.log('[MT5] Successfully connected to MT5 server');
    return response;
  } catch (error) {
    isConnected = false;
    throw new Error(`Failed to connect to MT5: ${error.message}`);
  }
};

/**
 * Disconnect from MT5 server
 * @returns {Promise} Disconnect response
 */
export const disconnect = async () => {
  try {
    const response = await callBridge('/disconnect', 'post');
    isConnected = false;
    console.log('[MT5] Successfully disconnected from MT5 server');
    return response;
  } catch (error) {
    throw new Error(`Failed to disconnect from MT5: ${error.message}`);
  }
};

/**
 * Update MT5 configuration
 * @param {string} server - Server name
 * @param {string} manager - Manager login
 * @param {string} password - Manager password
 * @returns {Promise} Config response
 */
export const updateConfig = async (server, manager, password) => {
  try {
    const response = await callBridge('/config/mt5', 'post', {
      server,
      manager,
      password
    });
    console.log('[MT5] MT5 configuration updated');
    return response;
  } catch (error) {
    throw new Error(`Failed to update MT5 config: ${error.message}`);
  }
};

/**
 * List all users from MT5
 * @returns {Promise} Array of users
 */
export const listUsers = async () => {
  try {
    const response = await callBridge('/users', 'get');
    console.log(`[MT5] Retrieved ${response.users?.length || 0} users`);
    return response;
  } catch (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }
};

/**
 * Create new MT5 account
 * @param {Object} accountData - Account creation data
 * @param {string} accountData.firstName - First name
 * @param {string} accountData.lastName - Last name
 * @param {string} accountData.email - Email address
 * @param {string} accountData.phone - Phone number
 * @param {string} accountData.password - Account password
 * @param {string} accountData.group - Trading group
 * @param {number} accountData.leverage - Leverage
 * @param {number} accountData.initialBalance - Initial balance
 * @returns {Promise} Account creation response
 */
export const createAccount = async (accountData) => {
  await ensureConfigLoaded();

  const fullName = `${accountData.firstName || ''} ${accountData.lastName || ''}`.trim() || accountData.email || 'User';
  const payload = {
    // Some bridges (Python v1) expect a single `name` field; newer bridges support first/last separately.
    // Send both so either bridge version works.
    name:       fullName,
    first_name: accountData.firstName || '',
    last_name:  accountData.lastName  || '',
    email:      accountData.email,
    phone:      accountData.phone || '',
    group:      accountData.group,
    leverage:   accountData.leverage || 100,
    initial_balance: accountData.initialBalance || 0,
  };

  // Only include password if provided (bridge generates one otherwise)
  if (accountData.password) payload.password = accountData.password;

  // Sequential login hint — passed when admin has enabled the login series.
  // The C# gateway passes this to MT5 as a preferred login; MT5 may honour or ignore it.
  // We always use the actual login returned by MT5 (mt5Result.login) as the source of truth.
  // Accepts both `loginHint` (admin flow) and `login` (user flow) field names.
  const loginHint = accountData.loginHint || accountData.login;
  if (loginHint && Number(loginHint) > 0) {
    payload.login = Number(loginHint);
  }

  console.log(`[MT5] Creating account:`, JSON.stringify({ ...payload, password: payload.password ? '***' : undefined }, null, 2));

  // ── 1. Admin-configured Bridge URL (C# gateway set in Admin → MT5 Management) ──
  // This is the primary path when admin has pointed "Bridge URL" at the new C# gateway.
  // Checked before the env-var gateway so the admin panel is the authoritative config.
  if (_bridgeUrl) {
    try {
      console.log(`[MT5] Trying Bridge URL for account creation: ${_bridgeUrl}/users`);
      const response = await callBridge('/users', 'post', payload, 60000);
      if (response && (response.login || response.success)) {
        console.log(`[MT5] Account created via bridge: login=${response.login}, group=${response.group}`);
        return response;
      }
      console.warn(`[MT5] Bridge /users returned no login:`, JSON.stringify(response));
    } catch (bridgeErr) {
      console.warn(`[MT5] Bridge account creation failed (${bridgeErr.message}), trying env-var gateway`);
    }
  }

  // ── 2. Fallback: env-var C# Gateway (MT5_GATEWAY_URL in cPanel .env) ─────────
  if (_gatewayUrl) {
    try {
      console.log(`[MT5] Trying env-var Gateway for account creation: ${_gatewayUrl}/users`);
      const r = await callGateway('/users', 'post', payload, 60000);
      if (r && (r.login || r.success)) {
        console.log(`[MT5] Gateway: account created login=${r.login}`);
        return r;
      }
      console.warn(`[MT5] Gateway /users returned no login:`, JSON.stringify(r));
    } catch (gwErr) {
      console.warn(`[MT5] Gateway account creation failed: ${gwErr.message}`);
    }
  }

  throw new Error(
    'MT5 account creation failed: no bridge or gateway could create the account. ' +
    'Configure Bridge URL in Admin → MT5 Management.'
  );
};

/**
 * Get account information
 * @param {string} login - MT5 login
 * @returns {Promise} Account details
 */
export const getAccountInfo = async (login) => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/account/${login}`, 'get', null, DEFAULT_TIMEOUT);
      if (!r.error) return r;
    } catch (gwErr) {
      console.warn(`[MT5] Gateway getAccountInfo failed, trying bridge: ${gwErr.message}`);
    }
  }
  const response = await callBridge(`/account/${login}`, 'get', null, DEFAULT_TIMEOUT);
  return response;
};

/**
 * Deposit funds to account
 * @param {string} login - MT5 login
 * @param {number} amount - Amount to deposit
 * @param {string} comment - Deposit comment
 * @returns {Promise} Deposit response
 */
export const deposit = async (login, amount, comment = 'Deposit') => {
  // Try C# Gateway first
  if (_gatewayUrl) {
    try {
      const r = await callGateway('/balance/deposit', 'post', { login: parseInt(login), amount: parseFloat(amount), comment });
      // MT_RET_REQUEST_DONE in error field = success on MT5 gateway
      if (!r.error || r.error.includes('MT_RET_REQUEST_DONE') || r.error.includes('done')) {
        console.log(`[MT5] Gateway: deposited ${amount} to ${login}`);
        return r;
      }
      if (r.error) throw new Error(r.error);
    } catch (gwErr) {
      console.warn(`[MT5] Gateway deposit failed (${gwErr.message}), trying bridge`);
    }
  }
  try {
    const response = await callBridge('/balance/deposit', 'post', { login: parseInt(login), amount: parseFloat(amount), comment });
    console.log(`[MT5] Deposited ${amount} to account ${login}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to deposit to account ${login}: ${error.message}`);
  }
};

/**
 * Withdraw funds from account
 * @param {string} login - MT5 login
 * @param {number} amount - Amount to withdraw
 * @param {string} comment - Withdrawal comment
 * @returns {Promise} Withdrawal response
 */
export const withdraw = async (login, amount, comment = 'Withdrawal') => {
  // Try Python bridge first — it's the proven MT5 Manager API path for balance ops.
  // Gateway is tried only as fallback because some C# gateways silently return success
  // for /balance/withdraw without actually debiting MT5.
  if (_bridgeUrl) {
    try {
      const response = await callBridge('/balance/withdraw', 'post', { login: parseInt(login), amount: parseFloat(amount), comment });
      console.log(`[MT5] Bridge: withdrew ${amount} from ${login}`);
      return response;
    } catch (bridgeErr) {
      console.warn(`[MT5] Bridge withdraw failed (${bridgeErr.message}), trying gateway`);
    }
  }
  if (_gatewayUrl) {
    try {
      const r = await callGateway('/balance/withdraw', 'post', { login: parseInt(login), amount: parseFloat(amount), comment });
      if (!r.error || r.error.includes('MT_RET_REQUEST_DONE') || r.error.includes('done')) {
        console.log(`[MT5] Gateway: withdrew ${amount} from ${login}`);
        return r;
      }
      if (r.error) throw new Error(r.error);
    } catch (gwErr) {
      throw new Error(`Failed to withdraw from account ${login}: ${gwErr.message}`);
    }
  }
  throw new Error(`No MT5 bridge or gateway configured for withdrawal`);
};

/**
 * Add credit to account
 * @param {string} login - MT5 login
 * @param {number} amount - Credit amount
 * @param {string} comment - Credit comment
 * @returns {Promise} Credit response
 */
export const credit = async (login, amount, comment = 'Credit') => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway('/balance/credit', 'post', { login: parseInt(login), amount: parseFloat(amount), comment });
      if (!r.error) {
        console.log(`[MT5] Gateway: credited ${amount} to ${login}`);
        return r;
      }
      if (r.error) throw new Error(r.error);
    } catch (gwErr) {
      console.warn(`[MT5] Gateway credit failed (${gwErr.message}), trying bridge`);
    }
  }
  try {
    const response = await callBridge('/balance/credit', 'post', { login, amount, comment });
    console.log(`[MT5] Credited ${amount} to account ${login}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to credit account ${login}: ${error.message}`);
  }
};

/**
 * Get all open positions or positions for specific account
 * V2: if login is provided, tries Redis first (set by C# PositionSync).
 * @param {string} login - MT5 login (optional)
 * @returns {Promise} Positions data
 */
export const getOpenPositions = async (login = null) => {
  // 1. Try C# Gateway first (fastest, always live)
  if (_gatewayUrl && login) {
    try {
      const r = await callGateway(`/positions/${login}`, 'get', null, DEFAULT_TIMEOUT);
      if (r && Array.isArray(r.positions)) return r;
      if (Array.isArray(r)) return { positions: r };
      // Gateway responded but no positions array — return empty (no bridge fallback)
      return { positions: [] };
    } catch { /* fall through to Redis */ }
  }

  // 2. Redis cache (written by C# Gateway on VPS)
  if (login) {
    try {
      const r = await getRedis();
      if (r) {
        const raw = await r.hget(`positions:${login}`, 'data');
        if (raw) {
          const positions = JSON.parse(raw);
          if (Array.isArray(positions)) return { positions, source: 'redis' };
        }
      }
    } catch { /* fall through */ }
  }

  // 3. V1 fallback: Python bridge (only when no gateway configured)
  if (!_gatewayUrl) {
    try {
      const endpoint = login ? `/positions/${login}` : '/positions';
      const response = await callBridge(endpoint, 'get');
      return response;
    } catch (error) {
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }

  return { positions: [] };
};

/**
 * Get risk monitoring data for account
 * @param {string} login - MT5 login
 * @returns {Promise} Risk data
 */
export const getRiskMonitor = async (login) => {
  try {
    const response = await callBridge(`/risk/${login}`, 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get risk monitoring data for ${login}: ${error.message}`);
  }
};

/**
 * Get IB hierarchy
 * @param {string} masterLogin - Master account login
 * @returns {Promise} IB hierarchy data
 */
export const getIBHierarchy = async (masterLogin) => {
  try {
    const response = await callBridge(`/ib/${masterLogin}`, 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get IB hierarchy for ${masterLogin}: ${error.message}`);
  }
};

/**
 * Get available trading groups
 * @returns {Promise} Array of groups
 */
export const getGroups = async () => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway('/groups', 'get', null, DEFAULT_TIMEOUT);
      if (!r.error) return r;
    } catch { /* fall through */ }
  }
  try {
    const response = await callBridge('/groups', 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get trading groups: ${error.message}`);
  }
};

/**
 * Sync user accounts from MT5
 * @param {string} userId - Platform user ID
 * @returns {Promise} Sync response
 */
export const syncUserAccounts = async (userId) => {
  try {
    const response = await callBridge(`/sync-user-accounts/${userId}`, 'post', {}, SYNC_TIMEOUT);
    console.log(`[MT5] Synced accounts for user ${userId}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to sync accounts for user ${userId}: ${error.message}`);
  }
};

/**
 * Update account leverage
 * @param {string} login - MT5 login
 * @param {number} leverage - New leverage
 * @returns {Promise} Update response
 */
export const updateLeverage = async (login, leverage) => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/users/${login}/leverage`, 'put', { leverage });
      if (!r.error) return r;
      throw new Error(r.error);
    } catch (gwErr) {
      console.warn(`[MT5] Gateway updateLeverage failed (${gwErr.message}), trying bridge`);
    }
  }
  try {
    const response = await callBridge(`/users/${login}/leverage`, 'put', { leverage });
    console.log(`[MT5] Updated leverage for ${login} to ${leverage}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to update leverage for ${login}: ${error.message}`);
  }
};

/**
 * Update account group
 * @param {string} login - MT5 login
 * @param {string} group - New group
 * @returns {Promise} Update response
 */
export const updateGroup = async (login, group) => {
  try {
    const response = await callBridge(`/users/${login}/group`, 'put', { group });
    console.log(`[MT5] Updated group for ${login} to ${group}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to update group for ${login}: ${error.message}`);
  }
};

/**
 * Change account password (trader or investor)
 * @param {string} login - MT5 login
 * @param {string} newPassword - New password
 * @param {string} type - 'trader' or 'investor'
 * @returns {Promise} Update response
 */
export const changePassword = async (login, newPassword, type = 'trader') => {
  if (_gatewayUrl) {
    try {
      const passType = type === 'investor' ? 'investor' : 'main';
      const r = await callGateway(`/users/${login}/password`, 'put', { password: newPassword, type: passType });
      if (!r.error) return r;
      throw new Error(r.error);
    } catch (gwErr) {
      console.warn(`[MT5] Gateway changePassword failed (${gwErr.message}), trying bridge`);
    }
  }
  try {
    const response = await callBridge(`/users/${login}/password`, 'put', { password: newPassword, type });
    console.log(`[MT5] Changed ${type} password for ${login}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to change ${type} password for ${login}: ${error.message}`);
  }
};

/**
 * Disable account
 * @param {string} login - MT5 login
 * @returns {Promise} Update response
 */
export const disableAccount = async (login) => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/users/${login}/disable`, 'put', {});
      if (!r.error) return r;
      throw new Error(r.error);
    } catch (gwErr) {
      console.warn(`[MT5] Gateway disableAccount failed (${gwErr.message}), trying bridge`);
    }
  }
  try {
    const response = await callBridge(`/users/${login}/disable`, 'put', {});
    console.log(`[MT5] Disabled account ${login}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to disable account ${login}: ${error.message}`);
  }
};

/**
 * Enable account — sets rights=11 (ENABLED|PASSWORD|EXPERT) and returns a fresh investor password.
 * V2: try C# Gateway first (it supports this endpoint and now returns investor_password).
 * @param {string} login - MT5 login
 * @returns {Promise} { success, login, enabled, investor_password? }
 */
export const enableAccount = async (login) => {
  await ensureConfigLoaded();
  // Try C# Gateway first — it's always running and now returns investor_password
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/users/${login}/enable`, 'put', {}, DEFAULT_TIMEOUT);
      console.log(`[MT5] Gateway: account ${login} enabled`);
      return r;
    } catch (gwErr) {
      console.warn(`[MT5] Gateway enable failed (${gwErr.message}), trying Python bridge`);
    }
  }
  try {
    const response = await callBridge(`/users/${login}/enable`, 'put', {});
    console.log(`[MT5] Enabled account ${login}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to enable account ${login}: ${error.message}`);
  }
};

/**
 * Get deal history for account
 * @param {string} login - MT5 login
 * @param {Date} fromDate - Start date (optional)
 * @param {Date} toDate - End date (optional)
 * @returns {Promise} Deal history
 */
export const getDealHistory = async (login, fromDate = null, toDate = null) => {
  const params = new URLSearchParams();
  if (fromDate) params.append('from', Math.floor(fromDate.getTime() / 1000));
  if (toDate)   params.append('to',   Math.floor(toDate.getTime()   / 1000));
  const qs = params.toString() ? `?${params.toString()}` : '';

  // Try C# Gateway first (has live deal stream)
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/deals/${login}${qs}`, 'get', null, DEFAULT_TIMEOUT);
      if (r) return r;
    } catch { /* fall through to bridge */ }
  }

  // Fallback: Python bridge
  try {
    const response = await callBridge(`/deals/${login}${qs}`, 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get deal history for ${login}: ${error.message}`);
  }
};

/**
 * Get pending orders for account
 * @param {string} login - MT5 login
 * @returns {Promise} Orders array
 */
export const getPendingOrders = async (login) => {
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/orders/${login}`, 'get', null, DEFAULT_TIMEOUT);
      if (!r.error) return r;
    } catch { /* fall through */ }
  }
  try {
    const response = await callBridge(`/orders/${login}`, 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get pending orders for ${login}: ${error.message}`);
  }
};

/**
 * Get overall statistics
 * @returns {Promise} Statistics data
 */
export const getStats = async () => {
  try {
    const response = await callBridge('/stats', 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get statistics: ${error.message}`);
  }
};

/**
 * Get OHLC chart data for a symbol
 * @param {string} symbol - Trading symbol (e.g. EURUSD)
 * @param {string} timeframe - Timeframe (M1, M5, M15, M30, H1, H4, D1)
 * @param {number} count - Number of bars
 * @returns {Promise} Candle data array
 */
export const getChartData = async (symbol, timeframe = 'M15', count = 200) => {
  // Strip broker suffix before building URL — '#' breaks URL parsing
  const cleanSymbol = symbol.includes('.') ? symbol.replace(/\.[^.]*$/, '') : symbol;

  // 1. Try C# Gateway — it has a live TickAggregator (accumulates since gateway start)
  if (_gatewayUrl) {
    try {
      const r = await callGateway(`/chart/${cleanSymbol}?timeframe=${timeframe}&count=${count}`, 'get', null, DEFAULT_TIMEOUT);
      const candles = r?.candles || r?.data || [];
      if (candles.length > 0) return r;
      // Gateway returned 0 bars (just started) — return empty immediately
      // so the controller falls back to the JS in-memory aggregator without delay.
      return { symbol, candles: [], count: 0, source: 'gateway-empty' };
    } catch { /* gateway unreachable — fall through */ }
  }

  // 2. No gateway configured: try Python bridge (V1 legacy, may be offline)
  if (!_gatewayUrl) {
    try {
      const response = await callBridge(`/chart/${cleanSymbol}?timeframe=${timeframe}&count=${count}`, 'get');
      return response;
    } catch (error) {
      throw new Error(`Failed to get chart data for ${symbol}: ${error.message}`);
    }
  }

  return { symbol, candles: [], count: 0 };
};

/**
 * Get live tick (bid/ask) for a symbol
 * V2: tries Redis first (sub-millisecond, set by C# Gateway), falls back to bridge.
 * @param {string} symbol - Trading symbol (e.g. EURUSD)
 * @returns {Promise} Tick data with bid, ask
 */
export const getSymbolTick = async (symbol) => {
  try {
    const r = await getRedis();
    if (r) {
      // Try exact symbol first, then strip suffix (e.g. XAUUSD.# -> XAUUSD)
      const candidates = [symbol, symbol.replace(/\.#?$/, ''), symbol.replace(/\.[^.]+$/, '')];
      for (const key of [...new Set(candidates)]) {
        const raw = await r.get(`price:${key}`);
        if (raw) {
          const { bid, ask, t } = JSON.parse(raw);
          if (bid > 0) return { symbol: key, bid, ask, time: t };
        }
      }
    }
  } catch { /* fall through */ }

  // V2 path: C# Gateway REST (used exclusively when gateway is configured —
  // do NOT fall through to Python bridge. Bridge is V1-only and not deployed
  // in V2. Falling through causes an 8s timeout on every tick request.)
  if (_gatewayUrl) {
    try {
      const gwTickSymbol = symbol.includes('.') ? symbol.replace(/\.[^.]*$/, '') : symbol;
      const r2 = await callGateway(`/tick/${gwTickSymbol}`, 'get');
      return r2 || { bid: 0, ask: 0, symbol };
    } catch (err) {
      throw new Error(`Gateway tick failed for ${symbol}: ${err.message}`);
    }
  }

  // V1 fallback: HTTP bridge (only when no gateway configured)
  try {
    const bridgeTickSymbol = symbol.includes('.') ? symbol.replace(/\.[^.]*$/, '') : symbol;
    const response = await callBridge(`/tick/${bridgeTickSymbol}`, 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get tick for ${symbol}: ${error.message}`);
  }
};

/**
 * Get available symbols
 * V2: try C# Gateway first (it holds the live tick-derived symbol list).
 * Falls back to Python bridge for backward compatibility.
 * @returns {Promise} Symbols array
 */
export const getSymbols = async () => {
  // Try C# Gateway first — returns {symbols:[...], total:N}
  if (_gatewayUrl) {
    try {
      const r = await callGateway('/symbols', 'get', null, DEFAULT_TIMEOUT);
      if (r && (Array.isArray(r.symbols) || Array.isArray(r))) {
        console.log(`[MT5] Gateway: symbols retrieved (${(r.symbols || r).length})`);
        return r;
      }
    } catch { /* fall through to Python bridge */ }
  }
  try {
    const response = await callBridge('/symbols', 'get');
    return response;
  } catch (error) {
    throw new Error(`Failed to get symbols: ${error.message}`);
  }
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Symbol Resolver â€" maps base names to actual MT5 names
   Fetches the full symbol list from MT5 ONCE, then builds
   a lookup so "XAUUSD" â†' "XAUUSD.#" (or whatever the server uses).
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
let _symbolCache = null;       // { allNames: Set, baseToMt5: Map }
let _symbolCacheTime = 0;
const SYMBOL_CACHE_TTL = 30 * 60 * 1000; // refresh every 30 minutes (stale cache used on failure)

/**
 * Build or return the cached symbol resolver.
 * baseToMt5 maps a cleaned base name to the real MT5 symbol name.
 * e.g. "EURUSD" â†' "EURUSD.#",  "XAUUSD" â†' "XAUUSD.#"
 */
export const getSymbolResolver = async () => {
  const now = Date.now();
  if (_symbolCache && (now - _symbolCacheTime) < SYMBOL_CACHE_TTL) {
    return _symbolCache;
  }

  try {
    const result = await getSymbols();
    const rawSymbols = result.symbols || result || [];
    // Normalize: C# Gateway returns string[] (symbols it has seen ticks for)
    // Python bridge returns object[] with {name, trade_mode, digits, ...}
    const symbols = rawSymbols.map(s =>
      typeof s === 'string' ? { name: s, trade_mode: 1, digits: 5, description: s, path: '' } : s
    );
    const allNames = new Set();
    const baseToMt5 = new Map();
    const tradeableNames = new Set();

    // â"€â"€ Suffix priority order â"€â"€
    // Your MT5 server has 30+ broker groups with different suffixes.
    // User accounts are in the HIJA group which uses .# suffix.
    // Process .# symbols FIRST so they always win the baseâ†'name mapping.
    // If you change broker groups, adjust this priority list.
    const SUFFIX_PRIORITY = ['.#', '.t', '.e', '.p', '.m', '.c', '.r', '.a', '.z'];

    // Collect all symbol names
    for (const s of symbols) {
      const name = s.name || '';
      if (!name) continue;
      allNames.add(name);
      if (s.trade_mode !== 0) tradeableNames.add(name);
    }

    // Sort symbols: .# first, then other priority suffixes, then everything else
    const getSuffixRank = (name) => {
      for (let i = 0; i < SUFFIX_PRIORITY.length; i++) {
        if (name.endsWith(SUFFIX_PRIORITY[i])) return i;
      }
      return SUFFIX_PRIORITY.length; // unsuffixed / unknown suffix â†' lowest priority
    };

    const sorted = [...symbols].sort((a, b) => getSuffixRank(a.name || '') - getSuffixRank(b.name || ''));

    // Build baseâ†'MT5 mapping â€" .# symbols mapped first, so "XAUUSD" â†' "XAUUSD.#"
    for (const s of sorted) {
      const name = s.name || '';
      if (!name || s.trade_mode === 0) continue; // skip non-tradeable

      // Strip ALL known suffixes to get the base name
      const base = name
        .replace(/\.(#|t|e|p|m|c|r|a|z|N|OQ|ETF|i|ii|ai|us|NG|B|V|U|D|iix|VO|ZZZ|gd|gx|hhc|bbc|uus|ux|fx|xnys|xnas|O|l|MAR|SEP|DEC|JUL|MAY|JUN|JAN|OCT|AUG|NOV|FEB|APR|MAR27|SEP27|DEC27|JUL27|MAY27|JAN27|NOV27|OI|L|OTC)$/i, '')
        .replace(/\.$/, '') // handle trailing dot (e.g. "XAUUSD.")
        .toUpperCase();

      // First match per base wins (highest priority suffix)
      if (!baseToMt5.has(base)) {
        baseToMt5.set(base, name);
      }
      // Map exact name to itself -- do NOT overwrite an existing base mapping
      // (plain "XAUUSD" must not overwrite "XAUUSD" -> "XAUUSD.#")
      if (!baseToMt5.has(name.toUpperCase())) {
        baseToMt5.set(name.toUpperCase(), name);
      }
    }

    _symbolCache = { allNames, tradeableNames, baseToMt5, symbolList: symbols };
    _symbolCacheTime = now;

    // Log a few examples so you can verify it's working
    const examples = ['XAUUSD', 'EURUSD', 'BTCUSD', 'XAGUSD', 'GBPUSD'];
    const resolved = examples.map(b => `${b}â†'${baseToMt5.get(b) || '?'}`).join(', ');
    console.log(`[MT5] Symbol cache: ${allNames.size} total, ${tradeableNames.size} tradeable, ${baseToMt5.size} mappings`);
    console.log(`[MT5] Resolved: ${resolved}`);

    return _symbolCache;
  } catch (error) {
    console.error('[MT5] Failed to build symbol cache:', error.message);
    // Return stale cache if available â€" better than returning empty and breaking
    // all symbol resolution until the bridge recovers.
    if (_symbolCache) {
      console.warn('[MT5] Using stale symbol cache due to refresh failure');
      return _symbolCache;
    }
    return { allNames: new Set(), tradeableNames: new Set(), baseToMt5: new Map(), symbolList: [] };
  }
};

/**
 * Resolve a user-facing symbol name to its actual MT5 name.
 * Returns the actual name or the original if no match found.
 * e.g. resolveSymbol("XAUUSD") â†' "XAUUSD.#"
 *
 * Priority:
 *  1. baseToMt5 map (prefers suffixed tradeable symbols over bare names)
 *  2. Exact match in tradeable symbols
 *  3. Partial match (symbol starts with baseName)
 *  4. Return as-is
 */
export const resolveSymbol = async (baseName) => {
  const { allNames, tradeableNames, baseToMt5 } = await getSymbolResolver();
  const upper = (baseName || '').toUpperCase();

  // 1. Check the baseâ†'MT5 map first (this prefers suffixed tradeable symbols)
  //    e.g. "XAUUSD" â†' "XAUUSD.#" because suffixed symbols are mapped first
  if (baseToMt5.has(upper)) return baseToMt5.get(upper);

  // 2. Exact match in tradeable symbols only
  if (tradeableNames && tradeableNames.has(baseName)) return baseName;

  // 3. Try partial match â€" find any tradeable symbol that starts with the base name
  const searchSet = (tradeableNames && tradeableNames.size > 0) ? tradeableNames : allNames;
  for (const name of searchSet) {
    if (name.toUpperCase().startsWith(upper) && name.length <= upper.length + 4) {
      // Cache this mapping for next time
      baseToMt5.set(upper, name);
      return name;
    }
  }

  // 4. No match found â€" return as-is
  return baseName;
};

/**
 * Open a trade (market order) via Dealer API
 * @param {string} login - MT5 login
 * @param {string} symbol - Trading symbol (e.g. EURUSD)
 * @param {string} action - 'buy' or 'sell'
 * @param {number} volume - Volume in lots (e.g. 0.01)
 * @param {number} sl - Stop loss price (0 = none)
 * @param {number} tp - Take profit price (0 = none)
 * @param {string} comment - Trade comment
 * @returns {Promise} Trade result with deal_id
 */
export const openTrade = async (login, symbol, action, volume, sl = 0, tp = 0, comment = 'CRM Trade') => {
  try {
    const resolved = await resolveSymbol(symbol);
    console.log(`[MT5] Symbol resolved: ${symbol} -> ${resolved}`);

    // Try C# Gateway first (fast, no session re-auth needed)
    if (_gatewayUrl) {
      const response = await callGateway('/trade/open', 'post', {
        login: parseInt(login),
        symbol: resolved,
        type: action === 'buy' ? 0 : 1,
        action,
        volume,
        sl: sl || 0,
        tp: tp || 0,
        comment
      });

      // Gateway returned an error object (e.g. DealPerform failed: MT_RET_REQUEST_REJECT)
      // Surface it immediately — do NOT silently fall through to the Python bridge.
      if (response && response.error) {
        console.error(`[MT5] Gateway trade rejected: ${response.error}`);
        throw new Error(response.error);
      }

      console.log(`[MT5] Gateway trade opened: ${action} ${volume} ${resolved} -> deal=${response.deal_id}, pos=${response.position_ticket}`);
      return response;
    }

    // No gateway configured — fall back to Python bridge
    const response = await callBridge('/trade/open', 'post', {
      login,
      symbol: resolved,
      action,
      volume,
      sl,
      tp,
      comment
    }, SYNC_TIMEOUT);
    console.log(`[MT5] Trade opened: ${action} ${volume} ${resolved} for login ${login}, deal=${response.deal_id}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to open trade for ${login}: ${error.message}`);
  }
};

/**
 * Close a position by ticket
 * @param {string} login - MT5 login
 * @param {number} ticket - Position ticket to close
 * @param {number} volume - Lots to close (0 = full close)
 * @param {string} symbol - Symbol (optional, helps some bridges find the position)
 * @param {string} comment - Close comment
 * @returns {Promise} Close result
 */
export const closeTrade = async (login, ticket, volume = 0, symbol = '', comment = 'CRM Close') => {
  try {
    const payload = { login: parseInt(login), ticket, comment };
    if (volume > 0) payload.volume = volume;
    if (symbol) payload.symbol = symbol;

    // Try C# Gateway first
    if (_gatewayUrl) {
      try {
        const response = await callGateway('/trade/close', 'post', payload);
        console.log(`[MT5] Gateway position ${ticket} closed for login ${login}`);
        return response;
      } catch (gwErr) {
        console.warn(`[MT5] Gateway close failed (${gwErr.message}), falling back to bridge`);
      }
    }

    const response = await callBridge('/trade/close', 'post', payload, SYNC_TIMEOUT);
    console.log(`[MT5] Position ${ticket} closed for login ${login}, volume=${volume}`);
    return response;
  } catch (error) {
    throw new Error(`Failed to close position ${ticket}: ${error.message}`);
  }
};

/**
 * Health check - ping the bridge
 * @returns {Promise} Health status
 */
export const ping = async () => {
  try {
    const response = await callBridge('/health', 'get');
    return response;
  } catch (error) {
    console.error('[MT5] Health check failed:', error.message);
    return { status: 'error', message: error.message };
  }
};

/**
 * Get connection status
 * @returns {boolean} Connection status
 */
export const getConnectionStatus = () => {
  return isConnected;
};

/**
 * Set connection status
 * @param {boolean} status - Connection status
 */
export const setConnectionStatus = (status) => {
  isConnected = status;
};

/**
 * Get latest prices for multiple symbols in one Redis pipeline call.
 * V2 only â€" no bridge fallback needed (bridge has no bulk-tick endpoint).
 * @param {string[]} symbols
 * @returns {Promise<Object>} { EURUSD: { bid, ask, t }, ... }
 */
export const getAllPrices = async (symbols) => {
  const r = await getRedis();
  if (!r) return {};
  const pipeline = r.pipeline();
  symbols.forEach(s => pipeline.get(`price:${s}`));
  const results = await pipeline.exec();
  const out = {};
  symbols.forEach((s, i) => {
    if (results[i][1]) out[s] = JSON.parse(results[i][1]);
  });
  return out;
};

export default {
  callBridge,
  reloadConfigFromDB,
  getStoredConfig,
  connect,
  disconnect,
  updateConfig,
  listUsers,
  createAccount,
  getAccountInfo,
  getChartData,
  deposit,
  withdraw,
  credit,
  getOpenPositions,
  getRiskMonitor,
  getIBHierarchy,
  getGroups,
  syncUserAccounts,
  updateLeverage,
  updateGroup,
  changePassword,
  disableAccount,
  enableAccount,
  getDealHistory,
  getPendingOrders,
  getStats,
  getSymbols,
  getSymbolTick,
  openTrade,
  closeTrade,
  ping,
  getConnectionStatus,
  setConnectionStatus,
  getSymbolResolver,
  resolveSymbol,
  getAllPrices,
};
