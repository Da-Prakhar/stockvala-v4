import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * PaymentMethod model
 * Admin-configured payment methods available to all users
 */
const PaymentMethod = db.define('PaymentMethod', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('bank', 'usdt', 'upi', 'angadiya', 'other'),
    allowNull: false
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  minAmount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'min_amount'
  },
  maxAmount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'max_amount'
  },
  createdBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'created_by',
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
  tableName: 'payment_methods',
  timestamps: true,
  underscored: true
});

export default PaymentMethod;
