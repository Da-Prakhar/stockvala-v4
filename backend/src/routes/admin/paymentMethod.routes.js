import express from 'express';
import { uploadProofPayment } from '../../middleware/upload.js';
import * as pmController from '../../controllers/admin/paymentMethod.controller.js';

const router = express.Router();

router.get('/', pmController.getAllPaymentMethods);
router.post('/', pmController.createPaymentMethod);
router.put('/:id', pmController.updatePaymentMethod);
router.delete('/:id', pmController.deletePaymentMethod);
router.post('/:id/qr', uploadProofPayment, pmController.uploadQrImage);

export default router;
