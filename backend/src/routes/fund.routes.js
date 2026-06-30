import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { uploadProofPayment } from '../middleware/upload.js';
import { withdrawalLimiter } from '../middleware/rateLimiter.js';
import * as fundController from '../controllers/fund.controller.js';

const router = express.Router();

/**
 * Deposit routes
 */
router.post('/deposits', verifyToken, validate(schemas.createDeposit), fundController.createDeposit);
router.get('/deposits', verifyToken, fundController.getUserDeposits);
router.post('/deposits/:id/proof', verifyToken, uploadProofPayment, fundController.uploadDepositProof);

/**
 * Withdrawal routes
 */
router.post('/withdrawals', verifyToken, withdrawalLimiter, validate(schemas.createWithdrawal), fundController.createWithdrawal);
router.get('/withdrawals', verifyToken, fundController.getUserWithdrawals);

/**
 * Payment method routes
 */
router.get('/payment-methods', verifyToken, fundController.getPaymentMethods);
router.post('/payment-methods', verifyToken, fundController.addPaymentMethod);
router.put('/payment-methods/:id', verifyToken, fundController.updatePaymentMethod);
router.delete('/payment-methods/:id', verifyToken, fundController.deletePaymentMethod);
router.post('/payment-methods/:id/qr', verifyToken, uploadProofPayment, fundController.uploadPaymentMethodQr);

export default router;
