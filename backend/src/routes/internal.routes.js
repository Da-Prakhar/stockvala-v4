/**
 * Internal routes — called by the C# MT5 Gateway on the Windows VPS.
 * All endpoints require the MT5_BRIDGE_API_KEY header for authentication.
 *
 * Base path: /api/internal
 *
 * C# gateway must send:
 *   Header: x-api-key: <MT5_BRIDGE_API_KEY env value>
 *   OR
 *   Header: x-bridge-key: <MT5_BRIDGE_API_KEY env value>
 */
import express from 'express';
import { tradeClosed, tradeOpened } from '../controllers/internal/copyTrade.controller.js';
import { runSyncNow } from '../services/copyTradeSync.service.js';

const router = express.Router();

// ── API key guard ─────────────────────────────────────────────────────────
router.use((req, res, next) => {
  const expected = process.env.MT5_BRIDGE_API_KEY;
  if (!expected) {
    // If key is not configured, block all internal calls for safety
    return res.status(503).json({ success: false, message: 'Internal API key not configured on server' });
  }
  const provided = req.headers['x-api-key'] || req.headers['x-bridge-key'];
  if (provided !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
});

// ── Copy trade lifecycle events from C# gateway ───────────────────────────
router.post('/copy-trade/opened', tradeOpened);
router.post('/copy-trade/closed', tradeClosed);

// ── Manual sync trigger (force-check master positions right now) ──────────
router.post('/copy-trade/sync', async (req, res, next) => {
  try {
    const result = await runSyncNow();
    res.json({ success: true, ...result, message: 'Sync triggered' });
  } catch (err) { next(err); }
});

export default router;
