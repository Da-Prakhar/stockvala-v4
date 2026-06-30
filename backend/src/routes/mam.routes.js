import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as mamController from '../controllers/mam.controller.js';

const router = express.Router();

/**
 * MAM User routes
 */
router.get('/managers', verifyToken, mamController.getManagers);
router.get('/managers/:managerId', verifyToken, mamController.getManagerDetails);
router.post('/invest', verifyToken, mamController.investInMam);
router.get('/investments', verifyToken, mamController.getUserMamInvestments);
router.get('/investments/:mamAccountId/trades', verifyToken, mamController.getMamTrades);
router.put('/investments/:mamAccountId/allocation', verifyToken, mamController.updateMamAllocation);
router.delete('/investments/:mamAccountId', verifyToken, mamController.stopMamInvestment);

export default router;
