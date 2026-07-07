import { DataTypes } from 'sequelize';
import db from '../config/database.js';

const UserBonus = db.define('UserBonus', {
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
  bonusId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'bonus_id',
    references: {
      model: 'bonuses',
      key: 'id'
    }
  },
  mt5Account: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'mt5_account'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  requiredLots: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'required_lots'
  },
  completedLots: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'completed_lots'
  },
  status: {
    type: DataTypes.ENUM('available', 'claimed', 'credited', 'expired', 'cancelled'),
    defaultValue: 'available'
  },
  claimedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'claimed_at'
  },
  creditedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'credited_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  adminNote: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_note'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'user_bonuses',
  timestamps: true,
  underscored: true
});

export default UserBonus;
