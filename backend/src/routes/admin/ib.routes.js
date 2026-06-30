import express from 'express';
import * as ibController from '../../controllers/admin/ib.controller.js';

const router = express.Router();

// Stats
router.get('/stats', ibController.getStats);

// Commission Levels CRUD
router.get('/levels', ibController.getLevels);
router.post('/levels', ibController.createLevel);
router.put('/levels/:levelId', ibController.updateLevel);
router.delete('/levels/:levelId', ibController.deleteLevel);

// IB Network
router.get('/network', ibController.getNetwork);

// Commission History
router.get('/commissions', ibController.getCommissions);
router.put('/commissions/:commissionId/status', ibController.updateCommissionStatus);

// Backfill: recalculate missing commissions from trade history + MT5 deals
router.post('/recalculate', ibController.recalculateCommissions);

export default router;
