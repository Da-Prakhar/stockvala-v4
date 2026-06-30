import express from 'express';
import * as publicController from '../controllers/public.controller.js';

const router = express.Router();

router.get('/settings/company', publicController.getPublicSettings);
router.get('/pages/:slug', publicController.getPage);
// Price snapshot — no auth, used by Flutter Markets screen on initial load
// GET /api/public/prices?symbols=EURUSD,GBPUSD,XAUUSD,...
router.get('/prices', publicController.getPrices);

export default router;
