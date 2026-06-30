import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * PammInvestor model
 */
const PammInvestor = db.define('PammInvestor', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  pammManagerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'pamm_manager_id',
    references: {
      model: 'pamm_managers',
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
  investedAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'invested_amount'
  },
  currentSharePct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'current_share_pct'
  },
  profitLoss: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'profit_loss'
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
  tableName: 'pamm_investors',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['pamm_manager_id', 'investor_user_id'],
      unique: true
    }
  ]
});

export default PammInvestor;
