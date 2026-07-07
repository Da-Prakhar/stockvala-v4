-- 009_bank_details_and_mt5_passwords.sql
-- Adds:
--   1. Bank account details on user_profiles (Fix 3)
--   2. Last-known MT5 trading/investor passwords on mt5_accounts, so the
--      admin CRM can show a "Show Password" reveal even though MT5 has no
--      password-retrieval API of its own (Fix 6)

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE mt5_accounts
  ADD COLUMN IF NOT EXISTS trading_password  VARCHAR(255) NULL DEFAULT NULL COMMENT 'Last known MT5 trading password, set by us',
  ADD COLUMN IF NOT EXISTS investor_password VARCHAR(255) NULL DEFAULT NULL COMMENT 'Last known MT5 investor password, set by us';
