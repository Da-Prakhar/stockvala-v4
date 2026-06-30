import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * Role model
 */
const Role = db.define('Role', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  permissionIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'roles',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default Role;
