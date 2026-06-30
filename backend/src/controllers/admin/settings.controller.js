import { BrokerSetting } from '../../models/index.js';
import { NotFoundError, BusinessError, ConflictError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { reloadConfigFromDB as reloadMT5Config } from '../../services/mt5.service.js';
import { invalidatePermissionsCache } from '../../utils/brokerPermissions.js';

export const getAllSettings = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await BrokerSetting.findAndCountAll({
      limit: parseInt(limit),
      offset,
      order: [['key', 'ASC']]
    });

    // Format for easy access
    const formatted = {};
    rows.forEach(s => {
      formatted[s.key] = s.value;
    });

    res.json(successResponse({
      settings: formatted,
      list: rows,
      total: count
    }, 'Settings retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getSetting = async (req, res, next) => {
  try {
    const { key } = req.params;

    const setting = await BrokerSetting.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundError('Setting not found');
    }

    res.json(successResponse(setting, 'Setting retrieved'));
  } catch (error) {
    next(error);
  }
};

export const createSetting = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;

    if (!key) {
      throw new BusinessError('Key is required');
    }

    // Check if setting already exists
    const existing = await BrokerSetting.findOne({ where: { key } });
    if (existing) {
      throw new ConflictError('Setting already exists');
    }

    const setting = await BrokerSetting.create({
      key,
      value,
      description
    });

    res.status(201).json(successResponse(setting, 'Setting created'));
  } catch (error) {
    next(error);
  }
};

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    // If body has no 'value' field but has other keys, treat as bulk upsert for this category
    if (value === undefined && Object.keys(req.body).length > 0) {
      req.body = { settings: req.body, category: key };
      return bulkUpsertSettings(req, res, next);
    }

    const setting = await BrokerSetting.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundError('Setting not found');
    }

    const updates = {};
    if (value !== undefined) updates.value = value;
    if (description !== undefined) updates.description = description;

    await setting.update(updates);

    res.json(successResponse(setting, 'Setting updated'));
  } catch (error) {
    next(error);
  }
};

export const deleteSetting = async (req, res, next) => {
  try {
    const { key } = req.params;

    const setting = await BrokerSetting.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundError('Setting not found');
    }

    // Prevent deletion of critical settings
    const criticalSettings = ['platform_name', 'min_deposit', 'max_deposit'];
    if (criticalSettings.includes(key)) {
      throw new BusinessError('Cannot delete critical settings');
    }

    await setting.destroy();

    res.json(successResponse(null, 'Setting deleted'));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET SETTINGS BY CATEGORY
// ============================================================================

export const getSettingsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;

    let rows = await BrokerSetting.findAll({
      where: { category },
      order: [['key', 'ASC']]
    });

    // If category is 'company', also fetch keys that might be under 'branding' or 'general'
    if (category === 'company') {
      const extraKeys = ['companyName', 'email', 'phone', 'address', 'facebook', 'twitter', 'linkedin', 'instagram', 'footerText', 'disclaimer', 'logoUrl', 'faviconUrl', 'platform_name'];
      const existingKeys = rows.map(r => r.key);
      const neededKeys = extraKeys.filter(k => !existingKeys.includes(k));
      if (neededKeys.length > 0) {
        const extraRows = await BrokerSetting.findAll({
          where: { key: neededKeys }
        });
        rows = rows.concat(extraRows);
      }
    }

    const formatted = {};
    rows.forEach(s => {
      // Parse JSON values automatically
      if (s.type === 'json') {
        try { formatted[s.key] = JSON.parse(s.value); } catch { formatted[s.key] = s.value; }
      } else if (s.type === 'number') {
        formatted[s.key] = parseFloat(s.value) || 0;
      } else if (s.type === 'boolean') {
        formatted[s.key] = s.value === 'true';
      } else {
        formatted[s.key] = s.value;
      }
    });

    // If companyName wasn't found anywhere, fall back to platform_name
    if (category === 'company' && !formatted.companyName && formatted.platform_name) {
      formatted.companyName = formatted.platform_name;
    }

    res.json(successResponse({ settings: formatted, list: rows }, `${category} settings retrieved`));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// BULK UPSERT SETTINGS
// ============================================================================

/**
 * Upsert multiple settings at once.
 * Body: { settings: { key1: value1, key2: value2, ... }, category: 'mt5' }
 */
export const bulkUpsertSettings = async (req, res, next) => {
  try {
    const { settings, category } = req.body;

    if (!settings || typeof settings !== 'object') {
      throw new BusinessError('settings object is required');
    }

    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null) continue;

      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const type = typeof value === 'object' ? 'json'
        : typeof value === 'number' ? 'number'
        : typeof value === 'boolean' ? 'boolean'
        : 'string';

      const existing = await BrokerSetting.findOne({ where: { key } });
      if (existing) {
        await existing.update({ value: stringValue, type, category: category || existing.category });
        results.push({ key, action: 'updated' });
      } else {
        await BrokerSetting.create({
          key,
          value: stringValue,
          type,
          category: category || 'general',
          description: `Auto-created via bulk upsert`
        });
        results.push({ key, action: 'created' });
      }
    }

    // Auto-reload MT5 service config when mt5 category is saved
    if (category === 'mt5') {
      try {
        await reloadMT5Config();
        console.log('[Settings] MT5 config reloaded after bulk upsert');
      } catch (e) {
        console.warn('[Settings] Failed to reload MT5 config:', e.message);
      }
    }

    // Invalidate permissions cache when permissions category is saved
    if (category === 'permissions') {
      invalidatePermissionsCache();
      console.log('[Settings] Permissions cache invalidated');
    }

    res.json(successResponse({ results, count: results.length }, `${results.length} settings saved`));
  } catch (error) {
    next(error);
  }
};

export const uploadCompanyImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BusinessError('No file uploaded');
    }
    // Return relative URL that the frontend can build via getUploadUrl
    const fileUrl = `/uploads/${req.query.type || 'general'}/${req.file.filename}`;
    res.json(successResponse({ url: fileUrl }, 'File uploaded successfully'));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// TEST EMAIL
// ============================================================================
export const testEmail = async (req, res, next) => {
  try {
    const emailService = (await import('../../services/email.service.js')).default;

    // Get admin email from JWT or first admin user
    const adminEmail = req.user?.email;
    if (!adminEmail) {
      throw new BusinessError('Could not determine admin email');
    }

    await emailService.sendWelcomeEmail(adminEmail);
    res.json(successResponse(null, `Test email sent to ${adminEmail}`));
  } catch (error) {
    next(error);
  }
};

export default {
  getAllSettings, getSetting, createSetting, updateSetting, deleteSetting,
  getSettingsByCategory, bulkUpsertSettings, uploadCompanyImage, testEmail
};
