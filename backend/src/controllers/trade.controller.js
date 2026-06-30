import { Trade, Position, Order, Mt5Account, User } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import * as mt5Service from '../services/mt5.service.js';
import { Op } from 'sequelize';
import { getCandles as getAggCandles } from '../redis/tickAggregator.js';
import { redis, getPriceByServer } from '../redis/client.js';
import { getPermissions, classifySymbol } from '../utils/brokerPermissions.js';
import { awardTradingCommission } from '../services/ibCommission.service.js';

/**
 * Return the correct contract size for a symbol.
 *
 * MT5 contract sizes by asset class:
 *   Metals  (XAUUSD, XAGUSD …) → 100
 *   Crypto  (BTCUSD, ETHUSD …) → 1
 *   Indices (US30, NAS100 …)   → 1
 *   Forex   (everything else)  → 100 000
 *
 * Used to recalculate live P&L from Redis tick prices.
 * The gateway (MT5) profit is authoritative for final settlement,
 * but this gives real-time updates between gateway polls.
 */
function getContractSize(symbol) {
  const sym = (symbol || '').toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(sym)) return 100;          // metals
  if (/^(BTC|ETH|LTC|XRP|ADA|DOT|SOL|BNB|DOGE|AVAX|MATIC|LINK|UNI|ATOM)/.test(sym)) return 1; // crypto
  if (/^(US30|NAS|SPX|UK100|GER|JPN|AUS|HK|CAC|DAX|FTSE|DJ|NDX)/.test(sym)) return 1; // indices
  return 100000; // standard forex
}

/**
 * Helper: get all MT5 accounts for a user
 */
const getUserAccounts = async (userId) => {
  return Mt5Account.findAll({
    where: { userId },
    attributes: ['id', 'mt5Login', 'accountType']
  });
};

/**
 * Get available trading symbols from MT5
 */
export const getSymbols = async (req, res, next) => {
  try {
    const result = await mt5Service.getSymbols();
    const rawSymbols = result.symbols || result || [];
    // Normalize: C# Gateway returns string[] while Python bridge returns object[]
    const symbols = rawSymbols.map(s =>
      typeof s === 'string' ? { name: s, trade_mode: 1, digits: 5, description: s, path: '' } : s
    );

    // Filter to tradeable symbols and format for frontend
    const formatted = symbols
      .filter(s => s.trade_mode !== 0) // exclude disabled symbols
      .map(s => ({
        name: s.name,
        description: s.description || s.name,
        digits: s.digits || 5,
        path: s.path || '',
        contractSize: s.contract_size || 100000,
        currencyBase: s.currency_base || '',
        currencyProfit: s.currency_profit || '',
      }));

    res.json(successResponse({ symbols: formatted, total: formatted.length }, 'Symbols retrieved'));
  } catch (error) {
    console.error('[Trade] Failed to fetch symbols:', error.message);
    // Return fallback symbols if bridge is down
    const fallback = [
      { name: 'EURUSD', description: 'Euro vs US Dollar', digits: 5 },
      { name: 'GBPUSD', description: 'British Pound vs US Dollar', digits: 5 },
      { name: 'USDJPY', description: 'US Dollar vs Japanese Yen', digits: 3 },
      { name: 'AUDUSD', description: 'Australian Dollar vs US Dollar', digits: 5 },
      { name: 'USDCAD', description: 'US Dollar vs Canadian Dollar', digits: 5 },
      { name: 'NZDUSD', description: 'New Zealand Dollar vs US Dollar', digits: 5 },
      { name: 'XAUUSD', description: 'Gold vs US Dollar', digits: 2 },
      { name: 'XAGUSD', description: 'Silver vs US Dollar', digits: 3 },
    ];
    res.json(successResponse({ symbols: fallback, total: fallback.length }, 'Symbols retrieved (fallback)'));
  }
};

/**
 * Get all symbols grouped by market category.
 * Also returns a symbolMap that maps base names (e.g. "EURUSD") to their
 * actual MT5 name (e.g. "EURUSD.#") so the frontend can resolve suffixes.
 */
