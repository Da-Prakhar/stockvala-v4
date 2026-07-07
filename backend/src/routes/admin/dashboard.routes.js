import express from 'express';
import * as dashboardController from '../../controllers/admin/dashboard.controller.js';

const router = express.Router();

/**
 * Admin dashboard routes
 */

router.get('/stats', dashboardController.getDashboardStats);
router.get('/charts', dashboardController.getDashboardCharts);
router.get('/mt5-totals', dashboardController.getMt5Totals);

export default router;
