import express from 'express';
import * as dashboardController from '../../controllers/admin/dashboard.controller.js';

const router = express.Router();

/**
 * Admin dashboard routes
 */

router.get('/stats', dashboardController.getDashboardStats);
router.get('/charts', dashboardController.getDashboardCharts);

export default router;
