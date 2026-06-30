import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { AuthError } from '../utils/errors.js';

/**
 * Verify JWT token from Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('No token provided');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, jwtConfig.secret);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN'
      });
    }
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - attach user if token exists, continue if not
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, jwtConfig.secret);
      req.user = decoded;
    }
    next();
  } catch (error) {
    // Token exists but is invalid - continue anyway for optional auth
    next();
  }
};

/**
 * Verify admin JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('No token provided');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, jwtConfig.secret);

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: 'FORBIDDEN'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

/**
 * Check for specific permission
 * @param {string} permission - Permission name to check
 * @returns {Function} Middleware function
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    // Super admin bypasses all permission checks.
    // Also allow 'Admin' (default) and legacy tokens (no roleName) to prevent breaking existing setups.
    if (req.user && (
      req.user.roleName === 'Super Admin' || 
      req.user.roleName === 'Admin' || 
      (req.user.role === 'admin' && !req.user.roleName)
    )) {
      return next();
    }

    if (!req.user || !req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
};

export default {
  verifyToken,
  optionalAuth,
  verifyAdmin,
  requirePermission
};
