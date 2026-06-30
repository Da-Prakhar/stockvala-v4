import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as walletController from '../controllers/wallet.controller.js';

const router = express.Router();

/**
 * Wallet routes
 */

// Balance & summary
router.get('/balance', verifyToken, walletController.getWalletBalance);
router.get('/summary', verifyToken, walletController.getWalletSummary);
router.get('/transactions', verifyToken, walletController.getWalletTransactions);

// Deposit & withdraw
router.post('/deposit', verifyToken, walletController.depositToWallet);
router.post('/withdraw', verifyToken, walletController.withdrawFromWallet);

// MT5 account funding
router.post('/fund-account', verifyToken, walletController.fundMt5Account);
router.post('/withdraw-mt5', verifyToken, walletController.withdrawMt5ToWallet);

// Transfer to another user
router.post('/transfer', verifyToken, walletController.transferFunds);

export default router;
