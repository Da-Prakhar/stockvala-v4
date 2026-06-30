import express from 'express';
import * as mamController from '../../controllers/mam.controller.js';

const router = express.Router();

/**
 * Admin MAM routes
 */
router.get('/managers', mamController.adminGetManagers);
router.post('/managers', mamController.adminCreateManager);
router.put('/managers/:managerId', mamController.adminUpdateManager);
router.get('/managers/:managerId/investors', mamController.adminGetManagerInvestors);
router.get('/trades', mamController.adminGetMamTrades);

export default router;
