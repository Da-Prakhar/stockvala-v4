import { Withdrawal, Mt5Account, AuditLog, User, Wallet, WalletTransaction } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import * as mt5Service from '../../services/mt5.service.js';
import emailService from '../../services/email.service.js';

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ where: { userId } });
  if (!wallet) wallet = await Wallet.create({ userId, balance: 0, currency: 'USD' });
  return wallet;
};

/**
 * Write a WalletTransaction log entry visible to the user.
 * Wallet balance is NOT changed for direct MT5 operations — this is a visibility record only.
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
      balanceAfter: currentBalance,
      referenceType,
      description,
    });
  } catch (err) {
    console.warn(`[TxLog] Failed to write user transaction log (non-critical): ${err.message}`);
  }
};

export const getPendingWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Withdrawal.findAndCountAll({
      where: { status: 'pending' },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Pending withdrawals retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getAllWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const { count, rows } = await Withdrawal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Withdrawals retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getWithdrawalDetails = async (req, res, next) => {
  try {
    const { withdrawalId } = req.params;

    const withdrawal = await Withdrawal.findByPk(withdrawalId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType', 'balance'] }
      ]
    });

    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found');
    }

    res.json(successResponse(withdrawal, 'Withdrawal details retrieved'));
  } catch (error) {
    next(error);
  }
};

export const approveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findByPk(req.params.withdrawalId, {
      include: [
        { model: Mt5Account, as: 'account', attributes: ['id', 'mt5Login', 'accountType'] }
      ]
    });
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is already ${withdrawal.status}` });
    }

    const account = withdrawal.account || await Mt5Account.findByPk(withdrawal.mt5AccountId);
    if (!account) {
      return res.status(400).json({ success: false, message: 'No MT5 account linked to this withdrawal. Cannot debit.' });
    }

    // Call MT5 bridge to withdraw funds — must succeed before we mark approved
    const bridgeComment = `Withdrawal ${withdrawal.id} approved by admin ${req.user.id}`;
    try {
      await mt5Service.withdraw(account.mt5Login, withdrawal.amount, bridgeComment);
    } catch (bridgeErr) {
      console.error(`[Withdrawal] MT5 bridge error for withdrawal ${withdrawal.id}:`, bridgeErr.message);
      return res.status(502).json({ success: false, message: `MT5 debit failed: ${bridgeErr.message}` });
    }

    // Only update status after MT5 debit succeeds
    await withdrawal.update({
      status: 'approved',
      approvedBy: req.user.id
    });

    console.log(`[Withdrawal] Approved withdrawal ${withdrawal.id} for MT5 account ${account.mt5Login}`);

    // User-visible transaction log (non-blocking)
    await logUserTransaction({
      userId: withdrawal.userId,
      type: 'withdrawal',
      amount: parseFloat(withdrawal.amount),
      mt5Login: account.mt5Login,
      description: `Withdrawal #${withdrawal.id} approved — debited from MT5 account ${account.mt5Login}`,
      referenceType: 'withdrawal_approved',
    });

    // Admin audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'WITHDRAWAL_APPROVED',
          entityType: 'Withdrawal',
          entityId: withdrawal.id,
          changes: { status: 'approved', amount: withdrawal.amount, mt5Login: account.mt5Login },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      }
    } catch (auditErr) {
      console.warn(`[Withdrawal] Audit log failed (non-critical): ${auditErr.message}`);
    }

    // Email: withdrawal approved
    User.findByPk(withdrawal.userId, { attributes: ['email', 'firstName'] }).then(u => {
      if (u) emailService.sendWithdrawalConfirmationEmail(u.email, { amount: withdrawal.amount }).catch(() => {});
    }).catch(() => {});

    res.json(successResponse(withdrawal, 'Withdrawal approved and debited from MT5 account'));
  } catch (error) {
    console.error(`[Withdrawal] Error approving withdrawal ${req.params.withdrawalId}:`, error.message);
    next(error);
  }
};

export const rejectWithdrawal = async (req, res, next) => {
  try {
    const { rejectionReason, reason } = req.body;
    const rejectNote = rejectionReason || reason || '';

    const withdrawal = await Withdrawal.findByPk(req.params.withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is already ${withdrawal.status}` });
    }

    const account = await Mt5Account.findByPk(withdrawal.mt5AccountId);

    await withdrawal.update({
      status: 'rejected',
      adminNotes: rejectNote
    });

    console.log(`[Withdrawal] Rejected withdrawal ${withdrawal.id}: ${rejectNote}`);

    // Log audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'WITHDRAWAL_REJECTED',
          entityType: 'Withdrawal',
          entityId: withdrawal.id,
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
      console.warn(`[Withdrawal] Audit log failed (non-critical): ${auditErr.message}`);
    }

    // Email: withdrawal rejected
    User.findByPk(withdrawal.userId, { attributes: ['email', 'firstName'] }).then(u => {
      if (u) emailService.sendWithdrawalRejectedEmail(u.email, rejectNote).catch(() => {});
    }).catch(() => {});

    res.json(successResponse(withdrawal, 'Withdrawal rejected'));
  } catch (error) {
    console.error(`[Withdrawal] Error rejecting withdrawal ${req.params.withdrawalId}:`, error.message);
    next(error);
  }
};

/**
 * Admin manually debits an MT5 account directly.
 * Body: { mt5Login, amount, comment? }
 * Creates a WalletTransaction log so the user can see it in their history.
 */
