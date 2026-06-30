import express from 'express';
import * as kycController from '../../controllers/admin/kyc.controller.js';

const router = express.Router();

/**
 * Admin KYC management routes
 */

router.get('/stats', kycController.getKycStats);
router.get('/pending', kycController.getPendingKyc);
router.get('/', kycController.getAllKyc);
router.get('/:kycId', kycController.getKycDetails);
router.put('/:kycId/approve', kycController.approveKyc);
router.put('/:kycId/reject', kycController.rejectKyc);

export default router;
