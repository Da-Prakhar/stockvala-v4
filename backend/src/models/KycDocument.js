import { DataTypes } from 'sequelize';
import db from '../config/database.js';

/**
 * KycDocument model
 */
const KycDocument = db.define('KycDocument', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  documentType: {
    type: DataTypes.ENUM('passport', 'national_id', 'driving_license', 'drivers_license', 'voter_id', 'residence_permit'),
    allowNull: true
  },
  documentNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  issueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  issueCountry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  frontImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bankStatement: {
    type: DataTypes.STRING,
    allowNull: true
  },
  backImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  selfieImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  addressProof: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
    defaultValue: 'pending'
  },
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'admin_users',
      key: 'id'
    }
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'kyc_documents',
  timestamps: true,
  underscored: true
});

export default KycDocument;
