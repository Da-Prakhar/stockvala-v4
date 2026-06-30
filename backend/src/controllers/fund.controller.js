import { Deposit, Withdrawal, PaymentMethod, Mt5Account, BrokerSetting } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';

/**
 * Create deposit
 */
export const createDeposit = async (req, res, next) => {
  try {
    const { amount, paymentMethodId, mt5AccountId, transactionRef } = req.validated.body;

    const deposit = await Deposit.create({
      userId: req.user.id,
      mt5AccountId: mt5AccountId || null,
      paymentMethodId,
      amount,
      transactionRef: transactionRef || null,
      status: 'pending'
    });

    res.status(201).json(successResponse(deposit, 'Deposit created'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user deposits
 */
export const getUserDeposits = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Deposit.findAndCountAll({
      where: { userId: req.user.id },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: PaymentMethod, as: 'paymentMethod', attributes: ['id', 'name', 'type'] }
      ]
    });

    res.json(successResponse({ deposits: rows, total: count, page: parseInt(page), limit: parseInt(limit) }, 'Deposits retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload deposit proof
 */
export const uploadDepositProof = async (req, res, next) => {
  try {
    const deposit = await Deposit.findByPk(req.params.id);
    if (!deposit || deposit.userId !== req.user.id) {
      throw new NotFoundError('Deposit not found');
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    await deposit.update({ proofImageUrl: req.file.path });
    res.json(successResponse(deposit, 'Proof uploaded'));
  } catch (error) {
    next(error);
  }
};

/**
 * Create withdrawal
 */
export const createWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethodId, mt5AccountId, withdrawalDetails } = req.validated.body;

    // Dynamic minimum withdrawal check
    const minSetting = await BrokerSetting.findOne({ where: { key: 'minWithdrawal' } });
    const minAmount = parseFloat(minSetting?.value || '1');
    if (parseFloat(amount) < minAmount) {
      throw new BusinessError(`Minimum withdrawal amount is $${minAmount}`);
    }

    const withdrawal = await Withdrawal.create({
      userId: req.user.id,
      mt5AccountId: mt5AccountId || null,
      paymentMethodId,
      amount,
      withdrawalDetails: withdrawalDetails || null,
      status: 'pending'
    });

    res.status(201).json(successResponse(withdrawal, 'Withdrawal created'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user withdrawals
 */
export const getUserWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Withdrawal.findAndCountAll({
      where: { userId: req.user.id },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: PaymentMethod, as: 'paymentMethod', attributes: ['id', 'name', 'type'] }
      ]
    });

    res.json(successResponse({ withdrawals: rows, total: count, page: parseInt(page), limit: parseInt(limit) }, 'Withdrawals retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment methods (admin-configured, available to all users)
 */
export const getPaymentMethods = async (req, res, next) => {
  try {
    let methods = await PaymentMethod.findAll({
      where: { isActive: true }
    });

    // Auto-seed defaults if table is empty (first-time setup)
    if (methods.length === 0) {
      console.log('[Fund] No payment methods found, seeding defaults...');
      const defaults = [
        {
          name: 'Bank Transfer (NEFT/IMPS)',
          type: 'bank',
          details: { bankName: 'Your Company Trading Ltd', accountNumber: '1234567890', ifscCode: 'SBIN0001234', accountHolder: 'Your Company Trading', instructions: 'Transfer to the above account and upload receipt' },
          isActive: true,
          minAmount: 100,
          maxAmount: 500000
        },
        {
          name: 'USDT (TRC20)',
          type: 'usdt',
          details: { walletAddress: 'TXyz...abc123', network: 'TRC20', instructions: 'Send USDT to the above TRC20 address' },
          isActive: true,
          minAmount: 10,
          maxAmount: 100000
        },
        {
          name: 'UPI',
          type: 'upi',
          details: { upiId: 'pay@stockvala', instructions: 'Pay via UPI and share transaction reference' },
          isActive: true,
          minAmount: 100,
          maxAmount: 100000
        },
        {
          name: 'Angadiya',
          type: 'angadiya',
          details: { instructions: 'Contact support for Angadiya deposit instructions', contactNumber: '+91-XXXXXXXXXX' },
          isActive: true,
          minAmount: 500,
          maxAmount: 1000000
        }
      ];
      await PaymentMethod.bulkCreate(defaults);
      methods = await PaymentMethod.findAll({ where: { isActive: true } });
      console.log(`[Fund] Seeded ${methods.length} default payment methods.`);
    }

    res.json(successResponse(methods, 'Payment methods retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Add payment method (placeholder — typically admin-only)
 */
export const addPaymentMethod = async (req, res, next) => {
  try {
    const { name, type, isActive = true, minAmount, maxAmount, bankName, accountNumber, accountHolder, ifsc, ifscCode, walletAddress, network, upiId, contactNumber, instructions } = req.body;

    const details = {};
    if (bankName) details.bankName = bankName;
    if (accountNumber) details.accountNumber = accountNumber;
    if (accountHolder) details.accountHolder = accountHolder;
    if (ifsc || ifscCode) details.ifscCode = ifsc || ifscCode;
    if (walletAddress) details.walletAddress = walletAddress;
    if (network) details.network = network;
    if (upiId) details.upiId = upiId;
    if (contactNumber) details.contactNumber = contactNumber;
    if (instructions) details.instructions = instructions;

    const method = await PaymentMethod.create({
      name,
      type,
      details,
      isActive,
      minAmount: parseFloat(minAmount) || 0,
      maxAmount: parseFloat(maxAmount) || null,
    });

    res.status(201).json(successResponse(method, 'Payment method added'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update payment method
 */
export const updatePaymentMethod = async (req, res, next) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) {
      throw new NotFoundError('Payment method not found');
    }

    await method.update(req.body);
    res.json(successResponse(method, 'Payment method updated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete payment method
 */
export const deletePaymentMethod = async (req, res, next) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) {
      throw new NotFoundError('Payment method not found');
    }

    await method.destroy();
    res.json(successResponse(null, 'Payment method deleted'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload QR code image for a payment method
 */
export const uploadPaymentMethodQr = async (req, res, next) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Store QR image path in the details JSON
    const details = typeof method.details === 'string'
      ? JSON.parse(method.details)
      : (method.details || {});
    details.qrImageUrl = req.file.path;

    await method.update({ details });
    res.json(successResponse(method, 'QR image uploaded'));
  } catch (error) {
    next(error);
  }
};

export default {
  createDeposit,
  getUserDeposits,
  uploadDepositProof,
  createWithdrawal,
  getUserWithdrawals,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  uploadPaymentMethodQr
};
