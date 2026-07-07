import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Mt5Account model
 */
const Mt5Account = db.define('Mt5Account', {
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
  mt5Login: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
    field: 'mt5_login'
  },
  mt5Group: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'mt5_group'
  },
  accountType: {
    type: DataTypes.ENUM('demo', 'live', 'cent', 'copy_trading', 'contest'),
    allowNull: false,
    defaultValue: 'demo',
    field: 'account_type'
  },
  leverage: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  equity: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  margin: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  freeMargin: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'free_margin'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD'
  },
  market: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'forex'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'deleted'),
    allowNull: false,
    defaultValue: 'active'
  },
  serverName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'server_name'
  },
  tradingPassword: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'trading_password'
  },
  investorPassword: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'investor_password'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'mt5_accounts',
  timestamps: true,
  underscored: true
});

export default Mt5Account;
