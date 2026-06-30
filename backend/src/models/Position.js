import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Position model
 */
const Position = db.define('Position', {
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
  currentPrice: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
    field: 'current_price'
  },
  sl: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  tp: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  profit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  swap: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  openTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'open_time'
  },
  syncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'synced_at'
  }
}, {
  tableName: 'positions',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default Position;
