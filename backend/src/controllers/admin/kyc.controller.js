import { KycDocument, User, AuditLog } from '../../models/index.js';
import { NotFoundError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import emailService from '../../services/email.service.js';

export const getPendingKyc = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await KycDocument.findAndCountAll({
      where: { status: 'pending' },
      limit: parseInt(limit),
      offset,
      order: [['submittedAt', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'kycStatus'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Pending KYC retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getAllKyc = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    const { count, rows } = await KycDocument.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['submittedAt', 'DESC']],
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'kycStatus'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'KYC documents retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getKycDetails = async (req, res, next) => {
  try {
    const { kycId } = req.params;

    const kyc = await KycDocument.findByPk(kycId, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'kycStatus'] }
      ]
    });

    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    res.json(successResponse(kyc, 'KYC details retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get KYC stats (counts by status)
 */
export const getKycStats = async (req, res, next) => {
  try {
    const total = await KycDocument.count();
    const pending = await KycDocument.count({ where: { status: 'pending' } });
    const approved = await KycDocument.count({ where: { status: 'approved' } });
    const rejected = await KycDocument.count({ where: { status: 'rejected' } });

    res.json(successResponse({ total, pending, approved, rejected }, 'KYC stats retrieved'));
  } catch (error) {
    next(error);
  }
};

export const approveKyc = async (req, res, next) => {
  try {
    const { kycId } = req.params;
    const { notes } = req.body;

    const kyc = await KycDocument.findByPk(kycId, {
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
    });
    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    await kyc.update({
      status: 'approved',
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      notes: notes || null
    });

    // Update user KYC status — ENUM is: pending, approved, rejected, expired
    await User.update(
      { kycStatus: 'approved' },
      { where: { id: kyc.userId } }
    );

    // Audit log (non-blocking)
    try {
      await AuditLog.create({
        adminId: req.user.id,
        action: 'kyc_approved',
        entityType: 'KycDocument',
        entityId: kyc.id,
        details: { userId: kyc.userId }
      });
    } catch (e) { console.error('[Audit] KYC approve log failed:', e.message); }

    // Send email notification (non-blocking)
    if (kyc.User?.email) {
      emailService.sendKycApprovedEmail(kyc.User.email).catch(e =>
        console.error('[KYC] Approve email failed:', e.message)
      );
    }

    res.json(successResponse(kyc, 'KYC approved'));
  } catch (error) {
    next(error);
  }
};

export const rejectKyc = async (req, res, next) => {
  try {
    const { kycId } = req.params;
    // Accept both 'reason' and 'rejectionReason' from frontend
    const rejectionReason = req.body.rejectionReason || req.body.reason || '';

    const kyc = await KycDocument.findByPk(kycId, {
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
    });
    if (!kyc) {
      throw new NotFoundError('KYC document not found');
    }

    await kyc.update({
      status: 'rejected',
      rejectionReason,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });

    // Update user KYC status
    await User.update(
      { kycStatus: 'rejected' },
      { where: { id: kyc.userId } }
    );

    // Audit log (non-blocking)
    try {
      await AuditLog.create({
        adminId: req.user.id,
        action: 'kyc_rejected',
        entityType: 'KycDocument',
        entityId: kyc.id,
        details: { userId: kyc.userId, rejectionReason }
      });
    } catch (e) { console.error('[Audit] KYC reject log failed:', e.message); }

    // Send email notification (non-blocking)
    if (kyc.User?.email) {
      emailService.sendKycRejectedEmail(kyc.User.email, rejectionReason).catch(e =>
        console.error('[KYC] Reject email failed:', e.message)
      );
    }

    res.json(successResponse(kyc, 'KYC rejected'));
  } catch (error) {
    next(error);
  }
};

export default { getPendingKyc, getAllKyc, getKycDetails, getKycStats, approveKyc, rejectKyc };
