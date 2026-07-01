/**
 * 2FA Controller
 *
 * Handles:
 *   POST /auth/2fa/verify        — complete login after password check (email OTP or TOTP)
 *   POST /auth/2fa/resend-otp    — resend email OTP during login challenge
 *   POST /auth/2fa/setup/email   — enable email OTP 2FA (authenticated user)
 *   POST /auth/2fa/setup/totp    — generate TOTP secret + QR URI (authenticated user)
 *   POST /auth/2fa/setup/totp/confirm — verify TOTP code and activate TOTP 2FA
 *   DELETE /auth/2fa             — disable 2FA entirely
 */

import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { User, UserSession, BrokerSetting } from '../models/index.js';
import { AuthError, ValidationError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';
import { generateTotpSecret, buildTotpUri, verifyTotp } from '../services/totp.service.js';
import emailService from '../services/email.service.js';

// ─── Verify 2FA during login ──────────────────────────────────────────────────

export const verify2FA = async (req, res, next) => {
  try {
    const { pre2faToken, code } = req.body;
    if (!pre2faToken || !code) throw new ValidationError('pre2faToken and code are required');

    // Decode the short-lived token
    let decoded;
    try {
      decoded = jwt.verify(pre2faToken, jwtConfig.secret);
    } catch {
      throw new AuthError('Verification session expired. Please log in again.');
    }
    if (decoded.type !== 'pre2fa') throw new AuthError('Invalid verification token');

    const user = await User.findByPk(decoded.id);
    if (!user) throw new AuthError('User not found');

    const method = user.twoFactorMethod || 'email';

    if (method === 'email') {
      if (!user.emailOtpCode || !user.emailOtpExpires) throw new AuthError('No active verification code. Please log in again.');
      if (new Date() > new Date(user.emailOtpExpires)) throw new AuthError('Verification code has expired. Please log in again.');
      if (user.emailOtpCode !== code.trim()) throw new AuthError('Invalid verification code.');
      // Clear OTP
      await user.update({ emailOtpCode: null, emailOtpExpires: null });

    } else if (method === 'totp') {
      if (!user.twoFactorSecret) throw new AuthError('Authenticator app not configured. Please contact support.');
      if (!verifyTotp(user.twoFactorSecret, code.trim())) throw new AuthError('Invalid authenticator code.');

    } else {
      throw new AuthError('Unknown 2FA method');
    }

    // Issue full tokens
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
    await user.update({ lastLogin: new Date() });
    await UserSession.create({
      userId: user.id,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      deviceType: 'web',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Email: login alert after 2FA success
    emailService.sendLoginAlertEmail(user.email, {
      firstName: user.firstName,
      ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
      userAgent: req.get('user-agent') || 'Unknown',
      time: new Date().toISOString()
    }).catch(() => {});

    res.json(successResponse(
      { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }, accessToken, refreshToken },
      'Login successful'
    ));
  } catch (error) {
    next(error);
  }
};

// ─── Resend email OTP (during active login challenge) ────────────────────────

export const resendOtp = async (req, res, next) => {
  try {
    const { pre2faToken } = req.body;
    if (!pre2faToken) throw new ValidationError('pre2faToken is required');

    let decoded;
    try {
      decoded = jwt.verify(pre2faToken, jwtConfig.secret);
    } catch {
      throw new AuthError('Verification session expired. Please log in again.');
    }
    if (decoded.type !== 'pre2fa') throw new AuthError('Invalid token');

    const user = await User.findByPk(decoded.id);
    if (!user) throw new AuthError('User not found');

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.update({ emailOtpCode: otp, emailOtpExpires: expires });
    await emailService.sendTwoFactorOtpEmail(user.email, otp, user.firstName);

    res.json(successResponse(null, 'Verification code resent'));
  } catch (error) {
    next(error);
  }
};

// ─── Enable email OTP 2FA ─────────────────────────────────────────────────────

export const enableEmail2FA = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    await user.update({
      twoFactorEnabled: true,
      twoFactorMethod: 'email',
      twoFactorSecret: null
    });
    res.json(successResponse(null, 'Email 2FA enabled'));
  } catch (error) {
    next(error);
  }
};

// ─── Begin TOTP setup — returns secret + QR URI ───────────────────────────────

export const setupTotp = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    const secret = generateTotpSecret();

    // Temporarily store secret; confirmed only after user verifies a code
    await user.update({ twoFactorSecret: secret });

    const companySetting = await BrokerSetting.findOne({ where: { key: 'companyName' } });
    const issuer = companySetting?.value || 'TradingPlatform';

    const otpUri = buildTotpUri(secret, user.email, issuer);

    res.json(successResponse({ secret, otpUri }, 'Scan the QR code with your authenticator app then confirm with a code'));
  } catch (error) {
    next(error);
  }
};

// ─── Confirm TOTP setup ───────────────────────────────────────────────────────

export const confirmTotpSetup = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) throw new ValidationError('code is required');

    const user = await User.findByPk(req.user.id);
    if (!user.twoFactorSecret) throw new ValidationError('No TOTP setup in progress. Call /auth/2fa/setup/totp first.');

    if (!verifyTotp(user.twoFactorSecret, code.trim())) {
      throw new AuthError('Invalid code. Make sure your device clock is accurate and try again.');
    }

    await user.update({ twoFactorEnabled: true, twoFactorMethod: 'totp' });
    res.json(successResponse(null, 'Authenticator app 2FA enabled'));
  } catch (error) {
    next(error);
  }
};

// ─── Disable 2FA ─────────────────────────────────────────────────────────────

export const disable2FA = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    await user.update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorMethod: 'email',
      emailOtpCode: null,
      emailOtpExpires: null
    });
    res.json(successResponse(null, '2FA disabled'));
  } catch (error) {
    next(error);
  }
};

export default { verify2FA, resendOtp, enableEmail2FA, setupTotp, confirmTotpSetup, disable2FA };
