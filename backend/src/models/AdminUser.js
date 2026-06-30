import { DataTypes } from 'sequelize';
import bcryptjs from 'bcryptjs';
import db from '../config/database.js';

/**
 * AdminUser model
 * DB columns: id, email, password_hash, first_name, last_name, role_id, is_active, last_login, created_at, updated_at
 */
const AdminUser = db.define('AdminUser', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'last_name'
  },
  roleId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'role_id',
    references: {
      model: 'roles',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  status: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('isActive') ? 'active' : 'inactive';
    }
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'admin_users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        admin.password = await bcryptjs.hash(admin.password, 10);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcryptjs.hash(admin.password, 10);
      }
    }
  }
});

/**
 * Compare password method
 */
AdminUser.prototype.comparePassword = async function(password) {
  return bcryptjs.compare(password, this.password);
};

export default AdminUser;
