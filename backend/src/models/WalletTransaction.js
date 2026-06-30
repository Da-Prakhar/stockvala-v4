import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * WalletTransaction model
 */
const WalletTransaction = db.define('WalletTransaction', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  walletId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'wallet_id',
    references: {
      model: 'wallets',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'commission', 'rebate', 'pamm_invest', 'pamm_payout', 'pamm_refund'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  balanceBefore: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'balance_before'
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'balance_after'
  },
  referenceType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'reference_type'
  },
  referenceId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'reference_id'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'wallet_transactions',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default WalletTransaction;
