import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * Notification routes
 */

router.get('/', verifyToken, notificationController.getNotifications);
router.get('/unread', verifyToken, notificationController.getUnreadCount);
router.put('/:id/read', verifyToken, notificationController.markAsRead);
router.put('/read-all', verifyToken, notificationController.markAllAsRead);
router.delete('/:id', verifyToken, notificationController.deleteNotification);

export default router;
