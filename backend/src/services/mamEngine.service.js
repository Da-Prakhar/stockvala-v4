import { MamManager, MamAccount, MamTrade, Mt5Account } from '../models/index.js';
import mt5Service from './mt5.service.js';

/**
 * MAM (Multi-Account Manager) Engine
 *
 * Monitors manager's MT5 positions and replicates them to investor sub-accounts.
 * Like copy trading, but with proper lot allocation methods:
 *   - percent: investor gets (allocationPct / 100) * manager's lots
 *   - lot: fixed lot size based on investor's allocation
 *   - equity: proportional to investor equity vs manager equity
 */

// Track known manager positions: { managerId: { ticket: positionData } }
const managerPositions = {};

const POLL_INTERVAL = parseInt(process.env.MAM_POLL_INTERVAL) || 3000;
let pollingTimer = null;

/**
 * Calculate investor lot size based on allocation method
 */
function calculateInvestorLots(managerLots, investor, manager, managerEquity, investorEquity) {
  const method = manager.allocationMethod || 'percent';
  const allocationPct = parseFloat(investor.allocationPct) || 100;
  const mLots = parseFloat(managerLots);

  switch (method) {
    case 'percent':
      // Investor gets allocationPct% of manager's lot size
      return Math.max(0.01, Math.round(mLots * (allocationPct / 100) * 100) / 100);

    case 'equity':
      // Proportional to equity ratio
      if (managerEquity > 0 && investorEquity > 0) {
        const proportional = (investorEquity / managerEquity) * mLots;
        return Math.max(0.01, Math.round(proportional * 100) / 100);
      }
      // Fallback to percent method
      return Math.max(0.01, Math.round(mLots * (allocationPct / 100) * 100) / 100);

    case 'lot':
      // Fixed lot size = allocationPct interpreted as lot multiplier (e.g., 50 = 0.5x)
      return Math.max(0.01, Math.round(mLots * (allocationPct / 100) * 100) / 100);

    default:
      return Math.max(0.01, Math.round(mLots * (allocationPct / 100) * 100) / 100);
  }
}

/**
 * Open a replicated trade on an investor's MT5 account
 */
async function openMamTrade(manager, investor, managerPosition) {
  try {
    const investorAccount = await Mt5Account.findByPk(investor.investorMt5AccountId);
    if (!investorAccount) {
      console.error(`[MAMEngine] Investor ${investor.id} has no MT5 account`);
      return;
    }

    // Get equities for proportional sizing
    let investorEquity = parseFloat(investor.investedAmount) || 1000;
    let managerEquity = 10000;
    try {
      const invAccInfo = await mt5Service.getAccountInfo(investorAccount.mt5Login);
      const invData = invAccInfo?.data || invAccInfo || {};
      if (invData.equity) investorEquity = invData.equity;
    } catch (e) { /* use invested amount as fallback */ }

    try {
      const managerAccount = await Mt5Account.findByPk(manager.mt5AccountId);
      if (managerAccount) {
        const mgrAccInfo = await mt5Service.getAccountInfo(managerAccount.mt5Login);
        const mgrData = mgrAccInfo?.data || mgrAccInfo || {};
        if (mgrData.equity) managerEquity = mgrData.equity;
      }
    } catch (e) { /* use default */ }

    // Normalize trade direction from bridge (uppercase BUY/SELL)
    const action = (managerPosition.type || 'buy').toLowerCase();
    let lots = calculateInvestorLots(managerPosition.volume, investor, manager, managerEquity, investorEquity);

    console.log(`[MAMEngine] Replicating trade: manager ${manager.id} → investor ${investor.id} | ${action} ${lots} ${managerPosition.symbol}`);

    const tradeResult = await mt5Service.openTrade(
      investorAccount.mt5Login,
      managerPosition.symbol,
      action,
      lots
    );

    // Bridge returns position_ticket or deal_id
    const investorTicket = tradeResult?.position_ticket || tradeResult?.deal_id || tradeResult?.ticket || null;
    const tradeSuccess = investorTicket || tradeResult?.success;

    await MamTrade.create({
      mamManagerId: manager.id,
      mamAccountId: investor.id,
      managerTicket: String(managerPosition.ticket),
      investorTicket: investorTicket ? String(investorTicket) : null,
      symbol: managerPosition.symbol,
      action,
      managerLots: managerPosition.volume,
      investorLots: lots,
      openPrice: managerPosition.price_open || managerPosition.openPrice || null,
      status: tradeSuccess ? 'open' : 'failed',
      errorMessage: tradeSuccess ? null : (tradeResult?.error || tradeResult?.message || 'Trade execution failed'),
      openedAt: new Date()
    });

    console.log(`[MAMEngine] MAM trade opened: investor ticket ${investorTicket || 'FAILED'}`);
  } catch (error) {
    console.error(`[MAMEngine] Error replicating trade for investor ${investor.id}:`, error.message);
    try {
      await MamTrade.create({
        mamManagerId: manager.id,
        mamAccountId: investor.id,
        managerTicket: String(managerPosition.ticket),
        symbol: managerPosition.symbol,
        action: (managerPosition.type || 'buy').toLowerCase(),
        managerLots: managerPosition.volume || 0,
        investorLots: 0,
        status: 'failed',
        errorMessage: error.message,
        openedAt: new Date()
      });
    } catch (e) { /* ignore logging failure */ }
  }
}

