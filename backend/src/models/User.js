import { DataTypes } from 'sequelize';
import bcryptjs from 'bcryptjs';
import db from '../config/database.js';

/**
 * User model
 * Actual DB columns: id, email, password, first_name, last_name, phone_number,
 *   referral_code, referred_by, status, kyc_status, email_verified,
 *   two_factor_enabled, last_login, last_login_ip, password_reset_token,
 *   password_reset_expires, email_verification_token, email_verification_expires,
 *   two_factor_secret, created_at, updated_at
 */
const User = db.define('User', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'last_name'
  },
  phoneNumber: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'phone_number'
  },
  referralCode: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    field: 'referral_code'
  },
  referredBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'referred_by'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'banned'),
    defaultValue: 'active'
  },
  kycStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
    defaultValue: 'pending',
    field: 'kyc_status'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'two_factor_enabled'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  lastLoginIp: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'last_login_ip'
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'password_reset_token'
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'password_reset_expires'
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'email_verification_token'
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verification_expires'
  },
  twoFactorSecret: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'two_factor_secret'
  },
  twoFactorMethod: {
    type: DataTypes.ENUM('email', 'totp'),
    defaultValue: 'email',
    field: 'two_factor_method'
  },
  emailOtpCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'email_otp_code'
  },
  emailOtpExpires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_otp_expires'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcryptjs.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcryptjs.hash(user.password, 10);
      }
    }
  }
});

/**
 * Compare password method
 */
User.prototype.comparePassword = async function(candidatePassword) {
  return bcryptjs.compare(candidatePassword, this.password);
};

export default User;
