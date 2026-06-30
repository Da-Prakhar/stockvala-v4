import express from 'express';
import { verifyAdmin, requirePermission } from '../../middleware/auth.js';
import dashboardRoutes from './dashboard.routes.js';
import clientsRoutes from './clients.routes.js';
import depositRoutes from './deposit.routes.js';
import withdrawalRoutes from './withdrawal.routes.js';
import kycRoutes from './kyc.routes.js';
import settingsRoutes from './settings.routes.js';
import rolesRoutes from './roles.routes.js';
import supportRoutes from './support.routes.js';
import mt5Routes from './mt5.routes.js';
import paymentMethodRoutes from './paymentMethod.routes.js';
import copyTradeRoutes from './copyTrade.routes.js';
import mamRoutes from './mam.routes.js';
import pammRoutes from './pamm.routes.js';
import adminsRoutes from './admins.routes.js';
import ibRoutes from './ib.routes.js';
import feeRoutes from './fee.routes.js';

const router = express.Router();

/**
 * Admin routes
 */

router.use(verifyAdmin);

router.use('/dashboard', dashboardRoutes);
router.use('/clients', requirePermission('view_clients'), clientsRoutes);
router.use('/deposits', requirePermission('manage_deposits'), depositRoutes);
router.use('/withdrawals', requirePermission('manage_withdrawals'), withdrawalRoutes);
router.use('/kyc', requirePermission('manage_kyc'), kycRoutes);
router.use('/settings', requirePermission('manage_settings'), settingsRoutes);
router.use('/roles', requirePermission('manage_roles'), rolesRoutes);
router.use('/admins', requirePermission('manage_roles'), adminsRoutes);
router.use('/support', requirePermission('manage_support'), supportRoutes);
router.use('/mt5', mt5Routes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/copy-trading', copyTradeRoutes);
router.use('/mam', mamRoutes);
router.use('/pamm', pammRoutes);
router.use('/ib', ibRoutes);
router.use('/fees', feeRoutes);

export default router;
