import { Wallet, WalletTransaction, User, Mt5Account, Deposit, Withdrawal } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import mt5Service from '../services/mt5.service.js';

/**
 * Helper: get or create wallet
 */
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0 });
  }
  return wallet;
}

// ============================================================================
// BALANCE & TRANSACTIONS
// ============================================================================

export const getWalletBalance = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    res.json(successResponse(wallet, 'Wallet balance retrieved'));
  } catch (error) { next(error); }
};

export const getWalletTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const offset = (page - 1) * limit;

    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.json(paginatedResponse([], 0, parseInt(page), parseInt(limit), 'No transactions'));
    }

    const where = { walletId: wallet.id };
    if (type) where.type = type;

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Transactions retrieved'));
  } catch (error) { next(error); }
};

// ============================================================================
// DEPOSIT TO WALLET (manual — admin approves, or instant for testing)
// ============================================================================

/**
 * Request a deposit into wallet.
 * For now this is an instant self-credit (like a top-up).
 * In production you'd integrate a payment gateway and make this pending until confirmed.
 */
export const depositToWallet = async (req, res, next) => {
  try {
    const { amount, method = 'manual' } = req.body;
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new BusinessError('Invalid deposit amount');
    }
    if (depositAmount > 1000000) {
      throw new BusinessError('Maximum single deposit is $1,000,000');
    }

    const wallet = await getOrCreateWallet(req.user.id);
    const balanceBefore = parseFloat(wallet.balance) || 0;
    const balanceAfter = balanceBefore + depositAmount;

    await wallet.update({ balance: balanceAfter });

    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'deposit',
      amount: depositAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'wallet_deposit',
      description: `Wallet deposit via ${method}: +$${depositAmount.toFixed(2)}`
    });

    res.status(201).json(successResponse({
      transaction,
      walletBalance: balanceAfter
    }, `$${depositAmount.toFixed(2)} deposited to wallet`));
  } catch (error) { next(error); }
};

// ============================================================================
// WITHDRAW FROM WALLET
// ============================================================================

/**
 * Request a withdrawal from wallet.
 * Deducts immediately and creates a pending withdrawal record.
 */
export const withdrawFromWallet = async (req, res, next) => {
  try {
    const { amount, method = 'bank', bankDetails } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      throw new BusinessError('Invalid withdrawal amount');
    }

    const wallet = await getOrCreateWallet(req.user.id);
    const balanceBefore = parseFloat(wallet.balance) || 0;

    if (balanceBefore < withdrawAmount) {
      throw new BusinessError(`Insufficient wallet balance. Available: $${balanceBefore.toFixed(2)}`);
    }

    const balanceAfter = balanceBefore - withdrawAmount;
    await wallet.update({ balance: balanceAfter });

    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'withdrawal',
      amount: -withdrawAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'wallet_withdrawal',
      description: `Wallet withdrawal via ${method}: -$${withdrawAmount.toFixed(2)}`
    });

    res.json(successResponse({
      transaction,
      walletBalance: balanceAfter
    }, `$${withdrawAmount.toFixed(2)} withdrawn from wallet. Processing will take 1-3 business days.`));
  } catch (error) { next(error); }
};

// ============================================================================
// FUND MT5 ACCOUNT FROM WALLET
// ============================================================================

/**
 * Transfer funds from wallet to an MT5 account (deposit to MT5 via bridge)
 */
