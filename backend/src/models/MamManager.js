import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * MamManager model - Multi-Account Manager
 */
const MamManager = db.define('MamManager', {
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
  mt5AccountId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'mt5_account_id',
    references: {
      model: 'mt5_accounts',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  allocationMethod: {
    type: DataTypes.ENUM('lot', 'percent', 'equity'),
    allowNull: false,
    defaultValue: 'percent',
    field: 'allocation_method'
  },
  managementFeePct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'management_fee_pct'
  },
  performanceFeePct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'performance_fee_pct'
  },
  minInvestment: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 1000,
    field: 'min_investment'
  },
  /** % of performance/management fee the broker retains */
  platformFeeSplitPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 30,
    field: 'platform_fee_split_pct'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'mam_managers',
  timestamps: true,
  underscored: true
});

export default MamManager;
