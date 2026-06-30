import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * SupportTicket model
 */
const SupportTicket = db.define('SupportTicket', {
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
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    allowNull: false,
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'),
    allowNull: false,
    defaultValue: 'open'
  },
  assignedTo: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'assigned_to',
    references: {
      model: 'admin_users',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'support_tickets',
  timestamps: true,
  underscored: true
});

export default SupportTicket;
