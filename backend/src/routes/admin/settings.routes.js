import express from 'express';
import * as settingsController from '../../controllers/admin/settings.controller.js';
import { uploadSingle } from '../../middleware/upload.js';

const router = express.Router();

/**
 * Admin settings management routes
 */

router.get('/', settingsController.getAllSettings);
router.put('/bulk', settingsController.bulkUpsertSettings);
router.get('/category/:category', settingsController.getSettingsByCategory);

// ── Category shortcut routes ──
// Frontend calls GET/PUT /admin/settings/trading (etc.) directly
// These must come BEFORE the generic /:key catch-all
const CATEGORY_SHORTCUTS = ['trading', 'mt5', 'general', 'company', 'deposit', 'withdrawal', 'kyc', 'notifications', 'branding', 'smtp', 'permissions', 'security'];
CATEGORY_SHORTCUTS.forEach(cat => {
  router.get(`/${cat}`, (req, res, next) => {
    req.params.category = cat;
    settingsController.getSettingsByCategory(req, res, next);
  });
  router.put(`/${cat}`, (req, res, next) => {
    // PUT /admin/settings/trading  →  bulk upsert with category = trading
    req.body = { settings: req.body, category: cat };
    settingsController.bulkUpsertSettings(req, res, next);
  });
});

router.post('/test-email', settingsController.testEmail);
router.get('/:key', settingsController.getSetting);
router.post('/', settingsController.createSetting);
router.post('/upload', uploadSingle, settingsController.uploadCompanyImage);
router.put('/:key', settingsController.updateSetting);
router.delete('/:key', settingsController.deleteSetting);

export default router;
