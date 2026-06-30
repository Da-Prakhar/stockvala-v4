import express from 'express';
import * as pammController from '../../controllers/pamm.controller.js';

const router = express.Router();

/**
 * Admin PAMM routes
 */
router.get('/pools', pammController.adminGetPools);
router.post('/pools', pammController.adminCreatePool);
router.put('/pools/:poolId', pammController.adminUpdatePool);
router.get('/pools/:poolId/investors', pammController.adminGetPoolInvestors);
router.post('/pools/:poolId/settle', pammController.adminTriggerSettlement);
router.get('/settlements', pammController.adminGetSettlements);

export default router;