export const getGroupedSymbols = async (req, res, next) => {
  try {
    // Use the smart resolver cache — fetches all MT5 symbols and builds the lookup
    const { allNames, baseToMt5, symbolList } = await mt5Service.getSymbolResolver();
    const symbols = (symbolList || []).filter(s => s.trade_mode !== 0);

    // Categorize each symbol
    const categorize = (s) => {
      const n = (s.name || '').toUpperCase();
      const p = (s.path || s.description || '').toLowerCase();
      // MCX
      if (p.includes('mcx') || /^CRUDEOIL|^GOLDM?$|^SILVERM?$|^NATURALGAS|^COPPER$|^ZINC$|^ALUMINIUM$|^LEAD$|^NICKEL$|^COTTON/.test(n)) return 'mcx';
      // NSE
      if (p.includes('nse') || /^NIFTY|^BANKNIFTY|^FINNIFTY|^RELIANCE|^TCS$|^HDFCBANK|^INFY$|^ICICIBANK|^SBIN$|^BHARTIARTL|^ITC$|^TATAMOTORS|^WIPRO$|^ADANIENT|^TATASTEEL/.test(n)) return 'nse';
      // Metals
      if (/^XAU|^XAG|^XPT|^XPD/.test(n) || p.includes('gold') || p.includes('silver') || p.includes('metal')) return 'metals';
      // Crypto
      if (/^BTC|^ETH|^LTC|^XRP|^DOGE|^SOL|^ADA|^BNB/.test(n) || p.includes('crypto')) return 'crypto';
      // Indices
      if (/US500|US30|USTEC|NAS100|UK100|GER40|JPN225|AUS200|SPX|DJI|DAX|FTSE|NIFTY/.test(n) || p.includes('index') || p.includes('indice')) return 'indices';
      // Energy
      if (/USOIL|UKOIL|XBR|XTI|NGAS|BRENT|WTI/.test(n) || p.includes('oil') || p.includes('energy')) return 'energy';
      // Default = forex
      return 'forex';
    };

    const groups = {};

    for (const s of symbols) {
      const cat = categorize(s);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({
        name: s.name,
        description: s.description || s.name,
        digits: s.digits || 5,
        path: s.path || '',
        category: cat,
      });
    }

    // Convert the resolver's baseToMt5 Map into a plain object for the frontend
    const symbolMap = {};
    if (baseToMt5) {
      for (const [base, mt5Name] of baseToMt5) {
        symbolMap[base] = mt5Name;
      }
    }

    console.log(`[Trade] Grouped symbols: ${symbols.length} total, ${Object.keys(groups).length} categories, ${Object.keys(symbolMap).length} mappings`);

    res.json(successResponse({
      groups,
      symbolMap,
      total: symbols.length,
      categories: Object.keys(groups),
    }, 'Grouped symbols retrieved'));
  } catch (error) {
    console.error('[Trade] Failed to fetch grouped symbols:', error.message);
    res.json(successResponse({ groups: {}, symbolMap: {}, total: 0, categories: [] }, 'Grouped symbols unavailable'));
  }
};

/**
 * Get open positions directly from MT5 (real positions via Manager API).
 * Falls back to DB if MT5 bridge is unavailable.
 * Supports ?accountId=X to filter by specific account (account isolation).
 */
