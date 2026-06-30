import { AdminUser, Role } from '../../models/index.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

export const getAllAdmins = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await AdminUser.findAndCountAll({
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: Role, attributes: ['name'] }],
      attributes: { exclude: ['password'] }
    });

    // Format for frontend
    const formattedAdmins = rows.map(admin => ({
      ...admin.toJSON(),
      name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Admin User',
      role: admin.Role ? admin.Role.name : 'Unknown Role',
      joined: admin.createdAt
    }));

    res.json(paginatedResponse(formattedAdmins, count, parseInt(page), parseInt(limit), 'Admins retrieved'));
  } catch (error) {
    next(error);
  }
};

export const createAdmin = async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;

    // Split name
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');

    // Find role by name
    const roleRecord = await Role.findOne({ where: { name: role } });
    if (!roleRecord) {
      throw new NotFoundError('Selected role not found');
    }

    const existing = await AdminUser.findOne({ where: { email } });
    if (existing) {
      throw new ConflictError('Admin user with this email already exists');
    }

    const admin = await AdminUser.create({
      firstName,
      lastName,
      email,
      password: password || 'Admin@123', // Default password if not provided
      roleId: roleRecord.id,
      isActive: true
    });

    const adminJson = admin.toJSON();
    delete adminJson.password;

    res.status(201).json(successResponse({
      ...adminJson,
      name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Admin User',
      role: roleRecord.name,
      joined: admin.createdAt
    }, 'Admin user created'));
  } catch (error) {
    next(error);
  }
};

export default { getAllAdmins, createAdmin };
