-- ============================================================
-- Migration 004 — Broker Fee / Commission System
-- Run on: vycspktz_onefx database
-- ============================================================

-- 1. fee_transactions table
CREATE TABLE IF NOT EXISTS fee_transactions (
  id                 BIGINT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product            ENUM('copy_trade','mam','pamm') NOT NULL,
  fee_type           ENUM('performance_fee','management_fee') NOT NULL,
  entity_id          BIGINT          NOT NULL,          -- master/manager/pool id
  subscriber_id      BIGINT          NULL,              -- follower/investor id
  user_id            BIGINT          NULL,
  reference_id       BIGINT          NULL,              -- copy_trade.id etc.
  gross_profit       DECIMAL(18,2)   NULL,
  fee_amount         DECIMAL(18,2)   NOT NULL,
  platform_amount    DECIMAL(18,2)   NOT NULL DEFAULT 0,
  master_amount      DECIMAL(18,2)   NOT NULL DEFAULT 0,
  fee_rate           DECIMAL(5,2)    NOT NULL DEFAULT 0,
  platform_split_pct DECIMAL(5,2)    NOT NULL DEFAULT 30,
  status             ENUM('pending','settled','cancelled') NOT NULL DEFAULT 'settled',
  notes              TEXT            NULL,
  settled_at         DATETIME        NULL,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_product_entity  (product, entity_id),
  INDEX idx_user_id         (user_id),
  INDEX idx_fee_type_date   (fee_type, created_at),
  INDEX idx_reference       (reference_id, product)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add platformFeeSplitPct to copy_trade_masters
ALTER TABLE copy_trade_masters
  ADD COLUMN IF NOT EXISTS platform_fee_split_pct DECIMAL(5,2) NOT NULL DEFAULT 30
    COMMENT 'Broker keeps this % of the performance fee; rest goes to master';

-- 3. Add platformFeeSplitPct to mam_managers
ALTER TABLE mam_managers
  ADD COLUMN IF NOT EXISTS platform_fee_split_pct DECIMAL(5,2) NOT NULL DEFAULT 30;

-- 4. Add platformFeeSplitPct to pamm_managers
ALTER TABLE pamm_managers
  ADD COLUMN IF NOT EXISTS platform_fee_split_pct DECIMAL(5,2) NOT NULL DEFAULT 30;

-- 5. Default broker settings (safe upsert)
INSERT INTO broker_settings (`key`, `value`, `type`, `category`, `description`, `is_editable`)
VALUES
  ('copy_platform_fee_split_default', '30', 'number', 'fees',
   'Default % of copy trading performance fee that platform retains', 1),
  ('mam_platform_fee_split_default',  '30', 'number', 'fees',
   'Default % of MAM performance/management fee that platform retains', 1),
  ('pamm_platform_fee_split_default', '30', 'number', 'fees',
   'Default % of PAMM performance/management fee that platform retains', 1),
  ('management_fee_billing_day',      '1',  'number', 'fees',
   'Day of month management fees are settled (1 = 1st of month)', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();
