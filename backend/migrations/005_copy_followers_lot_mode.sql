-- ============================================================
-- Migration 005 — Copy Trade Followers: lot-sizing columns
-- Run on: vycspktz_onefx database
-- These columns allow each follower to choose their lot mode:
--   ratio      — multiply master lot by copy_ratio (default, V1 behaviour)
--   fixed      — always use fixed_lot regardless of master size
--   equity_pct — use equity_pct % of follower equity per trade
-- ============================================================

ALTER TABLE copy_trade_followers
  ADD COLUMN IF NOT EXISTS lot_mode       ENUM('ratio','fixed','equity_pct') NOT NULL DEFAULT 'ratio'
    COMMENT 'How lot size is calculated when copying trades',
  ADD COLUMN IF NOT EXISTS fixed_lot      DECIMAL(18,4) NULL DEFAULT NULL
    COMMENT 'Fixed lot size used when lot_mode = fixed',
  ADD COLUMN IF NOT EXISTS equity_pct     DECIMAL(6,2)  NULL DEFAULT NULL
    COMMENT '% of follower equity used per trade when lot_mode = equity_pct',
  ADD COLUMN IF NOT EXISTS max_lot_per_trade DECIMAL(18,4) NULL DEFAULT NULL
    COMMENT 'Hard cap on lot size per copied trade (any mode)';
