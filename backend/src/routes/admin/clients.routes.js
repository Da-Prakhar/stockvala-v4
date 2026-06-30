import express from 'express';
import * as clientsController from '../../controllers/admin/clients.controller.js';

const router = express.Router();

/**
 * Admin clients management routes
 */

router.get('/', clientsController.getClients);
router.get('/:clientId', clientsController.getClientDetails);
router.put('/:clientId/status', clientsController.updateClientStatus);
router.put('/:clientId/kyc-status', clientsController.updateClientKycStatus);
router.post('/:clientId/reset-password', clientsController.resetClientPassword);

export default router;
