import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Trade model
 */
const Trade = db.define('Trade', {
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
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  volume: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  openPrice: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
    field: 'open_price'
  },
  closePrice: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
    field: 'close_price'
  },
  sl: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  tp: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  openTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'open_time'
  },
  closeTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'close_time'
  },
  profit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  swap: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  commission: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'pending'),
    allowNull: false,
    defaultValue: 'pending'
  },
  syncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'synced_at'
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'trades',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default Trade;
