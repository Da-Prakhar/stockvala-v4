import { Router } from 'express';
import feeController from '../../controllers/admin/fee.controller.js';

const router = Router();

// Dashboard
router.get('/summary',          feeController.getSummary);
router.get('/transactions',     feeController.getTransactions);

// Fee settings per entity
router.put('/copy-masters/:masterId',   feeController.updateCopyMasterFees);
router.put('/mam-managers/:managerId', feeController.updateMamManagerFees);
router.put('/pamm-pools/:poolId',      feeController.updatePammPoolFees);

// Settlement & corrections
router.post('/settle-management', feeController.triggerManagementFeeSettlement);
router.post('/manual-charge',     feeController.manualCharge);
router.delete('/transactions/:id', feeController.cancelTransaction);

export default router;
