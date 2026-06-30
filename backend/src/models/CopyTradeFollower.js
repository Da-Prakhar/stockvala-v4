import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * CopyTradeFollower model
 */
const CopyTradeFollower = db.define('CopyTradeFollower', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  followerUserId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'follower_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  masterId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'master_id',
    references: {
      model: 'copy_trade_masters',
      key: 'id'
    }
  },
  followerMt5AccountId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'follower_mt5_account_id',
    references: {
      model: 'mt5_accounts',
      key: 'id'
    }
  },
  allocationAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'allocation_amount'
  },
  copyRatio: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 1.0,
    field: 'copy_ratio'
  },
  /** How the lot size is calculated when copying trades */
  lotMode: {
    type: DataTypes.ENUM('ratio', 'fixed', 'equity_pct', 'balance_ratio', 'risk_pct'),
    defaultValue: 'ratio',
    field: 'lot_mode'
  },
  /** Fixed lot size used when lotMode = 'fixed' */
  fixedLot: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    defaultValue: null,
    field: 'fixed_lot'
  },
  /** % of follower equity used per trade when lotMode = 'equity_pct' */
  equityPct: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    defaultValue: null,
    field: 'equity_pct'
  },
  /** Hard cap on lot size per copied trade (any mode) */
  maxLotPerTrade: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    defaultValue: null,
    field: 'max_lot_per_trade'
  },
  /** % of follower balance risked per trade when lotMode = 'risk_pct' */
  riskPct: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    defaultValue: null,
    field: 'risk_pct'
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'stopped'),
    allowNull: false,
    defaultValue: 'active'
  },
  totalCopiedProfit: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'total_copied_profit'
  },
  startedAt: {
    type: DataTypes.DATE,
    field: 'started_at'
  },
  stoppedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'stopped_at'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'copy_trade_followers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      // One active subscription per follower account per master
      unique: true,
      fields: ['master_id', 'follower_mt5_account_id'],
      name: 'uq_follower_master_account'
    }
  ]
});

export default CopyTradeFollower;
