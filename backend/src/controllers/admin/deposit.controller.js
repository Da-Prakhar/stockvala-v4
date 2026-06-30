import { Deposit, Mt5Account, AuditLog, User, PaymentMethod, Wallet, WalletTransaction } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import * as mt5Service from '../../services/mt5.service.js';
import { awardDepositCommission } from '../../services/ibCommission.service.js';

/**
 * Find or create a wallet for a user.
 * Used when logging admin-initiated transactions so they appear in user's history.
 */
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) wallet = await Wallet.create({ userId, balance: 0, currency: 'USD' });
  return wallet;
};

/**
 * Write a WalletTransaction log entry visible to the user.
 * For direct MT5 operations (admin manual deposit/withdrawal) the wallet balance
 * does NOT change — the money moves in MT5 only. This record exists purely so
 * the user can see the transaction in their history page.
 */
const logUserTransaction = async ({ userId, type, amount, mt5Login, description, referenceType }) => {
  try {
    const wallet = await getOrCreateWallet(userId);
    const currentBalance = parseFloat(wallet.balance) || 0;
    await WalletTransaction.create({
      walletId: wallet.id,
      type,
      amount: type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount),
      balanceBefore: currentBalance,
      balanceAfter: currentBalance,   // wallet balance unchanged — MT5 direct operation
      referenceType,
      description,
    });
  } catch (err) {
    console.warn(`[TxLog] Failed to write user transaction log (non-critical): ${err.message}`);
  }
};

export const getPendingDeposits = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Deposit.findAndCountAll({
      where: { status: 'pending' },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Pending deposits retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getAllDeposits = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const { count, rows } = await Deposit.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Deposits retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getDepositDetails = async (req, res, next) => {
  try {
    const { depositId } = req.params;

    const deposit = await Deposit.findByPk(depositId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType', 'balance'] }
      ]
    });

    if (!deposit) {
      throw new NotFoundError('Deposit not found');
    }

    res.json(successResponse(deposit, 'Deposit details retrieved'));
  } catch (error) {
    next(error);
  }
};

export const approveDeposit = async (req, res, next) => {
  try {
    const deposit = await Deposit.findByPk(req.params.depositId, {
      include: [
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Deposit is already ${deposit.status}` });
    }

    // Resolve MT5 account: use linked account, or admin-supplied override, or user's primary account
    const overrideAccountId = req.body.mt5AccountId;
    let account = deposit.account || (deposit.mt5AccountId ? await Mt5Account.findByPk(deposit.mt5AccountId) : null);
    if (!account && overrideAccountId) {
      account = await Mt5Account.findByPk(overrideAccountId);
    }
    if (!account) {
      // Auto-pick user's primary (first) MT5 account
      account = await Mt5Account.findOne({ where: { userId: deposit.userId }, order: [['createdAt', 'ASC']] });
    }
    if (!account) {
      return res.status(400).json({ success: false, message: 'No MT5 account linked to this user. Cannot credit.' });
    }

    // If deposit had no account linked, link it now
    if (!deposit.mt5AccountId) {
      await deposit.update({ mt5AccountId: account.id });
    }

    // Call MT5 to deposit funds
    const bridgeComment = `Deposit ${deposit.id} approved by admin ${req.user.id}`;
    try {
      await mt5Service.deposit(account.mt5Login, deposit.amount, bridgeComment);
    } catch (bridgeErr) {
      console.error(`[Deposit] MT5 bridge error for deposit ${deposit.id}:`, bridgeErr.message);
      return res.status(502).json({ success: false, message: `MT5 credit failed: ${bridgeErr.message}` });
    }

    // Update deposit status to approved
    await deposit.update({
      status: 'approved',
      approvedBy: req.user.id
    });

    console.log(`[Deposit] Approved deposit ${deposit.id} for MT5 account ${account.mt5Login}`);

    // Award IB commissions up the referral chain (non-blocking — never fails the deposit)
    awardDepositCommission(deposit.userId, deposit.id, parseFloat(deposit.amount)).catch(e =>
      console.error('[IB] Deposit commission error:', e.message)
    );

    // User-visible transaction log (non-blocking)
    await logUserTransaction({
      userId: deposit.userId,
      type: 'deposit',
      amount: parseFloat(deposit.amount),
      mt5Login: account.mt5Login,
      description: `Deposit #${deposit.id} approved — credited to MT5 account ${account.mt5Login}`,
      referenceType: 'deposit_approved',
    });

    // Admin audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'DEPOSIT_APPROVED',
          entityType: 'Deposit',
          entityId: deposit.id,
          changes: { status: 'approved', amount: deposit.amount, mt5Login: account.mt5Login },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      }
    } catch (auditErr) {
      console.warn(`[Deposit] Audit log failed (non-critical): ${auditErr.message}`);
    }

    res.json(successResponse(deposit, 'Deposit approved and credited to MT5 account'));
  } catch (error) {
    console.error(`[Deposit] Error approving deposit ${req.params.depositId}:`, error.message);
    next(error);
  }
};

