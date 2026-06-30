import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * IbTree model - Introducing Broker tree structure
 */
const IbTree = db.define('IbTree', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  ibCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  parentId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'ib_trees',
      key: 'id'
    }
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  totalReferrals: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  directReferrals: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  indirectReferrals: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalDeposits: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  totalCommissions: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  monthlyCommissions: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ib_trees',
  timestamps: true,
  underscored: true
});

export default IbTree;
