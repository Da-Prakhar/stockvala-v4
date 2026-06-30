import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import accountRoutes from './account.routes.js';
import fundRoutes from './fund.routes.js';
import tradeRoutes from './trade.routes.js';
import copyTradeRoutes from './copyTrade.routes.js';
import mamRoutes from './mam.routes.js';
import pammRoutes from './pamm.routes.js';
import walletRoutes from './wallet.routes.js';
import supportRoutes from './support.routes.js';
import ibRoutes from './ib.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin/index.js';
import kycRoutes from './kyc.routes.js';
import publicRoutes from './public.routes.js';
import diagRoutes from './diag.routes.js';
import internalRoutes from './internal.routes.js';

const router = express.Router();

/**
 * Public routes
 */
router.use('/public',   publicRoutes);
router.use('/diag',     diagRoutes);    // Full system diagnostic — open, no auth
router.use('/internal', internalRoutes); // C# MT5 Gateway webhooks — API-key protected

/**
 * User routes
 */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/accounts', accountRoutes);
router.use('/funds', fundRoutes);
router.use('/trades', tradeRoutes);
router.use('/copy-trading', copyTradeRoutes);
router.use('/mam', mamRoutes);
router.use('/pamm', pammRoutes);
router.use('/wallet', walletRoutes);
router.use('/support', supportRoutes);
router.use('/ib', ibRoutes);
router.use('/notifications', notificationRoutes);
router.use('/kyc', kycRoutes);

/**
 * Admin routes
 */
router.use('/admin', adminRoutes);

export default router;
