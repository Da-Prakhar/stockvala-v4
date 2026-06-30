import express from 'express';
import * as adminsController from '../../controllers/admin/admins.controller.js';

const router = express.Router();

/**
 * Admin users management routes
 */

router.get('/', adminsController.getAllAdmins);
router.post('/', adminsController.createAdmin);

export default router;
