import express from 'express';
import * as mt5Controller from '../../controllers/admin/mt5.controller.js';

const router = express.Router();

// Health & Connection
router.get('/health', mt5Controller.healthCheck);
router.get('/config', mt5Controller.getConfig);
router.post('/connect', mt5Controller.connectServer);
router.post('/config', mt5Controller.updateConfig);
router.post('/test-connection', mt5Controller.testConnection);
router.post('/reload-config', mt5Controller.reloadConfig);

// Account Management
router.get('/accounts', mt5Controller.listMT5Accounts);
router.post('/accounts', mt5Controller.createMT5Account);
router.post('/accounts/link', mt5Controller.linkMT5Account);
router.get('/accounts/:login', mt5Controller.getAccountDetails);

// Financial Operations
router.post('/deposit', mt5Controller.depositFunds);
router.post('/withdraw', mt5Controller.withdrawFunds);

// Trading Data
router.get('/positions', mt5Controller.getAllPositions);
router.get('/positions/:login', mt5Controller.getPositionsByLogin);
router.post('/positions/:login/:ticket/close', mt5Controller.closePosition);
router.get('/deals/:login', mt5Controller.getDealHistory);

// Groups
router.get('/groups', mt5Controller.getGroups);

// Risk & Monitoring
router.get('/risk-monitor', mt5Controller.getBBookRiskMonitor);   // B-Book global risk dashboard
router.get('/risk/:login', mt5Controller.getRiskMonitor);          // per-account risk data

// IB Management
router.get('/ib/:masterLogin', mt5Controller.getIBHierarchy);

// Leverage
router.post('/leverage', mt5Controller.changeLeverage);

// Password Change
router.put('/accounts/:login/password', mt5Controller.changeAccountPassword);

// Sync
router.post('/sync/:userId', mt5Controller.syncUserAccounts);

export default router;
