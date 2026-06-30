import { PaymentMethod } from '../../models/index.js';
import { successResponse } from '../../utils/response.js';

/**
 * Build the details JSON from flat form fields
 */
function buildDetails(body) {
  const details = {};
  // Bank fields
  if (body.bankName) details.bankName = body.bankName;
  if (body.accountNumber) details.accountNumber = body.accountNumber;
  if (body.accountHolder) details.accountHolder = body.accountHolder;
  if (body.ifsc || body.ifscCode) details.ifscCode = body.ifsc || body.ifscCode;
  if (body.routingNumber) details.routingNumber = body.routingNumber;
  if (body.swiftCode) details.swiftCode = body.swiftCode;
  // USDT/Crypto fields
  if (body.walletAddress) details.walletAddress = body.walletAddress;
  if (body.network) details.network = body.network;
  // UPI fields
  if (body.upiId) details.upiId = body.upiId;
  // Angadiya fields
  if (body.contactNumber) details.contactNumber = body.contactNumber;
  // General
  if (body.instructions) details.instructions = body.instructions;
  return details;
}

/**
 * Flatten details JSON back to top-level fields for frontend
 */
function flattenMethod(method) {
  const plain = method.toJSON ? method.toJSON() : { ...method };
  const d = typeof plain.details === 'string' ? JSON.parse(plain.details) : (plain.details || {});
  return {
    ...plain,
    bankName: d.bankName || '',
    accountNumber: d.accountNumber || '',
    accountHolder: d.accountHolder || '',
    ifsc: d.ifscCode || '',
    routingNumber: d.routingNumber || '',
    swiftCode: d.swiftCode || '',
    walletAddress: d.walletAddress || '',
    network: d.network || '',
    upiId: d.upiId || '',
    contactNumber: d.contactNumber || '',
    instructions: d.instructions || '',
    qrImageUrl: d.qrImageUrl || '',
  };
}

export const getAllPaymentMethods = async (req, res, next) => {
  try {
    const methods = await PaymentMethod.findAll({ order: [['createdAt', 'DESC']] });
    const flattened = methods.map(flattenMethod);
    res.json(successResponse(flattened, 'Payment methods retrieved'));
  } catch (error) {
    next(error);
  }
};

export const createPaymentMethod = async (req, res, next) => {
  try {
    const { name, type, isActive, minAmount, maxAmount } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }

    const details = buildDetails(req.body);

    const method = await PaymentMethod.create({
      name,
      type,
      details,
      isActive: isActive !== false,
      minAmount: parseFloat(minAmount) || 0,
      maxAmount: parseFloat(maxAmount) || null,
      createdBy: req.user?.id || null,
    });

    res.status(201).json(successResponse(flattenMethod(method), 'Payment method created'));
  } catch (error) {
    next(error);
  }
};

export const updatePaymentMethod = async (req, res, next) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    const { name, type, isActive, minAmount, maxAmount } = req.body;

    // Merge new detail fields with existing ones (preserve qrImageUrl if not in body)
    const existingDetails = typeof method.details === 'string'
      ? JSON.parse(method.details)
      : (method.details || {});
    const newDetails = buildDetails(req.body);
    // Preserve QR image URL if it exists and wasn't provided in this update
    if (existingDetails.qrImageUrl && !newDetails.qrImageUrl) {
      newDetails.qrImageUrl = existingDetails.qrImageUrl;
    }

    const updateData = { details: newDetails };
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (minAmount !== undefined) updateData.minAmount = parseFloat(minAmount) || 0;
    if (maxAmount !== undefined) updateData.maxAmount = parseFloat(maxAmount) || null;

    await method.update(updateData);

    res.json(successResponse(flattenMethod(method), 'Payment method updated'));
  } catch (error) {
    next(error);
  }
};

export const deletePaymentMethod = async (req, res, next) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
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
export const uploadQrImage = async (req, res, next) => {
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

    res.json(successResponse(flattenMethod(method), 'QR image uploaded'));
  } catch (error) {
    next(error);
  }
};

export default { getAllPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod, uploadQrImage };
