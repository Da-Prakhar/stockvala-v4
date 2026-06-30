import { Role, Permission } from '../../models/index.js';
import { NotFoundError, BusinessError, ConflictError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

export const getAllRoles = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Role.findAndCountAll({
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Roles retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getRoleDetails = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findByPk(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    res.json(successResponse(role, 'Role details retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getAvailablePermissions = async (req, res, next) => {
  try {
    const permissions = [
      { id: 'view_dashboard', name: 'View Dashboard', category: 'General' },
      { id: 'view_clients', name: 'View Clients', category: 'Clients' },
      { id: 'manage_clients', name: 'Manage Clients', category: 'Clients' },
      { id: 'manage_deposits', name: 'Manage Deposits', category: 'Finance' },
      { id: 'manage_withdrawals', name: 'Manage Withdrawals', category: 'Finance' },
      { id: 'manage_kyc', name: 'Manage KYC', category: 'Compliance' },
      { id: 'manage_settings', name: 'Manage Settings', category: 'System' },
      { id: 'manage_roles', name: 'Manage Roles & Admins', category: 'System' },
      { id: 'manage_support', name: 'Manage Support Tickets', category: 'Support' }
    ];
    res.json(successResponse(permissions, 'Available permissions retrieved'));
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const { name, description, permissionIds } = req.body;

    // Check if role already exists
    const existing = await Role.findOne({ where: { name } });
    if (existing) {
      throw new ConflictError('Role already exists');
    }

    const role = await Role.create({
      name,
      description,
      permissionIds: permissionIds || []
    });

    res.status(201).json(successResponse(role, 'Role created'));
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await Role.findByPk(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    await role.update({ 
      name, 
      description,
      permissionIds: permissionIds || role.permissionIds 
    });

    res.json(successResponse(role, 'Role updated'));
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findByPk(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Prevent deletion of system roles
    if (['admin', 'super admin', 'user', 'support'].includes(role.name?.toLowerCase())) {
      throw new BusinessError('Cannot delete system roles');
    }

    await role.destroy();

    res.json(successResponse(null, 'Role deleted'));
  } catch (error) {
    next(error);
  }
};

export default { getAllRoles, getRoleDetails, getAvailablePermissions, createRole, updateRole, deleteRole };
