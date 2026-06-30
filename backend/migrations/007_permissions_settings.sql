-- ============================================================
-- Migration 007 — Broker permission settings (market access,
--                 trading rules, copy-trading limits)
-- Run on: vycspktz_onefx database
-- ============================================================

-- All rows use ON DUPLICATE KEY UPDATE so re-running is safe.
-- The admin can override any value from the Trading Settings page.

INSERT INTO broker_settings (`key`, `value`, `type`, category, description, is_editable, created_at, updated_at)
VALUES
  -- ── Market access ──────────────────────────────────────────────────────────
  ('market_forex_enabled',        'true',  'boolean', 'permissions', 'Allow users to trade Forex currency pairs',                  1, NOW(), NOW()),
  ('market_crypto_enabled',       'true',  'boolean', 'permissions', 'Allow users to trade Cryptocurrency CFDs',                   1, NOW(), NOW()),
  ('market_metals_enabled',       'true',  'boolean', 'permissions', 'Allow users to trade precious metals (Gold, Silver)',        1, NOW(), NOW()),
  ('market_indices_enabled',      'true',  'boolean', 'permissions', 'Allow users to trade stock indices (US30, SPX500, NAS100)',  1, NOW(), NOW()),
  ('market_stocks_enabled',       'false', 'boolean', 'permissions', 'Allow users to trade individual stock CFDs',                 1, NOW(), NOW()),
  ('market_commodities_enabled',  'false', 'boolean', 'permissions', 'Allow users to trade commodity CFDs (Oil, Gas)',             1, NOW(), NOW()),

  -- ── Trading rules ──────────────────────────────────────────────────────────
  ('allow_scalping',              'true',  'boolean', 'permissions', 'Permit trades held under 60 seconds (scalping)',             1, NOW(), NOW()),
  ('allow_news_trading',          'true',  'boolean', 'permissions', 'Permit trading during high-impact news events',              1, NOW(), NOW()),
  ('allow_hedging',               'true',  'boolean', 'permissions', 'Permit simultaneous long & short on the same symbol',        1, NOW(), NOW()),
  ('allow_ea_trading',            'true',  'boolean', 'permissions', 'Permit automated/algorithmic trading via MT5 EAs',           1, NOW(), NOW()),
  ('allow_demo_accounts',         'true',  'boolean', 'permissions', 'Allow users to create demo MT5 accounts',                   1, NOW(), NOW()),
  ('kyc_required_to_trade',       'false', 'boolean', 'permissions', 'Block live trading until KYC documents are approved',        1, NOW(), NOW()),
  ('max_lot_size',                '100',   'number',  'permissions', 'Hard cap on lot size per order (0 = unlimited)',             1, NOW(), NOW()),

  -- ── Copy trading ───────────────────────────────────────────────────────────
  ('copy_allow_masters',          'true',  'boolean', 'permissions', 'Allow users to register as master/signal providers',         1, NOW(), NOW()),
  ('copy_allow_followers',        'true',  'boolean', 'permissions', 'Allow users to subscribe to copy a master',                  1, NOW(), NOW()),
  ('copy_max_followers_per_master','500',  'number',  'permissions', 'Max subscribers a single master can have (0 = unlimited)',   1, NOW(), NOW()),
  ('copy_min_allocation',         '100',   'number',  'permissions', 'Minimum USD a follower must allocate per subscription',      1, NOW(), NOW()),
  ('copy_max_allocation',         '100000','number',  'permissions', 'Maximum USD a follower can allocate per subscription (0 = unlimited)', 1, NOW(), NOW()),
  ('copy_min_performance_fee',    '0',     'number',  'permissions', 'Minimum performance fee (%) a master can set',               1, NOW(), NOW()),
  ('copy_max_performance_fee',    '50',    'number',  'permissions', 'Maximum performance fee (%) a master can charge',            1, NOW(), NOW()),
  ('copy_lot_modes_allowed',      'ratio,fixed,equity_pct,balance_ratio,risk_pct', 'string', 'permissions',
   'Comma-separated list of lot-sizing modes followers are allowed to choose', 1, NOW(), NOW())

ON DUPLICATE KEY UPDATE description = VALUES(description);
