import { User, UserProfile, Mt5Account, Deposit, Withdrawal, Trade } from '../../models/index.js';
import { NotFoundError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { Sequelize } from 'sequelize';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import emailService from '../../services/email.service.js';
import * as mt5Service from '../../services/mt5.service.js';

export const getClients = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, kycStatus } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (kycStatus) where.kycStatus = kycStatus;
    if (search) {
      where[Sequelize.Op.or] = [
        { firstName: { [Sequelize.Op.like]: `%${search}%` } },
        { lastName: { [Sequelize.Op.like]: `%${search}%` } },
        { email: { [Sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires', 'emailVerificationToken', 'emailVerificationExpires', 'twoFactorSecret'] },
      include: [
        { model: UserProfile, as: 'profile' },
        { model: Mt5Account, as: 'accounts', attributes: ['id', 'mt5Login', 'accountType', 'balance', 'equity', 'status', 'leverage'] },
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true, // Prevent inflated count from hasMany joins
    });

    // Map rows to include summary fields for the table
    const clients = rows.map(u => {
      const json = u.toJSON();
      const accs = json.accounts || [];
      return {
        ...json,
        mt5Accounts: accs.length,
        mt5Logins: accs.map(a => a.mt5Login),
        totalBalance: accs.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0),
        totalEquity: accs.reduce((sum, a) => sum + (parseFloat(a.equity) || 0), 0),
      };
    });

    res.json(paginatedResponse(clients, count, parseInt(page), parseInt(limit), 'Clients retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getClientDetails = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const client = await User.findByPk(clientId, {
      include: [
        { model: UserProfile, as: 'profile' },
        {
          model: Mt5Account,
          as: 'accounts',
          include: [
            { model: Trade, as: 'trades', limit: 100, order: [['createdAt', 'DESC']] },
          ],
        },
        { model: Deposit, as: 'deposits', limit: 50, order: [['createdAt', 'DESC']] },
        { model: Withdrawal, as: 'withdrawals', limit: 50, order: [['createdAt', 'DESC']] },
      ],
      attributes: { exclude: ['password', 'passwordResetToken'] }
    });

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const json = client.toJSON();
    // Collect all trades from all MT5 accounts
    const allTrades = [];
    (json.accounts || []).forEach(a => {
      if (a.trades?.length) a.trades.forEach(t => allTrades.push({ ...t, mt5Login: a.mt5Login }));
    });

    // Enrich each account with live MT5 data — parallel with 5s hard cap per account
    const _timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
    const enrichedAccounts = await Promise.all((json.accounts || []).map(async (a) => {
      let balance = a.balance, equity = a.equity, margin = a.margin,
          freeMargin = a.freeMargin, leverage = a.leverage;
      try {
        const live = await Promise.race([mt5Service.getAccountInfo(a.mt5Login), _timeout(5000)]);
        if (live) {
          const d = live.data || live;
          balance    = d.balance      ?? d.Balance      ?? balance;
          equity     = d.equity       ?? d.Equity       ?? equity;
          margin     = d.margin       ?? d.Margin       ?? margin ?? 0;
          freeMargin = d.margin_free  ?? d.FreeMargin   ?? freeMargin ?? 0;
          leverage   = d.leverage     ?? d.Leverage     ?? leverage;
        }
      } catch (_) { /* Gateway unreachable — fall back to DB values */ }
      return { login: a.mt5Login, id: a.id, accountType: a.accountType,
               balance, equity, margin, freeMargin, leverage, status: a.status, mt5Group: a.mt5Group };
    }));
    json.mt5Accounts = enrichedAccounts;
    delete json.accounts;
    json.trades = allTrades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(successResponse(json, 'Client details retrieved'));
  } catch (error) {
    next(error);
  }
};

export const updateClientStatus = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { status } = req.body;

    const client = await User.findByPk(clientId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    await client.update({ status });

    res.json(successResponse(client, 'Client status updated'));
  } catch (error) {
    next(error);
  }
};

export const updateClientKycStatus = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { kycStatus } = req.body;

    const client = await User.findByPk(clientId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    await client.update({ kycStatus });

    res.json(successResponse(client, 'Client KYC status updated'));
  } catch (error) {
    next(error);
  }
};

export const resetClientPassword = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { newPassword } = req.body; // optional — if not provided, generate random

    const client = await User.findByPk(clientId);
    if (!client) throw new NotFoundError('Client not found');

    // Generate or use provided password
    const plainPassword = newPassword || crypto.randomBytes(5).toString('hex') + 'A1!';

    // Pass plain password — the User model's beforeUpdate hook will hash it.
    // Do NOT pre-hash here or it will be double-hashed and logins will fail.
    await client.update({ password: plainPassword });

    // Try to email the client their new password (non-blocking)
    try {
      await emailService.sendGenericEmail(
        client.email,
        'Your password has been reset',
        `<p>Hello ${client.firstName},</p>
         <p>An administrator has reset your account password.</p>
         <p>Your new temporary password is: <strong>${plainPassword}</strong></p>
         <p>Please log in and change your password immediately.</p>`
      );
    } catch (e) {
      console.warn(`[Admin] Password reset email failed for ${client.email}:`, e.message);
    }

    res.json(successResponse(
      { email: client.email, temporaryPassword: plainPassword },
      'Password reset successfully. New credentials sent to client email.'
    ));
  } catch (error) {
    next(error);
  }
};

export default { getClients, getClientDetails, updateClientStatus, updateClientKycStatus, resetClientPassword };
