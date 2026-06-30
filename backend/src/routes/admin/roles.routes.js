import express from 'express';
import * as rolesController from '../../controllers/admin/roles.controller.js';

const router = express.Router();

/**
 * Admin roles management routes
 */

router.get('/', rolesController.getAllRoles);
router.get('/permissions', rolesController.getAvailablePermissions);
router.get('/:roleId', rolesController.getRoleDetails);
router.post('/', rolesController.createRole);
router.put('/:roleId', rolesController.updateRole);
router.delete('/:roleId', rolesController.deleteRole);

export default router;
