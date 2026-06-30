import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { tradeLimiter } from '../middleware/rateLimiter.js';
import * as _tradeControllerModule from '../controllers/trade.controller.js';

// Support both named exports and default export patterns
const tradeController = {
  ...((_tradeControllerModule.default && typeof _tradeControllerModule.default === 'object') ? _tradeControllerModule.default : {}),
  ..._tradeControllerModule
};

const router = express.Router();

/**
 * Trade routes
 */

// Data routes
router.get('/', verifyToken, tradeController.getUserTrades);
router.get('/history', verifyToken, tradeController.getTradeHistory);
router.get('/positions', verifyToken, tradeController.getUserPositions);
router.get('/orders', verifyToken, tradeController.getUserOrders);
router.get('/symbols', verifyToken, tradeController.getSymbols);
router.get('/symbols/grouped', verifyToken, tradeController.getGroupedSymbols);
router.get('/tick/:symbol', verifyToken, tradeController.getSymbolTick);
router.get('/chart/:symbol', verifyToken, tradeController.getChartData);

// Action routes (rate limited)
router.post('/close/:tradeId', verifyToken, tradeLimiter, tradeController.closeTrade);
router.post('/modify/:tradeId', verifyToken, tradeLimiter, tradeController.modifyTrade);
router.post('/place-order', verifyToken, tradeLimiter, tradeController.placeOrder);

export default router;
