import rateLimit from 'express-rate-limit';

/**
 * Rate limiters for different API endpoints
 */

/**
 * Auth endpoints rate limiter (stricter)
 */
const isDev = process.env.NODE_ENV !== 'production';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10, // relaxed in dev, strict in production
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * File upload rate limiter (moderate)
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Trade operations rate limiter
 */
export const tradeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 trade operations per minute
  message: 'Too many trade operations, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Withdrawal rate limiter (very strict)
 */
export const withdrawalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 withdrawals per 24 hours
  message: 'Withdrawal limit exceeded. Maximum 5 withdrawals per day.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

export default {
  authLimiter,
  apiLimiter,
  uploadLimiter,
  tradeLimiter,
  withdrawalLimiter
};
