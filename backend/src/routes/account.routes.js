import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as _accountControllerModule from '../controllers/account.controller.js';

// Support both named exports and default export patterns
const accountController = {
  ...((_accountControllerModule.default && typeof _accountControllerModule.default === 'object') ? _accountControllerModule.default : {}),
  ..._accountControllerModule
};

const router = express.Router();

/**
 * MT5 Account routes
 */

router.get('/', verifyToken, accountController.getUserAccounts);
router.post('/create', verifyToken, validate(schemas.createAccount), accountController.createAccount);
router.get('/:id', verifyToken, accountController.getAccountDetails);
router.get('/:id/positions', verifyToken, accountController.getAccountPositions);
router.post('/:id/sync', verifyToken, accountController.syncAccount);
router.put('/:id/leverage', verifyToken, validate(schemas.updateLeverage), accountController.updateLeverage);

export default router;