/**
 * Close a replicated trade on an investor's MT5 account
 */
async function closeMamTrade(mamTrade) {
  try {
    if (!mamTrade.investorTicket) {
      console.log(`[MAMEngine] No investor ticket for MAM trade ${mamTrade.id} — marking closed`);
      await mamTrade.update({ status: 'closed', closedAt: new Date() });
      return;
    }

    const mamAccount = await MamAccount.findByPk(mamTrade.mamAccountId);
    if (!mamAccount) return;

    const investorAccount = await Mt5Account.findByPk(mamAccount.investorMt5AccountId);
    if (!investorAccount) return;

    console.log(`[MAMEngine] Closing MAM trade: investor ticket ${mamTrade.investorTicket} on login ${investorAccount.mt5Login}`);

    const result = await mt5Service.closeTrade(
      investorAccount.mt5Login,
      parseInt(mamTrade.investorTicket),
      `MAMEngine close: ${mamTrade.symbol}`
    );

    const profit = result?.profit || 0;

    // Calculate performance fee
    const manager = await MamManager.findByPk(mamTrade.mamManagerId);
    const performanceFeePct = parseFloat(manager?.performanceFeePct) || 0;
    const fee = profit > 0 ? Math.round(profit * (performanceFeePct / 100) * 100) / 100 : 0;

    await mamTrade.update({
      status: 'closed',
      closePrice: result?.price || null,
      profit,
      fee,
      closedAt: new Date()
    });

    // Update investor's currentValue
    const totalProfit = await MamTrade.sum('profit', {
      where: { mamAccountId: mamTrade.mamAccountId, status: 'closed' }
    }) || 0;
    const totalFees = await MamTrade.sum('fee', {
      where: { mamAccountId: mamTrade.mamAccountId, status: 'closed' }
    }) || 0;
    const investedAmount = parseFloat(mamAccount.investedAmount) || 0;
    await mamAccount.update({ currentValue: investedAmount + totalProfit - totalFees });

    console.log(`[MAMEngine] MAM trade closed: profit ${profit}, fee ${fee}`);
  } catch (error) {
    console.error(`[MAMEngine] Error closing MAM trade ${mamTrade.id}:`, error.message);
  }
}

/**
 * Poll a single MAM manager's positions
 */
