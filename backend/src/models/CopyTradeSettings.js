import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * CopyTradeSettings model
 */
const CopyTradeSettings = db.define('CopyTradeSettings', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  followerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
    field: 'follower_id',
    references: {
      model: 'copy_trade_followers',
      key: 'id'
    }
  },
  maxTradeSize: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    field: 'max_trade_size'
  },
  stopLossPct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'stop_loss_pct'
  },
  takeProfitPct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'take_profit_pct'
  },
  copyPendingOrders: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'copy_pending_orders'
  },
  reverseCopy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'reverse_copy'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'copy_trade_settings',
  timestamps: true,
  underscored: true
});

export default CopyTradeSettings;
