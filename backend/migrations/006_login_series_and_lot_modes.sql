-- ============================================================
-- Migration 006 — Sequential MT5 login IDs + extra lot modes
-- Run on: vycspktz_onefx database
-- ============================================================

-- ── Part A: Broker settings for sequential MT5 login IDs ────────────────────
-- Admin can enable this in Settings to force all new accounts to be created
-- with incrementing login numbers starting from mt5_login_series_next.

INSERT INTO broker_settings (`key`, `value`, `type`, `category`, `description`, `is_editable`, `created_at`, `updated_at`)
VALUES
  ('mt5_login_series_enabled', 'false', 'boolean', 'mt5',
   'When true, new MT5 accounts are created with sequential login IDs instead of letting MT5 auto-assign.',
   1, NOW(), NOW()),
  ('mt5_login_series_next', '2000001', 'number', 'mt5',
   'The next MT5 login ID to use. Increments automatically after each account creation. Set the start value here.',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ── Part B: New lot-sizing modes for copy trading ────────────────────────────
-- balance_ratio: auto-scales lots proportionally to follower/master balance ratio
--   e.g. master has $100k, follower has $10k → ratio = 0.1 → 1 master lot = 0.1 follower lot
-- risk_pct: follower risks X% of their balance per trade
--   uses master's SL distance in pips to calculate lot size; falls back to 20-pip assumption if no SL

ALTER TABLE copy_trade_followers
  MODIFY COLUMN lot_mode
    ENUM('ratio','fixed','equity_pct','balance_ratio','risk_pct')
    NOT NULL DEFAULT 'ratio'
    COMMENT 'How lot size is calculated when copying trades',
  ADD COLUMN IF NOT EXISTS risk_pct DECIMAL(6,2) NULL DEFAULT NULL
    COMMENT '% of follower balance risked per trade when lot_mode = risk_pct';
