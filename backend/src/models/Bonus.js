import { DataTypes } from 'sequelize';
import db from '../config/database.js';

const Bonus = db.define('Bonus', {
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
    type: DataTypes.ENUM('welcome', 'deposit', 'old_user'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  amountType: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    defaultValue: 'fixed',
    field: 'amount_type'
  },
  requiredLots: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'required_lots'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'start_date'
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expiry_date'
  },
  expiryDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'expiry_days'
  },
  maxClaims: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'max_claims'
  },
  totalClaimed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_claimed'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'bonuses',
  timestamps: true,
  underscored: true
});

export default Bonus;
