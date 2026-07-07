import express from 'express';
import * as bonusController from '../../controllers/admin/bonus.controller.js';

const router = express.Router();

router.get('/', bonusController.getAllBonuses);
router.post('/', bonusController.createBonus);
router.put('/:id', bonusController.updateBonus);
router.delete('/:id', bonusController.deleteBonus);
router.get('/claims', bonusController.getBonusClaims);
router.post('/assign', bonusController.assignBonusToUser);
router.post('/credit', bonusController.creditBonusToUser);
router.post('/debit', bonusController.debitBonusFromUser);

export default router;
