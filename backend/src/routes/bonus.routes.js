import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as bonusController from '../controllers/bonus.controller.js';

const router = express.Router();

router.get('/', verifyToken, bonusController.getAvailableBonuses);
router.get('/my', verifyToken, bonusController.getMyBonuses);
router.get('/dashboard', verifyToken, bonusController.getDashboardBonuses);
router.post('/claim', verifyToken, bonusController.claimBonus);

export default router;
