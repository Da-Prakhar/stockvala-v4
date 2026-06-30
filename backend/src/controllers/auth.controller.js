import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { jwtConfig } from '../config/jwt.js';
import { User, UserSession, AdminUser, Role, IbTree, BrokerSetting } from '../models/index.js';
import { AuthError, ConflictError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';
import emailService from '../services/email.service.js';
import { awardReferralBonus } from '../services/ibCommission.service.js';

/**
 * Resolve the landing page base URL.
 * Priority: broker_settings.LANDING_URL → env LANDING_URL → fallback
 */
async function getLandingUrl() {
  try {
    const { default: BrokerSetting } = await import('../models/BrokerSetting.js');
    const s = await BrokerSetting.findOne({ where: { key: 'LANDING_URL' } });
    if (s?.value) return s.value.replace(/\/$/, '');
  } catch (_) {}
  if (process.env.LANDING_URL) return process.env.LANDING_URL.replace(/\/$/, '');
  return 'https://starwavemarket.com';
}

/**
 * Register new user
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, referralCode } = req.validated.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new ConflictError('User already exists with this email');
    }

    // Resolve referral code → referredBy userId
    let referredBy = null;
    if (referralCode) {
      try {
        const ibTree = await IbTree.findOne({ where: { ibCode: referralCode.trim().toUpperCase() } });
        if (ibTree) {
          referredBy = ibTree.userId;
          console.log(`[Auth] Referral code ${referralCode} resolved to userId ${referredBy}`);
        } else {
          console.warn(`[Auth] Referral code ${referralCode} not found — ignoring`);
        }
      } catch (e) {
        console.warn(`[Auth] Referral lookup failed: ${e.message}`);
      }
    }

    // Create user (status defaults to 'pending', role defaults to 'client')
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      ...(referredBy ? { referredBy } : {})
    });

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    // Store session
    await UserSession.create({
      userId: user.id,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      deviceType: 'web',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Award IB referral bonus to the referrer (non-blocking)
    if (referredBy) {
      awardReferralBonus(referredBy, user.id).catch(e =>
        console.error('[IB] Referral bonus error:', e.message)
      );
    }

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(user.email, firstName).catch(e =>
      console.error('[Auth] Welcome email failed:', e.message)
    );

    res.status(201).json(successResponse(
      { user: { id: user.id, email: user.email, firstName, lastName }, accessToken, refreshToken },
      'User registered successfully'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * Login user — handles 2FA challenge when enabled
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) throw new AuthError('Invalid credentials');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new AuthError('Invalid credentials');

    // Check if 2FA is required (user setting OR global broker policy)
    const globalSetting = await BrokerSetting.findOne({ where: { key: 'two_factor_required' } });
    const global2FA = globalSetting?.value === 'true';

    if (user.twoFactorEnabled || global2FA) {
      const method = user.twoFactorMethod || 'email';

      // Issue a short-lived pre-2FA token — only usable at /auth/2fa/verify
      const pre2faToken = jwt.sign(
        { id: user.id, type: 'pre2fa' },
        jwtConfig.secret,
        { expiresIn: '10m' }
      );

      if (method === 'email') {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        await user.update({ emailOtpCode: otp, emailOtpExpires: expires });
        emailService.sendTwoFactorOtpEmail(user.email, otp, user.firstName).catch(e =>
          console.error('[2FA] OTP email failed:', e.message)
        );
        const maskedEmail = user.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3');
        return res.json(successResponse(
          { requires2FA: true, method: 'email', pre2faToken, maskedEmail },
          'Verification code sent to your email'
        ));
      }

      // TOTP — no email needed, user opens authenticator app
      return res.json(successResponse(
        { requires2FA: true, method: 'totp', pre2faToken },
        'Enter the code from your authenticator app'
      ));
    }

    // No 2FA — issue full tokens immediately
    const { accessToken, refreshToken } = await issueFullTokens(user, req);
    res.json(successResponse(
      { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }, accessToken, refreshToken },
      'Login successful'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * Shared helper — create full JWT pair + session record
 */
async function issueFullTokens(user, req) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: 'user' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshExpiresIn }
  );
  await user.update({ lastLogin: new Date(), lastLoginIp: req.ip });
  await UserSession.create({
    userId: user.id,
    refreshToken,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    deviceType: 'web',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  return { accessToken, refreshToken };
}

/**
 * Refresh access token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.validated.body;

    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      throw new AuthError('User not found');
    }

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    res.json(successResponse({ accessToken: newAccessToken }, 'Token refreshed'));
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
export const logout = async (req, res, next) => {
  try {
    // Mark sessions as revoked
    await UserSession.update(
      { revokedAt: new Date() },
      { where: { userId: req.user.id, revokedAt: null } }
    );

    res.json(successResponse(null, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password — generates reset token and sends email
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.validated.body;

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (user) {
      // Generate a random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      // Build reset URL — uses landing page which has a ResetPasswordPage
      const landingUrl = await getLandingUrl();
      const resetUrl = `${landingUrl}/reset-password?token=${resetToken}`;

      try {
        await emailService.sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailErr) {
        console.error('[Auth] Failed to send reset email:', emailErr.message);
        // Don't fail the request — still return success to prevent enumeration
      }
    }

    // Always return success to prevent email enumeration
    res.json(successResponse(null, 'If the email exists, a password reset link has been sent'));
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password — validates token and updates password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.validated.body;

    const user = await User.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      throw new AuthError('Invalid or expired reset token');
    }

    // Update password and clear token
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save(); // triggers beforeUpdate hook to hash password

    // Revoke all sessions for security
    await UserSession.update(
      { revokedAt: new Date() },
      { where: { userId: user.id, revokedAt: null } }
    );

    res.json(successResponse(null, 'Password has been reset successfully. Please log in with your new password.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(successResponse(user, 'User retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Admin login
 */
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;

    const admin = await AdminUser.findOne({
      where: { email: email.toLowerCase() },
      include: [{ model: Role }]
    });

    if (!admin) {
      throw new AuthError('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new AuthError('Account is inactive or suspended');
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthError('Invalid credentials');
    }

    // Update last login
    await admin.update({
      lastLogin: new Date()
    });

    // Generate tokens with admin role
    const accessToken = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: 'admin', 
        roleName: admin.Role?.name || 'Admin',
        permissions: admin.Role?.permissionIds || [] 
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    const refreshToken = jwt.sign(
      { id: admin.id, role: 'admin' },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    res.json(successResponse(
      {
        user: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: 'admin',
          roleName: admin.Role?.name || 'Admin'
        },
        accessToken,
        refreshToken
      },
      'Admin login successful'
    ));
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  adminLogin,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser
};
