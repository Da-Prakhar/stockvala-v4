import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a unique ID
 * @returns {string} UUID
 */
export const generateId = () => uuidv4();

/**
 * Generate a random referral code
 * @returns {string} Referral code
 */
export const generateReferralCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  });
  return formatter.format(amount);
};

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {number} Percentage
 */
export const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return ((value / total) * 100).toFixed(2);
};

/**
 * Calculate profit/loss
 * @param {number} entryPrice - Entry price
 * @param {number} exitPrice - Exit price
 * @param {number} quantity - Quantity
 * @returns {Object} Profit/loss details
 */
export const calculatePnL = (entryPrice, exitPrice, quantity) => {
  const pnl = (exitPrice - entryPrice) * quantity;
  const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  return {
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
    direction: pnl >= 0 ? 'profit' : 'loss'
  };
};

/**
 * Generate password reset token
 * @returns {Object} Token and hash
 */
export const generatePasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Paginate array
 * @param {Array} array - Array to paginate
 * @param {number} page - Current page (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} Paginated data
 */
export const paginate = (array, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const total = array.length;
  const data = array.slice(startIndex, endIndex);
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get time difference in human-readable format
 * @param {Date} date - Date to compare
 * @returns {string} Time difference
 */
export const getTimeDifference = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

/**
 * Mask sensitive data
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters from the end
 * @returns {string} Masked data
 */
export const maskData = (data, visibleChars = 4) => {
  if (!data) return '';
  const length = data.length;
  const maskChars = Math.max(0, length - visibleChars);
  return '*'.repeat(maskChars) + data.slice(-visibleChars);
};

export default {
  generateId,
  generateReferralCode,
  formatCurrency,
  calculatePercentage,
  calculatePnL,
  generatePasswordResetToken,
  isValidEmail,
  paginate,
  getTimeDifference,
  maskData
};
