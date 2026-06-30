/**
 * brokerPermissions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads the 'permissions' category broker settings from DB and caches them
 * for 60 seconds so every trade / account creation doesn't hit the DB.
 *
 * Usage:
 *   import { getPermissions, assertPermission } from '../utils/brokerPermissions.js'
 *
 *   const perms = await getPermissions()
 *   if (!perms.market_forex_enabled) throw new BusinessError('Forex trading is disabled')
 *
 *   // or shorthand:
 *   await assertPermission('market_forex_enabled', 'Forex trading is currently disabled')
 */

import { BrokerSetting } from '../models/index.js';
import { BusinessError } from './errors.js';
import { Op } from 'sequelize';

const CACHE_TTL = 60_000; // 60 seconds
let _cache = null;
let _cacheTime = 0;

/**
 * Raw defaults — used when DB has no row for a key.
 * Keep these permissive so a fresh install doesn't lock users out.
 */
const DEFAULTS = {
  market_forex_enabled:        true,
  market_crypto_enabled:       true,
  market_metals_enabled:       true,
  market_indices_enabled:      true,
  market_stocks_enabled:       false,
  market_commodities_enabled:  false,

  allow_ea_trading:            true,
  allow_demo_accounts:         true,
  kyc_required_to_trade:       false,
  max_lot_size:                100,

  copy_allow_masters:           true,
  copy_allow_followers:         true,
  copy_max_followers_per_master: 500,
  copy_min_allocation:          100,
  copy_max_allocation:          100000,
  copy_min_performance_fee:     0,
  copy_max_performance_fee:     50,
  copy_lot_modes_allowed:         'ratio,fixed,equity_pct,balance_ratio,risk_pct',
  copy_user_can_modify_settings:  true,
};

/**
 * Load and cache all permissions from the DB.
 * Returns a plain object with typed values (boolean/number/string).
 */
export async function getPermissions() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  try {
    const rows = await BrokerSetting.findAll({ where: { category: 'permissions' } });
    const result = { ...DEFAULTS };

    for (const row of rows) {
      const key = row.key;
      if (!(key in DEFAULTS)) continue;

      const def = DEFAULTS[key];
      if (typeof def === 'boolean') {
        result[key] = row.value === 'true';
      } else if (typeof def === 'number') {
        result[key] = parseFloat(row.value) || 0;
      } else {
        result[key] = row.value;
      }
    }

    _cache = result;
    _cacheTime = now;
    return result;
  } catch (err) {
    console.warn('[BrokerPermissions] DB read failed, using defaults:', err.message);
    return { ...DEFAULTS };
  }
}

/**
 * Invalidate the cache (call after admin saves permissions).
 */
export function invalidatePermissionsCache() {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Throw a BusinessError if the given boolean permission key is false.
 *
 * @param {string} key     - e.g. 'market_forex_enabled'
 * @param {string} message - Error message shown to the user
 */
export async function assertPermission(key, message) {
  const perms = await getPermissions();
  if (perms[key] === false) {
    throw new BusinessError(message);
  }
}

/**
 * Determine which market category a symbol belongs to.
 * Returns one of: 'forex' | 'crypto' | 'metals' | 'indices' | 'stocks' | 'commodities'
 */
export function classifySymbol(symbol) {
  const s = (symbol || '').toUpperCase().replace(/\.#$/, '');
  if (/^(XAU|XAG|XPT|XPD)/.test(s))                                               return 'metals';
  if (/^(BTC|ETH|LTC|XRP|ADA|DOT|SOL|BNB|DOGE|AVAX|MATIC|LINK|UNI|ATOM)/.test(s)) return 'crypto';
  if (/^(US30|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX|US500|USTEC)/.test(s)) return 'indices';
  if (/^(USOIL|UKOIL|XBR|XTI|NGAS|BRENT|WTI|CRUDEOIL|NATURALGAS|COPPER|ZINC|ALUMINIUM|LEAD|NICKEL)/.test(s)) return 'commodities';
  // Stocks: single company names (no slash) that aren't the above
  if (!/[A-Z]{3}[A-Z]{3}/.test(s) && /^[A-Z]{2,6}$/.test(s) && !['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','NZDUSD','USDCHF','EURGBP','EURJPY'].includes(s)) {
    // Not a 6-char FX pair → likely a stock
    return 'stocks';
  }
  return 'forex';
}
