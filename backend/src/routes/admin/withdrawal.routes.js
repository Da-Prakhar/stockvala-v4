import express from 'express';
import * as withdrawalController from '../../controllers/admin/withdrawal.controller.js';

const router = express.Router();

/**
 * Admin withdrawal management routes
 */

// Manual direct-debit must come before /:withdrawalId so it isn't swallowed as a param
router.post('/manual', withdrawalController.manualWithdrawal);

router.get('/pending', withdrawalController.getPendingWithdrawals);
router.get('/', withdrawalController.getAllWithdrawals);
router.get('/:withdrawalId', withdrawalController.getWithdrawalDetails);
router.put('/:withdrawalId/approve', withdrawalController.approveWithdrawal);
router.put('/:withdrawalId/reject', withdrawalController.rejectWithdrawal);

export default router;
