import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Withdrawal model
 */
const Withdrawal = db.define('Withdrawal', {
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
  withdrawalDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'withdrawal_details'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'processing'),
    allowNull: false,
    defaultValue: 'pending'
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
  tableName: 'withdrawals',
  timestamps: true,
  underscored: true
});

export default Withdrawal;
