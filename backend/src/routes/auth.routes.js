import express from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as authController from '../controllers/auth.controller.js';
import * as twoFactorController from '../controllers/twoFactor.controller.js';

const router = express.Router();

/**
 * Auth routes
 */

router.post('/register', authLimiter, validate(schemas.register), authController.register);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/admin/login', authLimiter, validate(schemas.login), authController.adminLogin);
router.post('/refresh-token', validate(schemas.refreshToken), authController.refreshToken);
router.post('/logout', verifyToken, authController.logout);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);
router.get('/me', verifyToken, authController.getCurrentUser);

// ── 2FA login verification (no auth required — uses pre2faToken) ──
router.post('/2fa/verify', authLimiter, twoFactorController.verify2FA);
router.post('/2fa/resend-otp', authLimiter, twoFactorController.resendOtp);

// ── 2FA setup/management (requires full auth) ──
router.post('/2fa/setup/email', verifyToken, twoFactorController.enableEmail2FA);
router.post('/2fa/setup/totp', verifyToken, twoFactorController.setupTotp);
router.post('/2fa/setup/totp/confirm', verifyToken, twoFactorController.confirmTotpSetup);
router.delete('/2fa', verifyToken, twoFactorController.disable2FA);

export default router;
