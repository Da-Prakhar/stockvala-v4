import express from 'express';
import * as copyTradeController from '../../controllers/admin/copyTrade.controller.js';

const router = express.Router();

router.get('/stats', copyTradeController.getStats);
router.get('/masters', copyTradeController.getAllMasters);
router.get('/masters/:masterId', copyTradeController.getMasterDetails);
router.get('/masters/:masterId/followers', copyTradeController.getMasterFollowers);
router.post('/masters', copyTradeController.createMaster);
router.put('/masters/:masterId', copyTradeController.updateMaster);
router.put('/masters/:masterId/approve', copyTradeController.approveMaster);
router.put('/masters/:masterId/reject', copyTradeController.rejectMaster);
router.put('/masters/:masterId/suspend', copyTradeController.suspendMaster);
router.get('/copy-trades', copyTradeController.getAllCopyTrades);

// Follower management
router.get('/followers', copyTradeController.getAllFollowers);
router.put('/followers/:followerId', copyTradeController.updateFollower);

export default router;
