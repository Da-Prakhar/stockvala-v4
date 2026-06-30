-- ============================================================
-- Migration 008 — 2FA (email OTP + TOTP) + IB per-lot commission
-- Run on: vycspktz_onefx database
-- ============================================================

-- ── Part A: 2FA fields on users ─────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_method ENUM('email','totp') NOT NULL DEFAULT 'email'
    COMMENT 'Which 2FA method the user uses when 2FA is enabled',
  ADD COLUMN IF NOT EXISTS email_otp_code VARCHAR(10) NULL DEFAULT NULL
    COMMENT 'Current email OTP code (cleartext, short-lived)',
  ADD COLUMN IF NOT EXISTS email_otp_expires DATETIME NULL DEFAULT NULL
    COMMENT 'Expiry timestamp for the email OTP code';

-- ── Part B: Per-lot commission on ib_levels ──────────────────────────────────

ALTER TABLE ib_levels
  ADD COLUMN IF NOT EXISTS commission_mode ENUM('percentage','per_lot') NOT NULL DEFAULT 'percentage'
    COMMENT 'How trading commission is calculated: % of profit or fixed $ per lot',
  ADD COLUMN IF NOT EXISTS per_lot_commission DECIMAL(10,4) NOT NULL DEFAULT 0.0000
    COMMENT 'Fixed commission amount per lot when commission_mode = per_lot';

-- ── Part C: Broker settings for 2FA policy ───────────────────────────────────

INSERT INTO broker_settings (`key`, `value`, `type`, `category`, `description`, `is_editable`, `created_at`, `updated_at`)
VALUES
  ('two_factor_required', 'false', 'boolean', 'security',
   'When true, ALL users must complete 2FA on every login regardless of their personal setting.',
   1, NOW(), NOW()),
  ('two_factor_methods_allowed', 'email,totp', 'string', 'security',
   'Comma-separated list of 2FA methods users may choose: email, totp',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE description = VALUES(description);
