import { Op } from 'sequelize';
import { Notification } from '../models/index.js';
import { io } from '../index.js';

/**
 * Notification service
 */

/**
 * Create notification
 * @param {number} userId - User ID
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (userId, notificationData) => {
  try {
    const notification = await Notification.create({
      userId,
      ...notificationData
    });

    // Emit via Socket.IO in real-time
    if (io) {
      io.to(`user:${userId}`).emit('notification:received', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt
      });
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
};

/**
 * Get user notifications
 * @param {number} userId - User ID
 * @param {Object} options - Query options (limit, offset, etc)
 * @returns {Promise<Array>} Notifications
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const where = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await Notification.findAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return notifications;
  } catch (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @returns {Promise<Object>} Updated notification
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.update({
      isRead: true,
      readAt: new Date()
    });

    return notification;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 * @param {number} userId - User ID
 * @returns {Promise<number>} Count of updated notifications
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await Notification.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          userId,
          isRead: false
        }
      }
    );

    return result[0]; // Return number of affected rows
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete notification
 * @param {number} notificationId - Notification ID
 * @returns {Promise<boolean>} Success flag
 */
export const deleteNotification = async (notificationId) => {
  try {
    const result = await Notification.destroy({
      where: { id: notificationId }
    });

    return result > 0;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    throw error;
  }
};

/**
 * Delete old notifications
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Count of deleted notifications
 */
export const deleteOldNotifications = async (daysOld = 30) => {
  try {
    const date = new Date();
    date.setDate(date.getDate() - daysOld);

    const result = await Notification.destroy({
      where: {
        createdAt: {
          [Op.lt]: date
        }
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to delete old notifications:', error);
    throw error;
  }
};

/**
 * Notification templates
 */
export const templates = {
  tradeOpened: (symbol, quantity, price) => ({
    type: 'trade',
    title: 'Trade Opened',
    message: `Trade opened: ${quantity} ${symbol} at ${price}`
  }),

  tradeClosed: (symbol, profit) => ({
    type: 'trade',
    title: 'Trade Closed',
    message: `Trade closed with ${profit >= 0 ? 'profit' : 'loss'}: ${profit}`
  }),

  depositReceived: (amount) => ({
    type: 'deposit',
    title: 'Deposit Received',
    message: `Your deposit of ${amount} has been received`
  }),

  depositApproved: (amount) => ({
    type: 'deposit',
    title: 'Deposit Approved',
    message: `Your deposit of ${amount} has been approved`
  }),

  withdrawalRequested: (amount) => ({
    type: 'withdrawal',
    title: 'Withdrawal Requested',
    message: `Your withdrawal request of ${amount} has been received`
  }),

  withdrawalApproved: (amount) => ({
    type: 'withdrawal',
    title: 'Withdrawal Approved',
    message: `Your withdrawal of ${amount} has been approved`
  }),

  kycSubmitted: () => ({
    type: 'kyc',
    title: 'KYC Submitted',
    message: 'Your KYC documents have been submitted for review'
  }),

  kycApproved: () => ({
    type: 'kyc',
    title: 'KYC Approved',
    message: 'Your KYC verification has been approved'
  }),

  supportTicketCreated: (ticketNumber) => ({
    type: 'support',
    title: 'Support Ticket Created',
    message: `Support ticket #${ticketNumber} has been created`
  }),

  supportReplyReceived: (ticketNumber) => ({
    type: 'support',
    title: 'Support Reply',
    message: `New reply on your support ticket #${ticketNumber}`
  })
};

export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteOldNotifications,
  templates
};
