import bcryptjs from 'bcryptjs';
import { User, UserProfile } from '../models/index.js';
import { AuthError, NotFoundError, ValidationError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';

/**
 * Normalise a User row into a flat object the frontend expects.
 * Frontend uses `phone` not `phoneNumber`, and expects country/city.
 */
const toUserJson = (user, profile = null) => {
  const u = user.toJSON ? user.toJSON() : { ...user };
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phoneNumber || null,        // map phoneNumber → phone
    phoneNumber: u.phoneNumber || null,
    status: u.status,
    kycStatus: u.kycStatus,
    emailVerified: u.emailVerified,
    twoFactorEnabled: u.twoFactorEnabled,
    referralCode: u.referralCode,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    // profile fields (may come from UserProfile row)
    country: profile?.country ?? u.country ?? null,
    city: profile?.city ?? u.city ?? null,
    bankName: profile?.bankName ?? null,
    accountNumber: profile?.accountNumber ?? null,
    ifscCode: profile?.ifscCode ?? null,
    accountHolderName: profile?.accountHolderName ?? null,
  };
};

/**
 * GET /users/me — full user object (alias for /auth/me, also returns profile fields)
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'emailVerificationToken', 'twoFactorSecret'] }
    });
    if (!user) throw new NotFoundError('User not found');

    const profile = await UserProfile.findOne({ where: { userId: user.id } });
    res.json(successResponse(toUserJson(user, profile), 'Profile retrieved'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /users/profile
 * Accepts any combination of: firstName, lastName, phone, country, city, twoFactorEnabled,
 * bankName, accountNumber, ifscCode, accountHolderName
 */
export const updateProfile = async (req, res, next) => {
  try {
    const {
      firstName, lastName, phone, country, city, twoFactorEnabled,
      bankName, accountNumber, ifscCode, accountHolderName,
    } = req.validated.body;

    const user = await User.findByPk(req.user.id);
    if (!user) throw new NotFoundError('User not found');

    // Build updates object (only set fields that were sent)
    const userUpdates = {};
    if (firstName !== undefined) userUpdates.firstName = firstName.trim();
    if (lastName  !== undefined) userUpdates.lastName  = lastName.trim();
    if (phone     !== undefined) userUpdates.phoneNumber = phone ? phone.trim() : null;
    if (twoFactorEnabled !== undefined) userUpdates.twoFactorEnabled = !!twoFactorEnabled;

    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }

    // Update UserProfile for country / city / bank details
    if (country !== undefined || city !== undefined
      || bankName !== undefined || accountNumber !== undefined
      || ifscCode !== undefined || accountHolderName !== undefined) {
      const profileUpdates = {};
      if (country !== undefined) profileUpdates.country = country ? country.trim() : null;
      if (city    !== undefined) profileUpdates.city    = city    ? city.trim()    : null;
      if (bankName          !== undefined) profileUpdates.bankName          = bankName          ? bankName.trim()          : null;
      if (accountNumber     !== undefined) profileUpdates.accountNumber     = accountNumber     ? accountNumber.trim()     : null;
      if (ifscCode          !== undefined) profileUpdates.ifscCode          = ifscCode          ? ifscCode.trim()          : null;
      if (accountHolderName !== undefined) profileUpdates.accountHolderName = accountHolderName ? accountHolderName.trim() : null;

      await UserProfile.upsert({
        userId: user.id,
        ...profileUpdates,
      });
    }

    // Reload user and profile
    await user.reload();
    const profile = await UserProfile.findOne({ where: { userId: user.id } });

    res.json(successResponse(toUserJson(user, profile), 'Profile updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /users/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validated.body;

    const user = await User.findByPk(req.user.id);
    if (!user) throw new NotFoundError('User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new AuthError('Current password is incorrect');

    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters');
    }

    // Assign plain text — beforeUpdate hook hashes it
    user.password = newPassword;
    await user.save();

    res.json(successResponse(null, 'Password changed successfully'));
  } catch (err) {
    next(err);
  }
};

export default { getProfile, updateProfile, changePassword };
