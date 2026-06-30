import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * MamAccount model - Investor account in MAM
 */
const MamAccount = db.define('MamAccount', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  managerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'manager_id',
    references: {
      model: 'mam_managers',
      key: 'id'
    }
  },
  investorUserId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'investor_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  investorMt5AccountId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'investor_mt5_account_id',
    references: {
      model: 'mt5_accounts',
      key: 'id'
    }
  },
  allocationPct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'allocation_pct'
  },
  investedAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'invested_amount'
  },
  currentValue: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'current_value'
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'withdrawn'),
    allowNull: false,
    defaultValue: 'active'
  },
  joinedAt: {
    type: DataTypes.DATE,
    field: 'joined_at'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'mam_accounts',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['manager_id', 'investor_user_id', 'investor_mt5_account_id'],
      unique: true
    }
  ]
});

export default MamAccount;
