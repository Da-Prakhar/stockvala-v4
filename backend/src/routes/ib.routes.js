import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as ibController from '../controllers/ib.controller.js';

const router = express.Router();

/**
 * Introducing Broker routes
 */

router.get('/tree', verifyToken, ibController.getIbTree);
router.get('/commissions', verifyToken, ibController.getIbCommissions);
router.get('/stats', verifyToken, ibController.getIbStats);
router.get('/referrals', verifyToken, ibController.getReferrals);

export default router;
