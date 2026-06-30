import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * UserSession model
 * Actual DB columns: id, user_id, refresh_token (NOT NULL), ip_address,
 *   user_agent, expires_at, created_at, device_type, revoked_at, updated_at
 * NOTE: No 'token' column in actual DB!
 */
const UserSession = db.define('UserSession', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  refreshToken: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true,
    field: 'refresh_token'
  },
  ipAddress: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  deviceType: {
    type: DataTypes.ENUM('web', 'mobile', 'desktop'),
    allowNull: true,
    field: 'device_type'
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'revoked_at'
  }
}, {
  tableName: 'user_sessions',
  timestamps: true,
  underscored: true
});

export default UserSession;
