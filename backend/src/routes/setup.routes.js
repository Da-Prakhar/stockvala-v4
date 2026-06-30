import { Router } from 'express';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const router = Router();

// One-time setup endpoint - creates tables and admin user
// DELETE THIS FILE AFTER FIRST USE FOR SECURITY
router.get('/init-db', async (req, res) => {
  try {
    // Sync all models (creates tables if not exist)
    await sequelize.sync({ alter: false });

    // Import models after sync
    const { default: Role } = await import('../models/Role.js');
    const { default: AdminUser } = await import('../models/AdminUser.js');

    // Ensure "Super Admin" role exists
    let role = await Role.findOne({ where: { name: 'Super Admin' } });
    if (!role) {
      role = await Role.create({
        name: 'Super Admin',
        description: 'Full system access',
        permissionIds: []
      });
    }

    // Check if admin user exists
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const adminExists = await AdminUser.findOne({ where: { email: adminEmail } });

    if (!adminExists) {
      await AdminUser.create({
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        firstName: 'Admin',
        lastName: 'User',
        roleId: role.id,
        isActive: true
      });

      return res.json({
        success: true,
        message: 'Database tables created, role and admin user seeded.',
        admin_email: adminEmail
      });
    }

    return res.json({
      success: true,
      message: 'Database tables synced. Admin already exists.',
      admin_email: adminExists.email
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Debug: verify admin login works + reset password if needed
router.get('/verify-admin', async (req, res) => {
  try {
    const { default: AdminUser } = await import('../models/AdminUser.js');
    const { default: Role } = await import('../models/Role.js');
    const bcrypt = await import('bcryptjs');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const admin = await AdminUser.findOne({ where: { email: adminEmail } });

    if (!admin) {
      return res.json({ success: false, message: 'Admin not found' });
    }

    const rawPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const passwordMatch = await bcrypt.default.compare(rawPassword, admin.password);

    return res.json({
      success: true,
      admin_email: admin.email,
      admin_id: admin.id,
      roleId: admin.roleId,
      isActive: admin.isActive,
      password_hash_length: admin.password?.length,
      password_match: passwordMatch,
      password_starts_with_dollar: admin.password?.startsWith('$'),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Reset admin password if hash is broken
router.get('/reset-admin-password', async (req, res) => {
  try {
    const { default: AdminUser } = await import('../models/AdminUser.js');
    const bcrypt = await import('bcryptjs');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const admin = await AdminUser.findOne({ where: { email: adminEmail } });

    if (!admin) {
      return res.json({ success: false, message: 'Admin not found' });
    }

    const rawPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const newHash = await bcrypt.default.hash(rawPassword, 10);

    // Use raw query to avoid double-hashing by beforeUpdate hook
    await AdminUser.sequelize.query(
      'UPDATE admin_users SET password_hash = ? WHERE id = ?',
      { replacements: [newHash, admin.id] }
    );

    // Verify it works
    const updated = await AdminUser.findByPk(admin.id);
    const nowMatches = await bcrypt.default.compare(rawPassword, updated.password);

    return res.json({
      success: true,
      message: 'Password reset done',
      password_now_matches: nowMatches,
      admin_email: admin.email
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Force sync all tables with ALTER (fixes missing columns/tables)
router.get('/force-sync', async (req, res) => {
  try {
    await sequelize.sync({ alter: true });
    return res.json({ success: true, message: 'All tables synced with ALTER. Missing columns/tables created.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: dump all settings
router.get('/dump-settings', async (req, res) => {
  try {
    const { BrokerSetting } = await import('../models/index.js');
    const settings = await BrokerSetting.findAll();
    return res.json({ success: true, count: settings.length, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Test the EXACT login flow end-to-end (same code as adminLogin controller)
router.get('/test-login', async (req, res) => {
  try {
    const { AdminUser, Role } = await import('../models/index.js');
    const bcrypt = await import('bcryptjs');

    const email = (req.query.email || process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const password = req.query.password || process.env.ADMIN_PASSWORD || 'Admin@123';

    // Step 1: Find admin with Role include (same as controller)
    const admin = await AdminUser.findOne({
      where: { email },
      include: [{ model: Role }]
    });

    if (!admin) {
      return res.json({ step: 'findOne', result: 'NOT_FOUND', email });
    }

    // Step 2: Check active
    if (!admin.isActive) {
      return res.json({ step: 'isActive', result: 'INACTIVE' });
    }

    // Step 3: Compare password using model method
    const isValid = await admin.comparePassword(password);

    // Step 4: Also compare directly
    const directCompare = await bcrypt.default.compare(password, admin.password);

    return res.json({
      step: 'complete',
      email: admin.email,
      isActive: admin.isActive,
      roleFound: !!admin.Role,
      roleName: admin.Role?.name,
      comparePassword_result: isValid,
      directBcrypt_result: directCompare,
      passwordField: admin.password?.substring(0, 10) + '...',
      passwordLength: admin.password?.length,
      inputPassword: password,
    });
  } catch (error) {
    return res.status(500).json({ step: 'ERROR', error: error.message, stack: error.stack });
  }
});

export default router;
