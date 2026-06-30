import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * IbCommission model
 */
const IbCommission = db.define('IbCommission', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  ibTreeId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'ib_trees',
      key: 'id'
    }
  },
  referredUserId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  relatedId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID of related transaction (deposit, trade, mt5_XXXX, etc)'
  },
  relatedType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Type of related transaction'
  },
  commissionType: {
    type: DataTypes.ENUM('deposit', 'trading', 'referral'),
    allowNull: false
  },
  baseAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  commissionPercent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'paid', 'forfeited'),
    defaultValue: 'pending'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ib_commissions',
  timestamps: true,
  underscored: true
});

export default IbCommission;
