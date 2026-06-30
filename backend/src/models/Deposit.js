import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Deposit model
 */
const Deposit = db.define('Deposit', {
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
    allowNull: true,
    field: 'mt5_account_id',
    references: {
      model: 'mt5_accounts',
      key: 'id'
    }
  },
  paymentMethodId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'payment_method_id',
    references: {
      model: 'payment_methods',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'processing'),
    allowNull: false,
    defaultValue: 'pending'
  },
  transactionRef: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'transaction_ref'
  },
  proofImageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'proof_image_url'
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes'
  },
  approvedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'approved_by',
    references: {
      model: 'admin_users',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'deposits',
  timestamps: true,
  underscored: true
});

export default Deposit;
