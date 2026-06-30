import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * SupportMessage model
 */
const SupportMessage = db.define('SupportMessage', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  ticketId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'ticket_id',
    references: {
      model: 'support_tickets',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'sender_id'
  },
  senderType: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    field: 'sender_type'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  attachmentUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'attachment_url'
  },
  createdAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'support_messages',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

export default SupportMessage;