export const fundMt5Account = async (req, res, next) => {
  try {
    const { mt5AccountId, amount } = req.body;
    const fundAmount = parseFloat(amount);

    if (isNaN(fundAmount) || fundAmount <= 0) {
      throw new BusinessError('Invalid amount');
    }

    // Validate MT5 account
    const mt5Account = await Mt5Account.findOne({
      where: { id: mt5AccountId, userId: req.user.id }
    });
    if (!mt5Account) throw new NotFoundError('MT5 account not found or does not belong to you');

    // Check wallet balance
    const wallet = await getOrCreateWallet(req.user.id);
    const balanceBefore = parseFloat(wallet.balance) || 0;

    if (balanceBefore < fundAmount) {
      throw new BusinessError(`Insufficient wallet balance. Available: $${balanceBefore.toFixed(2)}`);
    }

    // Deposit to MT5 via bridge
    try {
      await mt5Service.deposit(mt5Account.mt5Login, fundAmount, `Wallet fund: $${fundAmount}`);
    } catch (mt5Err) {
      throw new BusinessError(`MT5 deposit failed: ${mt5Err.message}`);
    }

    // Deduct from wallet
    const balanceAfter = balanceBefore - fundAmount;
    await wallet.update({ balance: balanceAfter });

    await WalletTransaction.create({
      walletId: wallet.id,
      type: 'transfer',
      amount: -fundAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'mt5_fund',
      referenceId: mt5Account.id,
      description: `Fund MT5 #${mt5Account.mt5Login}: -$${fundAmount.toFixed(2)}`
    });

    res.json(successResponse({
      walletBalance: balanceAfter,
      mt5Login: mt5Account.mt5Login,
      fundedAmount: fundAmount
    }, `$${fundAmount.toFixed(2)} transferred to MT5 #${mt5Account.mt5Login}`));
  } catch (error) { next(error); }
};

// ============================================================================
// WITHDRAW FROM MT5 TO WALLET
// ============================================================================

/**
 * Pull funds from MT5 account back to wallet
 */
export const withdrawMt5ToWallet = async (req, res, next) => {
  try {
    const { mt5AccountId, amount } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      throw new BusinessError('Invalid amount');
    }

    const mt5Account = await Mt5Account.findOne({
      where: { id: mt5AccountId, userId: req.user.id }
    });
    if (!mt5Account) throw new NotFoundError('MT5 account not found');

    // Check MT5 balance
    try {
      const accRaw = await mt5Service.getAccountInfo(mt5Account.mt5Login);
      const accInfo = accRaw?.data || accRaw || {};
      const mt5Balance = parseFloat(accInfo.balance) || 0;
      if (mt5Balance < withdrawAmount) {
        throw new BusinessError(`Insufficient MT5 balance. Available: $${mt5Balance.toFixed(2)}`);
      }
    } catch (e) {
      if (e instanceof BusinessError) throw e;
      throw new BusinessError(`Could not verify MT5 balance: ${e.message}`);
    }

    // Withdraw from MT5 via bridge
    try {
      await mt5Service.withdraw(mt5Account.mt5Login, withdrawAmount, `Wallet withdraw: $${withdrawAmount}`);
    } catch (mt5Err) {
      throw new BusinessError(`MT5 withdrawal failed: ${mt5Err.message}`);
    }

    // Credit to wallet
    const wallet = await getOrCreateWallet(req.user.id);
    const balanceBefore = parseFloat(wallet.balance) || 0;
    const balanceAfter = balanceBefore + withdrawAmount;
    await wallet.update({ balance: balanceAfter });

    await WalletTransaction.create({
      walletId: wallet.id,
      type: 'deposit',
      amount: withdrawAmount,
      balanceBefore,
      balanceAfter,
      referenceType: 'mt5_withdraw',
      referenceId: mt5Account.id,
      description: `MT5 #${mt5Account.mt5Login} → Wallet: +$${withdrawAmount.toFixed(2)}`
    });

    res.json(successResponse({
      walletBalance: balanceAfter,
      mt5Login: mt5Account.mt5Login,
      withdrawnAmount: withdrawAmount
    }, `$${withdrawAmount.toFixed(2)} transferred from MT5 #${mt5Account.mt5Login} to wallet`));
  } catch (error) { next(error); }
};

// ============================================================================
// TRANSFER TO ANOTHER USER
// ============================================================================