export const manualWithdrawal = async (req, res, next) => {
  try {
    const { mt5Login, amount, comment } = req.body;

    if (!mt5Login || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'mt5Login and a positive amount are required' });
    }

    const account = await Mt5Account.findOne({ where: { mt5Login: String(mt5Login) } });
    if (!account) {
      return res.status(404).json({ success: false, message: `No MT5 account found with login ${mt5Login}` });
    }

    const bridgeComment = comment || `Manual withdrawal by admin ${req.user.id}`;

    try {
      await mt5Service.withdraw(account.mt5Login, parseFloat(amount), bridgeComment);
    } catch (bridgeErr) {
      console.error(`[ManualWithdrawal] MT5 bridge error for login ${mt5Login}:`, bridgeErr.message);
      return res.status(502).json({ success: false, message: `MT5 debit failed: ${bridgeErr.message}` });
    }

    console.log(`[ManualWithdrawal] Admin ${req.user.id} debited ${amount} from MT5 ${mt5Login}`);

    // User-visible transaction log (non-blocking)
    await logUserTransaction({
      userId: account.userId,
      type: 'withdrawal',
      amount: parseFloat(amount),
      mt5Login: account.mt5Login,
      description: `Manual withdrawal by admin — debited from MT5 account ${account.mt5Login}${comment ? ': ' + comment : ''}`,
      referenceType: 'admin_manual_withdrawal',
    });

    // Admin audit trail (non-blocking)
    try {
      if (AuditLog) {
        await AuditLog.create({
          adminId: req.user.id,
          action: 'MANUAL_WITHDRAWAL',
          entityType: 'Mt5Account',
          entityId: account.id,
          changes: { amount: parseFloat(amount), mt5Login: account.mt5Login, comment: bridgeComment },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      }
    } catch (auditErr) {
      console.warn(`[ManualWithdrawal] Audit log failed (non-critical): ${auditErr.message}`);
    }

    res.json(successResponse(
      { mt5Login: account.mt5Login, amount: parseFloat(amount), comment: bridgeComment },
      'Manual withdrawal debited successfully'
    ));
  } catch (error) {
    console.error(`[ManualWithdrawal] Error:`, error.message);
    next(error);
  }
};

export default { getPendingWithdrawals, getAllWithdrawals, getWithdrawalDetails, approveWithdrawal, rejectWithdrawal, manualWithdrawal };