export const getUserPositions = async (req, res, next) => {
  try {
    let accounts = await getUserAccounts(req.user.id);
    if (accounts.length === 0) {
      return res.json(successResponse({ positions: [], total: 0 }, 'Positions retrieved'));
    }

    // Account isolation: filter to selected account if specified
    const { accountId } = req.query;
    if (accountId) {
      accounts = accounts.filter(a => String(a.id) === String(accountId));
      if (accounts.length === 0) {
        return res.json(successResponse({ positions: [], total: 0 }, 'Positions retrieved'));
      }
    }

    const allPositions = [];

    // Fetch REAL positions from MT5 for each account
    for (const account of accounts) {
      try {
        const result = await mt5Service.getOpenPositions(account.mt5Login);
        let positions = [];
        if (Array.isArray(result)) positions = result;
        else if (result && Array.isArray(result.positions)) positions = result.positions;
        else if (result && result.data) {
          if (Array.isArray(result.data)) positions = result.data;
          else if (Array.isArray(result.data.positions)) positions = result.data.positions;
        }

        for (const pos of positions) {
          // Strip .# suffix from symbol for frontend display
          const displaySymbol = (pos.symbol || '').replace(/\.#$/, '');

          allPositions.push({
            ticket: pos.ticket || pos.position || 0,
            symbol: displaySymbol,
            type: pos.type === 'BUY' || pos.type === 0 ? 'buy' : 'sell',
            volume: parseFloat(pos.volume) || 0,
            openPrice: parseFloat(pos.price_open || pos.priceOpen) || 0,
            currentPrice: parseFloat(pos.price_current || pos.priceCurrent) || 0,
            profit: parseFloat(pos.profit) || 0,
            swap: parseFloat(pos.swap || pos.storage) || 0,
            sl: parseFloat(pos.sl || pos.price_sl) || 0,
            tp: parseFloat(pos.tp || pos.price_tp) || 0,
            openTime: pos.time_create || pos.timeCreate || null,
            mt5Login: account.mt5Login,
            accountId: account.id,
          });
        }
      } catch (err) {
        console.warn(`[Positions] Failed to get MT5 positions for login ${account.mt5Login}: ${err.message}`);
      }

      // Add DB Fallback (B-Book / Synthetic trades)
      try {
        const dbTrades = await Trade.findAll({
          where: { mt5AccountId: account.id, status: 'open' }
        });
        
        for (const dbTrade of dbTrades) {
          // Add to allPositions if not already there (by ticket/id)
          const exists = allPositions.find(p => p.ticket == dbTrade.mt5Ticket);
          if (!exists) {
            allPositions.push({
              ticket: dbTrade.mt5Ticket,
              symbol: (dbTrade.symbol || '').replace(/\.#$/, ''),
              type: dbTrade.type === 'buy' || dbTrade.type === 'BUY' ? 'buy' : 'sell',
              volume: parseFloat(dbTrade.volume) || 0,
              openPrice: parseFloat(dbTrade.openPrice) || 0,
              currentPrice: parseFloat(dbTrade.openPrice) || 0, // enriched below
              profit: parseFloat(dbTrade.profit) || 0,
              swap: parseFloat(dbTrade.swap) || 0,
              sl: parseFloat(dbTrade.sl) || 0,
              tp: parseFloat(dbTrade.tp) || 0,
              openTime: dbTrade.openTime,
              mt5Login: account.mt5Login,
              accountId: account.id,
            });
          }
        }
      } catch (dbErr) {
        console.error(`[Positions] Error fetching DB fallback:`, dbErr);
      }
    }

    // ── Enrich positions with live Redis prices ──────────────────────────
    // MT5 bridge sometimes returns currentPrice = openPrice (stale).
    // Override with the freshest price from the gateway poller.
    // Uses server-namespaced key (price:SERVER:SYMBOL) so each VPS is independent.
    const _acctServerMap = Object.fromEntries(accounts.map(a => [String(a.id), a.serverName]));

    for (const pos of allPositions) {
      try {
        const serverName = _acctServerMap[String(pos.accountId)] || null;
        const tick = await getPriceByServer(serverName, pos.symbol);
        if (tick) {
          const livePrice = pos.type === 'buy' ? (tick.bid || tick.ask) : (tick.ask || tick.bid);
          if (livePrice && livePrice > 0) {
            const openPx = parseFloat(pos.openPrice) || 0;
            const diff   = pos.type === 'buy' ? livePrice - openPx : openPx - livePrice;
            const vol    = parseFloat(pos.volume) || 0;
            // Use symbol-aware contract size — 100 000 is Forex only
            const contractSize = getContractSize(pos.symbol);
            pos.currentPrice = livePrice;
            pos.profit = parseFloat((diff * vol * contractSize).toFixed(2));
          }
        }
      } catch { /* skip enrichment for this position */ }
    }

    res.json(successResponse({ positions: allPositions, total: allPositions.length }, 'Positions retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get live pending orders from MT5
 * Supports ?accountId=X for account isolation
 */
export const getUserOrders = async (req, res, next) => {
  try {
    let accounts = await getUserAccounts(req.user.id);
    if (accounts.length === 0) {
      return res.json(successResponse({ orders: [], total: 0 }, 'Orders retrieved'));
    }

    // Account isolation
    const { accountId } = req.query;
    if (accountId) {
      accounts = accounts.filter(a => String(a.id) === String(accountId));
    }

    const allOrders = [];
    for (const account of accounts) {
      try {
        const result = await mt5Service.getPendingOrders(account.mt5Login);
        const orders = result.orders || result || [];
        orders.forEach(ord => {
          allOrders.push({
            ticket: ord.ticket || ord.order,
            symbol: ord.symbol,
            type: ord.type_str || ord.type || 'unknown',
            volume: ord.volume || ord.volume_current || 0,
            price: ord.price_order || ord.price || 0,
            sl: ord.sl || 0,
            tp: ord.tp || 0,
            status: 'active',
            mt5Login: account.mt5Login,
            accountId: account.id,
          });
        });
      } catch (err) {
        console.error(`[Trade] Failed to fetch orders for login ${account.mt5Login}:`, err.message);
      }
    }

    res.json(successResponse({ orders: allOrders, total: allOrders.length }, 'Orders retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get trade history — combines our DB (closed trades) with MT5 deal history
 * Supports ?accountId=X for account isolation
 */
export const getTradeHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, from, to, accountId } = req.query;
    let accounts = await getUserAccounts(req.user.id);
    if (accounts.length === 0) {
      return res.json(successResponse({ trades: [], total: 0 }, 'Trade history retrieved'));
    }

    // Account isolation
    if (accountId) {
      accounts = accounts.filter(a => String(a.id) === String(accountId));
    }

    const accountIds = accounts.map(a => a.id);
    const accountMap = {};
    accounts.forEach(a => { accountMap[a.id] = a; });

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get closed trades from our DB
    const whereClause = {
      mt5AccountId: { [Op.in]: accountIds },
      status: 'closed',
    };
    if (from || to) {
      whereClause.closeTime = {};
      if (from) whereClause.closeTime[Op.gte] = fromDate;
      if (to) whereClause.closeTime[Op.lte] = toDate;
    }

    const { count, rows: dbTrades } = await Trade.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['closeTime', 'DESC']],
    });

    const trades = dbTrades.map(t => {
      const account = accountMap[t.mt5AccountId];
      return {
        ticket: t.mt5Ticket,
        tradeId: t.id,
        symbol: t.symbol,
        type: t.type,
        volume: parseFloat(t.volume),
        price: parseFloat(t.openPrice),
        closePrice: parseFloat(t.closePrice) || 0,
        profit: parseFloat(t.profit) || 0,
        swap: parseFloat(t.swap) || 0,
        commission: parseFloat(t.commission) || 0,
        time: t.closeTime || t.openTime,
        openTime: t.openTime,
        closeTime: t.closeTime,
        mt5Login: account?.mt5Login,
        accountId: t.mt5AccountId,
      };
    });

    // Also fetch MT5 deal history (includes balance ops, older deals)
    for (const account of accounts) {
      try {
        const result = await mt5Service.getDealHistory(account.mt5Login, fromDate, toDate);
        const deals = result.deals || result || [];
        deals.forEach(deal => {
          const action = deal.action;
          if (action !== 0 && action !== 1) return;

          // Skip if we already have this deal from our DB
          const dealTicket = deal.ticket || deal.deal;
          if (trades.some(t => t.ticket == dealTicket)) return;

          trades.push({
            ticket: dealTicket,
            symbol: deal.symbol || '',
            type: action === 0 ? 'buy' : 'sell',
            volume: deal.volume || 0,
            price: deal.price || 0,
            profit: deal.profit || 0,
            swap: deal.swap || 0,
            commission: deal.commission || 0,
            time: deal.time_create || deal.time || null,
            mt5Login: account.mt5Login,
            accountId: account.id,
          });
        });
      } catch (err) {
        // MT5 history unavailable, DB trades are sufficient
      }
    }

    trades.sort((a, b) => {
      const timeA = a.time ? new Date(a.time).getTime() : 0;
      const timeB = b.time ? new Date(b.time).getTime() : 0;
      return timeB - timeA;
    });

    res.json(successResponse({
      trades,
      total: Math.max(count, trades.length),
      page: parseInt(page),
      limit: parseInt(limit)
    }, 'Trade history retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user trades from DB (fallback)
 */
export const getUserTrades = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const accounts = await getUserAccounts(req.user.id);
    const accountIds = accounts.map(a => a.id);
    if (accountIds.length === 0) {
      return res.json(paginatedResponse([], 0, parseInt(page), parseInt(limit), 'Trades retrieved'));
    }

    const { count, rows } = await Trade.findAndCountAll({
      where: { mt5AccountId: { [Op.in]: accountIds }, status: 'open' },
      limit: parseInt(limit),
      offset,
      order: [['openTime', 'DESC']],
      include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Trades retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Place order — execute on MT5 via bridge + save to our DB for position tracking
 */
export const placeOrder = async (req, res, next) => {
  try {
    const { mt5AccountId, symbol, type, volume, price, tp, sl, stopLoss, takeProfit } = req.body;

    const account = await Mt5Account.findByPk(mt5AccountId);
    if (!account || account.userId !== req.user.id) {
      throw new NotFoundError('Account not found');
    }

    const action = type === 'buy' || type === 'BUY' ? 'buy' : 'sell';
    const tradeVolume = parseFloat(volume) || 0.01;
    const tradeSl = parseFloat(sl || stopLoss || 0);
    const tradeTp = parseFloat(tp || takeProfit || 0);

    // ── Broker permission checks ──────────────────────────────────────────────
    const perms = await getPermissions();

    // 1. KYC required to trade
    if (perms.kyc_required_to_trade) {
      const user = await User.findByPk(req.user.id, { attributes: ['kycStatus'] });
      if (!user || user.kycStatus !== 'approved') {
        throw new BusinessError('KYC verification is required before trading. Please complete your KYC.');
      }
    }

    // 2. Max lot size
    if (perms.max_lot_size > 0 && tradeVolume > perms.max_lot_size) {
      throw new BusinessError(`Maximum allowed lot size is ${perms.max_lot_size}. Requested: ${tradeVolume}`);
    }

    // 3. Market access
    const market = classifySymbol(symbol);
    const marketKey = `market_${market}_enabled`;
    if (perms[marketKey] === false) {
      throw new BusinessError(`${market.charAt(0).toUpperCase() + market.slice(1)} trading is currently disabled.`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Balance check: reject if no balance ──
    try {
      const liveInfo = await mt5Service.getAccountInfo(account.mt5Login);
      const accountData = liveInfo?.data || liveInfo || {};
      const balance = parseFloat(accountData.balance) || 0;
      const freeMargin = parseFloat(accountData.margin_free) || parseFloat(accountData.equity) || balance;

      if (balance <= 0) {
        throw new BusinessError('Insufficient balance. Please deposit funds before trading.');
      }
      if (freeMargin <= 0) {
        throw new BusinessError('Insufficient free margin. Close some positions or deposit more funds.');
      }
      console.log(`[Trade] Balance check OK: balance=${balance}, freeMargin=${freeMargin}`);
    } catch (balErr) {
      if (balErr instanceof BusinessError) throw balErr;
      // If balance check fails due to bridge issue, allow trade through (bridge will reject if needed)
      console.warn(`[Trade] Balance check skipped (bridge unavailable): ${balErr.message}`);
    }

    // Resolve the base symbol to the actual MT5 name
    const resolvedSymbol = await mt5Service.resolveSymbol(symbol);
    console.log(`[Trade] Placing order: login=${account.mt5Login}, ${action} ${tradeVolume} ${symbol} (→ ${resolvedSymbol}), SL=${tradeSl}, TP=${tradeTp}`);

    // Execute on MT5 via bridge (openTrade also resolves, but we log it here)
    const result = await mt5Service.openTrade(
      account.mt5Login,
      resolvedSymbol,
      action,
      tradeVolume,
      tradeSl,
      tradeTp,
      'CRM Trade'
    );

    // Extract result from bridge response (may be nested in .data)
    const tradeResult = result.data || result;
    console.log(`[Trade] MT5 result:`, JSON.stringify(tradeResult));

    // Surface actual MT5 error if present (e.g. "DealPerform failed: MT_RET_REQUEST_REJECT")
    if (tradeResult.error) {
      console.error(`[Trade] MT5 rejected: ${tradeResult.error}`);
      throw new BusinessError(`Trade rejected by MT5: ${tradeResult.error}`);
    }

    // If the python bridge fell back to DealAdd, it means the real trade failed in MT5.
    // Allow the DB fallback to save the trade.
    if (tradeResult.method && tradeResult.method.toLowerCase().includes('fallback')) {
      console.warn(`[Trade] Bridge used fallback method: ${tradeResult.method}. The position will be tracked locally in the database.`);
    }

    // Validate we got a real ticket — don't fake it
    const mt5Ticket = tradeResult.position_ticket || tradeResult.deal_id || tradeResult.order_id;
    if (!mt5Ticket) {
      console.error('[Trade] MT5 returned no ticket/deal_id:', JSON.stringify(tradeResult));
      throw new BusinessError('Trade execution failed: MT5 did not return a position ticket');
    }
    const trade = await Trade.create({
      mt5AccountId: account.id,
      mt5Ticket: mt5Ticket,
      symbol,
      type: action,
      volume: tradeVolume,
      openPrice: tradeResult.price || 0,
      sl: tradeSl || null,
      tp: tradeTp || null,
      openTime: new Date(),
      status: 'open',
    });

    console.log(`[Trade] DB trade saved: id=${trade.id}, ticket=${mt5Ticket}, method=${tradeResult.method}`);

    res.status(201).json(successResponse({
      tradeId: trade.id,
      dealId: tradeResult.deal_id,
      ticket: trade.mt5Ticket,
      login: account.mt5Login,
      symbol,
      type: action,
      volume: tradeVolume,
      openPrice: tradeResult.price,
      sl: tradeSl,
      tp: tradeTp,
      message: tradeResult.message || `${action.toUpperCase()} ${tradeVolume} ${symbol} executed`,
    }, 'Trade executed'));
  } catch (error) {
    console.error('[Trade] Place order failed:', error.message);
    // Wrap raw errors to avoid circular reference issues with Axios errors
    if (error instanceof BusinessError || error instanceof NotFoundError) {
      next(error);
    } else {
      next(new BusinessError(error.message || 'Trade execution failed'));
    }
  }
};

/**
 * Close position — update our DB + record reverse deal in MT5
 */
export const closeTrade = async (req, res, next) => {
  try {
    const { tradeId } = req.params;
    const { mt5AccountId, mt5Login, ticket } = req.body;

    // Find the trade in our DB — try by tradeId first, then by ticket
    let trade = await Trade.findByPk(tradeId, {
      include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'userId'] }]
    });

    // If not found by PK, try by mt5Ticket
    if (!trade) {
      const posTicket = ticket || parseInt(tradeId);
      const accounts = await getUserAccounts(req.user.id);
      const accountIds = accounts.map(a => a.id);
      trade = await Trade.findOne({
        where: {
          mt5Ticket: posTicket,
          mt5AccountId: { [Op.in]: accountIds },
          status: 'open'
        },
        include: [{ model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'userId'] }]
      });
    }

    // ── Gateway-direct close: position exists in MT5 but has no DB record ──
    // This happens when a position was opened directly from the MT5 terminal,
    // an EA, or the mobile app — not through this platform.
    // In this case we still close it via the gateway and return success.
    if (!trade) {
      const posTicket = ticket || parseInt(tradeId);
      const closingLogin = mt5Login;

      // Verify the provided mt5Login actually belongs to this user
      if (closingLogin) {
        const userAccounts = await getUserAccounts(req.user.id);
        const owns = userAccounts.some(a => String(a.mt5Login) === String(closingLogin));
        if (!owns) throw new NotFoundError('Account not found');
      }

      if (!posTicket || !closingLogin) {
        throw new NotFoundError('Position not found — provide mt5Login and ticket in request body');
      }

      console.log(`[Trade] Gateway-direct close: login=${closingLogin} ticket=${posTicket} (no DB record)`);

      let mt5Result = null;
      let closePrice = 0;
      let directProfit = 0;
      try {
        mt5Result = await mt5Service.closeTrade(closingLogin, posTicket, 0, '', `Platform Close`);
        console.log(`[Trade] Gateway close result:`, JSON.stringify(mt5Result?.data || mt5Result));
        // Extract profit from MT5 result if available
        const d = mt5Result?.data || mt5Result;
        directProfit = parseFloat(d?.profit || d?.pnl || 0);
        closePrice = parseFloat(d?.close_price || d?.closePrice || 0);
      } catch (err) {
        console.warn(`[Trade] Gateway close failed: ${err.message}`);
        throw new BusinessError(`Failed to close position: ${err.message}`);
      }

      // Award IB commission even for gateway-direct closes (if profit > 0)
      if (directProfit > 0) {
        awardTradingCommission(req.user.id, posTicket, directProfit).catch(e =>
          console.error('[IB] Trading commission error (gateway-direct):', e.message)
        );
      }

      return res.json(successResponse({
        tradeId: null,
        dealId: mt5Result?.deal_id || mt5Result?.data?.deal_id || null,
        login: closingLogin,
        ticket: posTicket,
        closePrice,
        profit: directProfit,
        message: `Position ${posTicket} closed via MT5`,
      }, 'Position closed'));
    }

    if (trade.account?.userId !== req.user.id) {
      throw new NotFoundError('Open position not found');
    }

    if (trade.status !== 'open') {
      throw new BusinessError('Position is already closed');
    }

    const login = trade.account.mt5Login;

    console.log(`[Trade] Closing position: ticket=${trade.mt5Ticket}, login=${login}, ${trade.type} ${trade.volume} ${trade.symbol}`);

    // Close the REAL MT5 position via bridge /trade/close
    let mt5Result = null;
    let closePrice = 0;
    try {
      mt5Result = await mt5Service.closeTrade(
        login,
        trade.mt5Ticket,
        parseFloat(trade.volume) || 0,
        trade.symbol,
        `CRM Close #${trade.id}`
      );
      const closeData = mt5Result?.data || mt5Result;
      console.log(`[Trade] MT5 close result:`, JSON.stringify(closeData));
    } catch (err) {
      console.warn(`[Trade] MT5 close failed: ${err.message}`);
    }

    // Get close price from tick
    try {
      const tick = await mt5Service.getSymbolTick(trade.symbol);
      if (tick) {
        closePrice = trade.type === 'buy' ? (tick.bid || 0) : (tick.ask || 0);
      }
    } catch (err) {
      console.warn(`[Trade] Could not get close price for ${trade.symbol}`);
    }

    // Calculate profit using symbol-aware contract size
    const openP = parseFloat(trade.openPrice) || 0;
    const vol = parseFloat(trade.volume) || 0;
    const contractSize = getContractSize(trade.symbol);
    let profit = 0;
    if (closePrice > 0) {
      if (trade.type === 'buy') {
        profit = (closePrice - openP) * vol * contractSize;
      } else {
        profit = (openP - closePrice) * vol * contractSize;
      }
    }

    // Update trade in our DB (keep DB in sync)
    await trade.update({
      status: 'closed',
      closePrice: closePrice || null,
      closeTime: new Date(),
      profit: Math.round(profit * 100) / 100,
    });

    console.log(`[Trade] Position closed: ticket=${trade.mt5Ticket}, profit=${profit.toFixed(2)}`);

    // Award IB trading commissions (only on profitable trades, non-blocking)
    if (profit > 0) {
      awardTradingCommission(req.user.id, trade.id, Math.round(profit * 100) / 100).catch(e =>
        console.error('[IB] Trading commission error:', e.message)
      );
    }

    res.json(successResponse({
      tradeId: trade.id,
      dealId: mt5Result?.deal_id || null,
      login,
      ticket: trade.mt5Ticket,
      closePrice,
      profit: Math.round(profit * 100) / 100,
      message: `Position closed @ ${closePrice}`,
    }, 'Position closed'));
  } catch (error) {
    console.error('[Trade] Close trade failed:', error.message);
    if (error instanceof BusinessError || error instanceof NotFoundError) {
      next(error);
    } else {
      next(new BusinessError(error.message || 'Failed to close position'));
    }
  }
};

/**
 * Modify trade (SL/TP) — DB-only for now
 */
export const modifyTrade = async (req, res, next) => {
  try {
    const { tradeId } = req.params;
    const { tp, sl } = req.body;

    const trade = await Trade.findByPk(tradeId, {
      include: [{ model: Mt5Account, as: 'account', attributes: ['userId'] }]
    });

    if (!trade || trade.account?.userId !== req.user.id) {
      throw new NotFoundError('Trade not found');
    }

    const updates = {};
    if (tp !== undefined) updates.tp = tp;
    if (sl !== undefined) updates.sl = sl;

    await trade.update(updates);
    res.json(successResponse(trade, 'Trade modified'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get live tick (bid/ask) for a symbol.
 * Automatically tries common MT5 suffixes if the base name fails.
 */
export const getSymbolTick = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({ success: false, message: 'Symbol required' });
    }

    // Use the smart resolver to get the actual MT5 symbol name
    const resolved = await mt5Service.resolveSymbol(symbol);
    console.log(`[Trade] Tick: ${symbol} → ${resolved}`);

    try {
      const result = await mt5Service.getSymbolTick(resolved);
      const bid = parseFloat(result?.bid) || 0;
      const ask = parseFloat(result?.ask) || 0;
      if (bid > 0 || ask > 0) {
        return res.json(successResponse({ ...result, resolvedSymbol: resolved }, 'Tick retrieved'));
      }
    } catch (_) {}

    // Resolver didn't help — return zeros
    res.json(successResponse({ symbol, bid: 0, ask: 0, digits: 5, spread: 0, resolvedSymbol: resolved }, 'Tick unavailable'));
  } catch (error) {
    console.error('[Trade] Failed to fetch tick:', error.message);
    res.json(successResponse({ symbol: req.params.symbol, bid: 0, ask: 0, digits: 5, spread: 0 }, 'Tick unavailable'));
  }
};

/**
 * Get OHLC chart data for a symbol.
 * Uses smart resolver to map base name to actual MT5 symbol.
 */
export const getChartData = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { timeframe = 'M15', count = 200 } = req.query;
    if (!symbol) {
      return res.status(400).json({ success: false, message: 'Symbol required' });
    }

    // Use the smart resolver to get the actual MT5 symbol name
    const resolved = await mt5Service.resolveSymbol(symbol);
    const n = parseInt(count) || 200;

    // 1. Try Python/C# bridge (fast path when configured)
    try {
      const result = await mt5Service.getChartData(resolved, timeframe, n);
      const candles = result?.candles || result?.data || [];
      if (candles.length > 0) {
        return res.json(successResponse(result, 'Chart data retrieved'));
      }
    } catch (_) { /* bridge down — fall through */ }

    // 2. Fallback: in-memory tick aggregator (built from live Redis ticks)
    //    Try both the resolved MT5 name and the bare symbol name
    let aggCandles = getAggCandles(resolved, timeframe, n);
    if (aggCandles.length === 0 && resolved !== symbol.toUpperCase()) {
      aggCandles = getAggCandles(symbol, timeframe, n);
    }
    if (aggCandles.length > 0) {
      console.log(`[Trade] Chart fallback aggregator: ${resolved} ${timeframe} → ${aggCandles.length} bars`);
      return res.json(successResponse(
        { symbol: resolved, candles: aggCandles, count: aggCandles.length, source: 'aggregator' },
        'Chart data from live ticks'
      ));
    }

    res.json(successResponse({ symbol, candles: [], count: 0 }, 'Chart data unavailable'));
  } catch (error) {
    console.error('[Trade] Failed to fetch chart data:', error.message);
    res.json(successResponse({ symbol: req.params.symbol, candles: [], count: 0 }, 'Chart data unavailable'));
  }
};

export default { getUserTrades, getTradeHistory, getUserPositions, getUserOrders, closeTrade, modifyTrade, placeOrder, getSymbols, getGroupedSymbols, getSymbolTick, getChartData };
