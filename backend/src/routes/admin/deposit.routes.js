import express from 'express';
import * as depositController from '../../controllers/admin/deposit.controller.js';

const router = express.Router();

/**
 * Admin deposit management routes
 */

router.post('/manual', depositController.manualDeposit);
router.get('/pending', depositController.getPendingDeposits);
router.get('/', depositController.getAllDeposits);
router.get('/:depositId', depositController.getDepositDetails);
router.put('/:depositId/approve', depositController.approveDeposit);
router.put('/:depositId/reject', depositController.rejectDeposit);

export default router;