export const transferFunds = async (req, res, next) => {
  try {
    const { amount, toUserId, description } = req.body;
    const transferAmount = parseFloat(amount);

    if (isNaN(transferAmount) || transferAmount <= 0) {
      throw new BusinessError('Invalid amount');
    }
    if (parseInt(toUserId) === req.user.id) {
      throw new BusinessError('Cannot transfer to yourself');
    }

    const fromWallet = await getOrCreateWallet(req.user.id);
    const fromBalance = parseFloat(fromWallet.balance) || 0;

    if (fromBalance < transferAmount) {
      throw new BusinessError(`Insufficient balance. Available: $${fromBalance.toFixed(2)}`);
    }

    const recipientUser = await User.findByPk(toUserId);
    if (!recipientUser) throw new NotFoundError('Recipient not found');

    const toWallet = await getOrCreateWallet(toUserId);
    const toBalance = parseFloat(toWallet.balance) || 0;

    // Update balances
    const fromAfter = fromBalance - transferAmount;
    const toAfter = toBalance + transferAmount;

    await fromWallet.update({ balance: fromAfter });
    await toWallet.update({ balance: toAfter });

    await WalletTransaction.create({
      walletId: fromWallet.id,
      type: 'transfer',
      amount: -transferAmount,
      balanceBefore: fromBalance,
      balanceAfter: fromAfter,
      referenceType: 'user_transfer',
      referenceId: toUserId,
      description: `Transfer to ${recipientUser.firstName || ''} ${recipientUser.lastName || ''} (ID: ${toUserId})${description ? ': ' + description : ''}`
    });

    await WalletTransaction.create({
      walletId: toWallet.id,
      type: 'transfer',
      amount: transferAmount,
      balanceBefore: toBalance,
      balanceAfter: toAfter,
      referenceType: 'user_transfer',
      referenceId: req.user.id,
      description: `Transfer from user ${req.user.id}${description ? ': ' + description : ''}`
    });

    res.json(successResponse({
      walletBalance: fromAfter,
      transferredAmount: transferAmount,
      recipient: `${recipientUser.firstName || ''} ${recipientUser.lastName || ''}`.trim()
    }, `$${transferAmount.toFixed(2)} transferred successfully`));
  } catch (error) { next(error); }
};

// ============================================================================
// WALLET SUMMARY (for dashboard widgets)
// ============================================================================

export const getWalletSummary = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user.id);

    // Get recent transactions
    const recentTxns = await WalletTransaction.findAll({
      where: { walletId: wallet.id },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Get totals
    const totalDeposits = await WalletTransaction.sum('amount', {
      where: { walletId: wallet.id, type: 'deposit' }
    }) || 0;

    const totalWithdrawals = Math.abs(await WalletTransaction.sum('amount', {
      where: { walletId: wallet.id, type: 'withdrawal' }
    }) || 0);

    const pammPayouts = await WalletTransaction.sum('amount', {
      where: { walletId: wallet.id, type: 'pamm_payout' }
    }) || 0;

    // Get user's MT5 accounts
    const mt5Accounts = await Mt5Account.findAll({
      where: { userId: req.user.id, status: 'active' },
      attributes: ['id', 'mt5Login', 'accountType', 'balance']
    });

    // Enrich with live balances
    const enrichedAccounts = await Promise.all(mt5Accounts.map(async (acc) => {
      const json = acc.toJSON();
      try {
        const accRaw = await mt5Service.getAccountInfo(acc.mt5Login);
        const accInfo = accRaw?.data || accRaw || {};
        json.liveBalance = parseFloat(accInfo.balance) || 0;
        json.liveEquity = parseFloat(accInfo.equity) || 0;
      } catch (e) {
        json.liveBalance = parseFloat(acc.balance) || 0;
        json.liveEquity = 0;
      }
      return json;
    }));

    res.json(successResponse({
      balance: parseFloat(wallet.balance) || 0,
      currency: wallet.currency,
      totalDeposits,
      totalWithdrawals,
      pammPayouts,
      recentTransactions: recentTxns,
      mt5Accounts: enrichedAccounts
    }, 'Wallet summary retrieved'));
  } catch (error) { next(error); }
};

export default {
  getWalletBalance,
  getWalletTransactions,
  depositToWallet,
  withdrawFromWallet,
  fundMt5Account,
  withdrawMt5ToWallet,
  transferFunds,
  getWalletSummary
};
