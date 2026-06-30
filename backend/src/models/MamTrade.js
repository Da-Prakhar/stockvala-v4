import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * MamTrade model - Tracks individual trade replications from MAM manager to investor
 */
const MamTrade = db.define('MamTrade', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  mamManagerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'mam_manager_id'
  },
  mamAccountId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'mam_account_id'
  },
  managerTicket: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'manager_ticket'
  },
  investorTicket: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'investor_ticket'
  },
  symbol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  managerLots: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'manager_lots'
  },
  investorLots: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'investor_lots'
  },
  openPrice: {
    type: DataTypes.DECIMAL(18, 5),
    allowNull: true,
    field: 'open_price'
  },
  closePrice: {
    type: DataTypes.DECIMAL(18, 5),
    allowNull: true,
    field: 'close_price'
  },
  profit: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  fee: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'failed'),
    allowNull: false,
    defaultValue: 'open'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  openedAt: {
    type: DataTypes.DATE,
    field: 'opened_at'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
}, {
  tableName: 'mam_trades',
  timestamps: true,
  underscored: true
});

export default MamTrade;
