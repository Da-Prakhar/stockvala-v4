import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Order model
 */
const Order = db.define('Order', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
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
  mt5Ticket: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'mt5_ticket'
  },
  symbol: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'),
    allowNull: false
  },
  volume: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  sl: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  tp: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'filled', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  syncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'synced_at'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default Order;
