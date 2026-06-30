import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Permission model
 * DB columns: id, name, description, created_at
 */
const Permission = db.define('Permission', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'permissions',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default Permission;