async function pollManager(manager) {
  try {
    const managerAccount = await Mt5Account.findByPk(manager.mt5AccountId);
    if (!managerAccount?.mt5Login) return;

    const posResponse = await mt5Service.getOpenPositions(managerAccount.mt5Login);
    const currentPositions = Array.isArray(posResponse)
      ? posResponse
      : (posResponse?.positions || []);
    const currentTickets = new Set(currentPositions.map(p => String(p.ticket)));

    if (!managerPositions[manager.id]) managerPositions[manager.id] = {};
    const tracked = managerPositions[manager.id];
    const trackedTickets = new Set(Object.keys(tracked));

    // Get active investors
    const investors = await MamAccount.findAll({
      where: { managerId: manager.id, status: 'active' }
    });
    if (investors.length === 0) return;

    // Log position count changes
    if (currentPositions.length !== Object.keys(tracked).length) {
      console.log(`[MAMEngine] Manager ${manager.id} (login ${managerAccount.mt5Login}): ${currentPositions.length} MT5 positions, ${Object.keys(tracked).length} tracked, ${investors.length} investors`);
    }

    // Detect NEW positions
    for (const pos of currentPositions) {
      const ticket = String(pos.ticket);
      if (!trackedTickets.has(ticket)) {
        console.log(`[MAMEngine] New position detected: manager ${manager.id}, ticket ${ticket}, ${pos.symbol}`);
        tracked[ticket] = pos;
        for (const investor of investors) {
          await openMamTrade(manager, investor, pos);
        }
      }
    }

    // Detect CLOSED positions
    for (const ticket of trackedTickets) {
      if (!currentTickets.has(ticket)) {
        console.log(`[MAMEngine] Position closed: manager ${manager.id}, ticket ${ticket}`);
        delete tracked[ticket];
        const openMamTrades = await MamTrade.findAll({
          where: { mamManagerId: manager.id, managerTicket: ticket, status: 'open' }
        });
        for (const mt of openMamTrades) {
          await closeMamTrade(mt);
        }
      }
    }
  } catch (error) {
    console.error(`[MAMEngine] Error polling manager ${manager.id}:`, error.message);
  }
}

/**
 * Main polling loop
 */
let pollCount = 0;
async function pollAllManagers() {
  try {
    const managers = await MamManager.findAll({
      where: { isActive: true }
    });

    pollCount++;
    if (pollCount % 20 === 1) {
      console.log(`[MAMEngine] Poll #${pollCount}: ${managers.length} active managers`);
    }

    for (const manager of managers) {
      await pollManager(manager);
    }
  } catch (error) {
    console.error('[MAMEngine] Polling error:', error.message);
  }
}

/**
 * Initialize: snapshot current manager positions to avoid re-replicating on cold start
 */
async function initializePositionTracking() {
  try {
    const managers = await MamManager.findAll({ where: { isActive: true } });
    for (const manager of managers) {
      const managerAccount = await Mt5Account.findByPk(manager.mt5AccountId);
      if (!managerAccount?.mt5Login) continue;
      try {
        const posResponse = await mt5Service.getOpenPositions(managerAccount.mt5Login);
        const positions = Array.isArray(posResponse) ? posResponse : (posResponse?.positions || []);
        managerPositions[manager.id] = {};
        for (const pos of positions) {
          managerPositions[manager.id][String(pos.ticket)] = pos;
        }
        console.log(`[MAMEngine] Init: manager ${manager.id} (login ${managerAccount.mt5Login}) has ${positions.length} existing positions`);
      } catch (e) {
        console.error(`[MAMEngine] Init: failed to snapshot manager ${manager.id}:`, e.message);
        managerPositions[manager.id] = {};
      }
    }
    console.log(`[MAMEngine] Initialized position tracking for ${managers.length} managers`);
  } catch (error) {
    console.error('[MAMEngine] Init error:', error.message);
  }
}

/**
 * Start the MAM engine
 */
export async function startMamEngine() {
  if (pollingTimer) {
    console.log('[MAMEngine] Already running');
    return;
  }
  console.log(`[MAMEngine] Starting MAM engine (poll every ${POLL_INTERVAL / 1000}s)`);
  await initializePositionTracking();
  pollingTimer = setInterval(pollAllManagers, POLL_INTERVAL);
}

/**
 * Stop the MAM engine
 */
export function stopMamEngine() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log('[MAMEngine] Stopped');
  }
}

export default { startMamEngine, stopMamEngine };
