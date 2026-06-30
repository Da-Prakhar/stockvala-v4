import { Notification } from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { limit = 20, page = 1, isRead } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const { count, rows } = await Notification.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Notifications retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json(successResponse({ unreadCount: count }, 'Unread count retrieved'));
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification || notification.userId !== req.user.id) {
      throw new NotFoundError('Notification not found');
    }

    await notification.update({ isRead: true });

    res.json(successResponse(notification, 'Marked as read'));
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );

    res.json(successResponse(null, 'All marked as read'));
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification || notification.userId !== req.user.id) {
      throw new NotFoundError('Notification not found');
    }

    await notification.destroy();

    res.json(successResponse(null, 'Notification deleted'));
  } catch (error) {
    next(error);
  }
};

export default { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };
