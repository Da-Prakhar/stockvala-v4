import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * IbLevel model - Commission levels for IB program
 */
const IbLevel = db.define('IbLevel', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: '1=direct, 2=level 2, etc'
  },
  depositCommissionPercent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  tradingCommissionPercent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  referralBonusPercent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  minReferralsRequired: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  minMonthlyDeposits: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  bonusAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  commissionMode: {
    type: DataTypes.ENUM('percentage', 'per_lot'),
    defaultValue: 'percentage',
    field: 'commission_mode',
    comment: 'How trading commission is calculated'
  },
  perLotCommission: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    field: 'per_lot_commission',
    comment: 'Fixed $ per lot when commissionMode = per_lot'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  tableName: 'ib_levels',
  timestamps: true,
  underscored: true
});

export default IbLevel;
