import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * CopyTradeMaster model
 * Represents a user who has applied / been approved to be a master trader
 */
const CopyTradeMaster = db.define('CopyTradeMaster', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
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
  displayName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'display_name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tradingStyle: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'trading_style'
  },
  avatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'avatar_url'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'suspended'),
    defaultValue: 'pending'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  performanceFeePct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 20,
    field: 'performance_fee_pct'
  },
  managementFee: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'management_fee'
  },
  minInvestment: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 100,
    field: 'min_investment'
  },
  maxFollowers: {
    type: DataTypes.BIGINT,
    defaultValue: 100,
    field: 'max_followers'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  totalProfit: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'total_profit'
  },
  totalFollowers: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    field: 'total_followers'
  },
  winRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'win_rate'
  },
  totalTrades: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    field: 'total_trades'
  },
  maxDrawdown: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'max_drawdown'
  },
  /**
   * % of the performance fee the PLATFORM (broker) retains.
   * Remainder goes to the master trader.
   * e.g. performanceFeePct=20, platformFeeSplitPct=30
   *   → follower pays 20% of profit as fee
   *   → broker keeps 6% (30% of 20%), master keeps 14%
   */
  platformFeeSplitPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 30,
    field: 'platform_fee_split_pct'
  },

  /**
   * Broker-controlled settings for what followers are allowed to configure.
   * Stored as JSON. Default means all options open with wide limits.
   * Example:
   * {
   *   allowCopyRatio: true, copyRatioMin: 0.01, copyRatioMax: 10,
   *   allowFixedLot:  false, fixedLotMin: 0.01, fixedLotMax: 100,
   *   allowEquityPct: false, equityPctMin: 1,   equityPctMax: 100,
   *   allowMaxLotPerTrade: false, maxLotPerTradeMax: 50,
   *   maxFollowersPerUser: 1,
   *   defaultCopyRatio: 1.0
   * }
   */
  followerSettings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    field: 'follower_settings'
  },
  reviewedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'reviewed_by'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'copy_trade_masters',
  timestamps: true,
  underscored: true
});

export default CopyTradeMaster;
