-- ============================================================
-- Migration 010 — Bonus System (bonuses + user_bonuses tables)
-- Run on: vycspktz_onefx database
-- ============================================================

-- ── Part A: Bonus templates defined by admin ─────────────────────────────────

CREATE TABLE IF NOT EXISTS bonuses (
  id            BIGINT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)     NOT NULL                                COMMENT 'Display name, e.g. "Welcome Bonus"',
  type          ENUM('welcome','deposit','old_user') NOT NULL            COMMENT 'Trigger category for the bonus',
  amount        DECIMAL(18,2)    NULL DEFAULT NULL                      COMMENT 'Fixed bonus amount (used when amount_type=fixed)',
  percentage    DECIMAL(5,2)     NULL DEFAULT NULL                      COMMENT 'Percentage of deposit (used when amount_type=percentage)',
  amount_type   ENUM('fixed','percentage') NOT NULL DEFAULT 'fixed'     COMMENT 'Whether bonus is a flat amount or % of deposit',
  required_lots DECIMAL(10,2)    NOT NULL DEFAULT 0.00                  COMMENT 'Lot volume user must trade before bonus is credited; 0 = instant',
  start_date    DATETIME         NULL DEFAULT NULL                      COMMENT 'When the bonus becomes available; NULL = always',
  expiry_date   DATETIME         NULL DEFAULT NULL                      COMMENT 'Hard cutoff date after which bonus cannot be claimed; NULL = no cutoff',
  expiry_days   INT              NULL DEFAULT NULL                      COMMENT 'Days after claim before bonus expires; NULL = never expires',
  max_claims    INT              NOT NULL DEFAULT 0                     COMMENT 'Max total claims across all users; 0 = unlimited',
  total_claimed INT              NOT NULL DEFAULT 0                     COMMENT 'Running count of how many times this bonus was claimed',
  is_active     TINYINT(1)       NOT NULL DEFAULT 1                     COMMENT '0 = hidden/disabled',
  description   TEXT             NULL DEFAULT NULL                      COMMENT 'Optional user-facing description',
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_bonuses_type     (type),
  INDEX idx_bonuses_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Part B: Per-user bonus claim records ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_bonuses (
  id             BIGINT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT           NOT NULL                              COMMENT 'FK → users.id',
  bonus_id       BIGINT           NOT NULL                              COMMENT 'FK → bonuses.id',
  mt5_account    VARCHAR(50)      NULL DEFAULT NULL                     COMMENT 'MT5 login the bonus is credited to (filled on credit)',
  amount         DECIMAL(18,2)    NOT NULL                              COMMENT 'Resolved bonus amount at time of claim',
  required_lots  DECIMAL(10,2)    NOT NULL DEFAULT 0.00                 COMMENT 'Lot target copied from bonus at claim time',
  completed_lots DECIMAL(10,2)    NOT NULL DEFAULT 0.00                 COMMENT 'Lots accumulated so far on this claim',
  status         ENUM('available','claimed','credited','expired','cancelled')
                                  NOT NULL DEFAULT 'available'          COMMENT 'Lifecycle state of this user-bonus record',
  claimed_at     DATETIME         NULL DEFAULT NULL                     COMMENT 'When the user claimed the bonus',
  credited_at    DATETIME         NULL DEFAULT NULL                     COMMENT 'When admin credited it to MT5',
  expires_at     DATETIME         NULL DEFAULT NULL                     COMMENT 'Computed expiry timestamp (claimed_at + expiry_days)',
  admin_note     TEXT             NULL DEFAULT NULL                     COMMENT 'Internal note from admin on credit/debit/cancel action',
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ub_user_id   (user_id),
  INDEX idx_ub_bonus_id  (bonus_id),
  INDEX idx_ub_status    (status),
  INDEX idx_ub_mt5       (mt5_account),

  CONSTRAINT fk_ub_user  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ub_bonus FOREIGN KEY (bonus_id) REFERENCES bonuses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
