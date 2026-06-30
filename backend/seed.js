// seed.js — Run once: node seed.js
// Initializes DB with broker settings, roles, and admin user for TrustFX

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Sequelize, DataTypes } from 'sequelize';

const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
  }
);

const BrokerSetting = db.define('BrokerSetting', {
  key: { type: DataTypes.STRING, unique: true },
  value: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' },
  category: { type: DataTypes.STRING, defaultValue: 'general' },
  description: { type: DataTypes.TEXT },
  isEditable: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_editable' },
}, { tableName: 'broker_settings', underscored: true });

const Role = db.define('Role', {
  name: { type: DataTypes.STRING(50), unique: true },
  description: { type: DataTypes.TEXT },
  permissionIds: { type: DataTypes.JSON, defaultValue: [], field: 'permission_ids' },
}, { tableName: 'roles', underscored: true, updatedAt: false });

const AdminUser = db.define('AdminUser', {
  email: { type: DataTypes.STRING, unique: true },
  password: { type: DataTypes.STRING, field: 'password_hash' },
  firstName: { type: DataTypes.STRING, field: 'first_name' },
  lastName: { type: DataTypes.STRING, field: 'last_name' },
  roleId: { type: DataTypes.BIGINT, field: 'role_id' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, { tableName: 'admin_users', underscored: true });

async function run() {
  await db.authenticate();
  console.log('✓ DB connected');

  // ── Broker Settings ──────────────────────────────────────────────────────
  const settings = [
    // Company / Branding
    { key: 'companyName',     value: 'TrustFX',   type: 'string',  category: 'company',  description: 'Company name' },
    { key: 'platform_name',   value: 'TrustFX',   type: 'string',  category: 'company',  description: 'Platform display name' },
    { key: 'logoUrl',         value: '',           type: 'string',  category: 'branding', description: 'Logo URL (upload via admin)' },
    { key: 'faviconUrl',      value: '',           type: 'string',  category: 'branding', description: 'Favicon URL' },
    { key: 'primaryColor',    value: '#1a56db',    type: 'string',  category: 'branding', description: 'Primary brand color' },
    { key: 'secondaryColor',  value: '#0e3fa6',    type: 'string',  category: 'branding', description: 'Secondary brand color' },
    { key: 'accentColor',     value: '#f59e0b',    type: 'string',  category: 'branding', description: 'Accent color' },
    // Contact
    { key: 'email',           value: 'support@trustfx.in', type: 'string', category: 'company', description: 'Support email' },
    { key: 'phone',           value: '',           type: 'string',  category: 'company',  description: 'Support phone' },
    { key: 'address',         value: '',           type: 'string',  category: 'company',  description: 'Company address' },
    // Social
    { key: 'facebook',        value: '',           type: 'string',  category: 'company',  description: 'Facebook URL' },
    { key: 'twitter',         value: '',           type: 'string',  category: 'company',  description: 'Twitter/X URL' },
    { key: 'linkedin',        value: '',           type: 'string',  category: 'company',  description: 'LinkedIn URL' },
    { key: 'instagram',       value: '',           type: 'string',  category: 'company',  description: 'Instagram URL' },
    { key: 'footerText',      value: '© 2024 TrustFX. All rights reserved.', type: 'string', category: 'company', description: 'Footer text' },
    { key: 'disclaimer',      value: 'Trading involves significant risk. Only invest what you can afford to lose.', type: 'string', category: 'company', description: 'Risk disclaimer' },
    // MT5
    { key: 'mt5_server',      value: '84.201.6.142:443',  type: 'string', category: 'mt5', description: 'MT5 server address' },
    { key: 'mt5_server_name', value: 'StarwaveFX-Server', type: 'string', category: 'mt5', description: 'MT5 server display name' },
    // Trading
    { key: 'min_deposit',     value: '100',  type: 'number', category: 'trading', description: 'Minimum deposit (USD)' },
    { key: 'min_withdrawal',  value: '50',   type: 'number', category: 'trading', description: 'Minimum withdrawal (USD)' },
    { key: 'currency',        value: 'USD',  type: 'string', category: 'trading', description: 'Base currency' },
    // Permissions
    { key: 'market_forex_enabled',            value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow Forex trading' },
    { key: 'market_crypto_enabled',           value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow Crypto trading' },
    { key: 'market_metals_enabled',           value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow metals (Gold/Silver) trading' },
    { key: 'market_indices_enabled',          value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow indices trading' },
    { key: 'market_stocks_enabled',           value: 'false',  type: 'boolean', category: 'permissions', description: 'Allow stocks trading' },
    { key: 'market_commodities_enabled',      value: 'false',  type: 'boolean', category: 'permissions', description: 'Allow commodities trading' },
    { key: 'allow_scalping',                  value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow scalping' },
    { key: 'allow_news_trading',              value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow news trading' },
    { key: 'allow_hedging',                   value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow hedging' },
    { key: 'allow_ea_trading',                value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow EA/automated trading' },
    { key: 'allow_demo_accounts',             value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow demo accounts' },
    { key: 'kyc_required_to_trade',           value: 'false',  type: 'boolean', category: 'permissions', description: 'Require KYC before trading' },
    { key: 'max_lot_size',                    value: '100',    type: 'number',  category: 'permissions', description: 'Max lot size per order (0=unlimited)' },
    { key: 'copy_allow_masters',              value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow master accounts' },
    { key: 'copy_allow_followers',            value: 'true',   type: 'boolean', category: 'permissions', description: 'Allow copy followers' },
    { key: 'copy_max_followers_per_master',   value: '500',    type: 'number',  category: 'permissions', description: 'Max followers per master (0=unlimited)' },
    { key: 'copy_min_allocation',             value: '100',    type: 'number',  category: 'permissions', description: 'Min copy allocation (USD)' },
    { key: 'copy_max_allocation',             value: '100000', type: 'number',  category: 'permissions', description: 'Max copy allocation (USD)' },
    { key: 'copy_min_performance_fee',        value: '0',      type: 'number',  category: 'permissions', description: 'Min performance fee %' },
    { key: 'copy_max_performance_fee',        value: '50',     type: 'number',  category: 'permissions', description: 'Max performance fee %' },
    { key: 'copy_lot_modes_allowed',          value: 'ratio,fixed,equity_pct,balance_ratio,risk_pct', type: 'string', category: 'permissions', description: 'Allowed lot sizing modes' },
  ];

  for (const s of settings) {
    await BrokerSetting.upsert(s);
  }
  console.log(`✓ ${settings.length} broker settings seeded`);

  // ── Roles ────────────────────────────────────────────────────────────────
  const roles = [
    { name: 'super_admin', description: 'Full platform access — all modules' },
    { name: 'admin',       description: 'Admin access' },
    { name: 'support',     description: 'Customer support agent' },
  ];
  for (const r of roles) {
    await Role.upsert(r);
  }
  console.log(`✓ ${roles.length} roles seeded`);

  // ── Admin User ───────────────────────────────────────────────────────────
  const ADMIN_EMAIL    = 'admin@trustfx.in';
  const ADMIN_PASSWORD = 'TrustFX@2024';

  const existing = await AdminUser.findOne({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    const superRole = await Role.findOne({ where: { name: 'super_admin' } });
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await AdminUser.create({
      email: ADMIN_EMAIL,
      password: hash,
      firstName: 'Admin',
      lastName: 'TrustFX',
      roleId: superRole.id,
      isActive: true,
    });
    console.log(`✓ Admin created → email: ${ADMIN_EMAIL}  password: ${ADMIN_PASSWORD}`);
  } else {
    console.log(`- Admin already exists: ${ADMIN_EMAIL}`);
  }

  console.log('\n✓ TrustFX DB initialized successfully.\n');
  await db.close();
}

run().catch(err => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
