import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * PammSettlement model - Records periodic P&L distribution for PAMM pools
 */
const PammSettlement = db.define('PammSettlement', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  pammManagerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'pamm_manager_id'
  },
  settlementDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'settlement_date'
  },
  startEquity: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'start_equity'
  },
  endEquity: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'end_equity'
  },
  totalPnl: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'total_pnl'
  },
  performanceFee: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'performance_fee'
  },
  managementFee: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    field: 'management_fee'
  },
  netPnl: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    field: 'net_pnl'
  },
  investorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'investor_count'
  },
  status: {
    type: DataTypes.ENUM('completed', 'failed', 'pending'),
    allowNull: false,
    defaultValue: 'completed'
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Per-investor breakdown: [{investorId, sharePct, pnl, fee}]'
  },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
}, {
  tableName: 'pamm_settlements',
  timestamps: true,
  underscored: true
});

export default PammSettlement;