export const rejectDeposit = async (req, res, next) => {
  try {
    const { rejectionReason, reason } = req.body;
    const rejectNote = rejectionReason || reason || '';
    const deposit = await Deposit.findByPk(req.params.depositId);
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Deposit is already ${deposit.status}` });
    }

    const account = await Mt5Account.findByPk(deposit.mt5AccountId);

    await deposit.update({
      status: 'rejected',
      adminNotes: rejectNote
    });

    console.log(`[Deposit] Rejected deposit ${deposit.id}: ${rejectNote}`);

    // Log audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'DEPOSIT_REJECTED',
          entityType: 'Deposit',
          entityId: deposit.id,
          changes: {
            status: 'rejected',
            reason: rejectNote,
            mt5Login: account?.mt5Login
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      }
    } catch (auditErr) {
      console.warn(`[Deposit] Audit log failed (non-critical): ${auditErr.message}`);
    }

    res.json(successResponse(deposit, 'Deposit rejected'));
  } catch (error) {
    console.error(`[Deposit] Error rejecting deposit ${req.params.depositId}:`, error.message);
    next(error);
  }
};

export const manualDeposit = async (req, res, next) => {
  try {
    const { mt5Login, amount, comment } = req.body;

    if (!mt5Login || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'mt5Login and a positive amount are required' });
    }

    const account = await Mt5Account.findOne({ where: { mt5Login: String(mt5Login) } });
    if (!account) {
      return res.status(404).json({ success: false, message: `No MT5 account found with login ${mt5Login}` });
    }

    const bridgeComment = comment || `Manual deposit by admin ${req.user.id}`;

    try {
      await mt5Service.deposit(account.mt5Login, parseFloat(amount), bridgeComment);
    } catch (bridgeErr) {
      console.error(`[ManualDeposit] MT5 bridge error for login ${mt5Login}:`, bridgeErr.message);
      return res.status(502).json({ success: false, message: `MT5 credit failed: ${bridgeErr.message}` });
    }

    console.log(`[ManualDeposit] Admin ${req.user.id} credited ${amount} to MT5 ${mt5Login}`);

    // User-visible transaction log (non-blocking)
    await logUserTransaction({
      userId: account.userId,
      type: 'deposit',
      amount: parseFloat(amount),
      mt5Login: account.mt5Login,
      description: `Manual deposit by admin — credited to MT5 account ${account.mt5Login}${comment ? ': ' + comment : ''}`,
      referenceType: 'admin_manual_deposit',
    });

    // Admin audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'MANUAL_DEPOSIT',
          entityType: 'Mt5Account',
          entityId: account.id,
          changes: { amount: parseFloat(amount), mt5Login: account.mt5Login, comment: bridgeComment },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      }
    } catch (auditErr) {
      console.warn(`[ManualDeposit] Audit log failed (non-critical): ${auditErr.message}`);
    }

    res.json(successResponse({ mt5Login: account.mt5Login, amount: parseFloat(amount), comment: bridgeComment }, 'Manual deposit credited successfully'));
  } catch (error) {
    console.error(`[ManualDeposit] Error:`, error.message);
    next(error);
  }
};

export default { getPendingDeposits, getAllDeposits, getDepositDetails, approveDeposit, rejectDeposit, manualDeposit };
