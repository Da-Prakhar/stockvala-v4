import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as pammController from '../controllers/pamm.controller.js';

const router = express.Router();

/**
 * PAMM User routes
 */
router.get('/pools', verifyToken, pammController.getPools);
router.get('/pools/:poolId', verifyToken, pammController.getPoolDetails);
router.post('/invest', verifyToken, pammController.investInPamm);
router.get('/investments', verifyToken, pammController.getUserPammInvestments);
router.put('/investments/:pammInvestorId/allocation', verifyToken, pammController.updatePammAllocation);
router.delete('/investments/:pammInvestorId', verifyToken, pammController.stopPammInvestment);

export default router;
