import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as copyTradeController from '../controllers/copyTrade.controller.js';
import { FeeTransaction } from '../models/index.js';
import { successResponse, paginatedResponse } from '../utils/response.js';

const router = express.Router();

/**
 * Copy Trading — Master application
 */
// Public config — no auth needed
router.get('/config', copyTradeController.getCopyConfig);

router.post('/apply-master', verifyToken, copyTradeController.applyAsMaster);
router.get('/my-master-profile', verifyToken, copyTradeController.getMyMasterProfile);

/**
 * Copy Trading — Browse & follow masters
 */
router.get('/masters', verifyToken, copyTradeController.getMasters);
router.get('/masters/:masterId', verifyToken, copyTradeController.getMasterDetails);
router.get('/masters/:masterId/live-positions', verifyToken, copyTradeController.getMasterLivePositions);
router.post('/follow/:masterId', verifyToken, copyTradeController.followMaster);
router.delete('/unfollow/:masterId', verifyToken, copyTradeController.unfollowMaster);
router.get('/followings', verifyToken, copyTradeController.getUserFollowings);
router.get('/copy-trades', verifyToken, copyTradeController.getUserCopyTrades);
router.put('/followings/:followingId/settings', verifyToken, copyTradeController.updateFollowingSettings);
router.put('/followings/:followingId/pause', verifyToken, copyTradeController.pauseFollowing);
router.put('/followings/:followingId/resume', verifyToken, copyTradeController.resumeFollowing);

/**
 * User's own fee history across all products
 * GET /copy-trading/my-fees?page=&limit=&product=&feeType=
 */
router.get('/my-fees', verifyToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, product, feeType } = req.query;
    const offset = (page - 1) * limit;
    const where = { userId: req.user.id };
    if (product) where.product = product;
    if (feeType) where.feeType = feeType;

    const { count, rows } = await FeeTransaction.findAndCountAll({
      where, limit: parseInt(limit), offset, order: [['createdAt', 'DESC']]
    });

    // Summary totals
    const totalFees = rows.reduce((s, r) => s + parseFloat(r.feeAmount || 0), 0);

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Fee history retrieved', { totalFees: totalFees.toFixed(2) }));
  } catch (err) { next(err); }
});

export default router;
