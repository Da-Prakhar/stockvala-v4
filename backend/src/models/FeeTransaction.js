import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * FeeTransaction model
 *
 * Records every fee/commission charged across Copy Trading, MAM, and PAMM.
 *
 * Fee flow:
 *   Performance fee → charged on profitable trade close
 *     feeAmount = grossProfit * feeRate / 100
 *     platformAmount = feeAmount * platformSplitPct / 100   ← broker's cut
 *     masterAmount   = feeAmount - platformAmount           ← manager's cut
 *
 *   Management fee → charged monthly on allocation/AUM
 *     feeAmount = allocationAmount * feeRate / 100 / 12     ← pro-rated monthly
 *     platformAmount = feeAmount  (management fee goes 100% to platform)
 *     masterAmount   = 0
 */
const FeeTransaction = db.define('FeeTransaction', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },

  /** Which product generated this fee */
  product: {
    type: DataTypes.ENUM('copy_trade', 'mam', 'pamm'),
    allowNull: false
  },

  /** Type of fee */
  feeType: {
    type: DataTypes.ENUM('performance_fee', 'management_fee'),
    allowNull: false,
    field: 'fee_type'
  },

  /**
   * The master / manager / pool ID this fee belongs to.
   * For copy_trade → CopyTradeMaster.id
   * For mam        → MamManager.id
   * For pamm       → PammManager.id
   */
  entityId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'entity_id'
  },

  /**
   * The subscriber paying the fee.
   * For copy_trade → CopyTradeFollower.id
   * For mam        → MamAccount.id
   * For pamm       → PammInvestor.id
   */
  subscriberId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'subscriber_id'
  },

  /**
   * The user paying the fee (denormalised for easy reporting).
   */
  userId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'user_id'
  },

  /**
   * Reference to the source record.
   * For performance_fee  → CopyTrade.id / PammSettlement.id / MamTrade.id
   * For management_fee   → null (periodic)
   */
  referenceId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'reference_id'
  },

  /**
   * The profit on which the performance fee was calculated.
   * Null for management fees.
   */
  grossProfit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'gross_profit'
  },

  /** Total fee amount charged to the subscriber */
  feeAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'fee_amount'
  },

  /** Broker's share (platformSplitPct % of feeAmount) */
  platformAmount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'platform_amount'
  },

  /** Master/manager's share (feeAmount - platformAmount) */
  masterAmount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'master_amount'
  },

  /** The fee % applied (performanceFeePct or managementFeePct) */
  feeRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'fee_rate'
  },

  /** The platform split % applied at time of charge */
  platformSplitPct: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 30,
    field: 'platform_split_pct'
  },

  status: {
    type: DataTypes.ENUM('pending', 'settled', 'cancelled'),
    defaultValue: 'settled'
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  settledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'settled_at'
  },

  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
}, {
  tableName: 'fee_transactions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['product', 'entity_id'] },
    { fields: ['user_id'] },
    { fields: ['fee_type', 'created_at'] },
    { fields: ['reference_id', 'product'] },
  ]
});

export default FeeTransaction;
