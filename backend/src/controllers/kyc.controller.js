import { KycDocument, User } from '../models/index.js';
import { successResponse } from '../utils/response.js';

export const getKycStatus = async (req, res, next) => {
  try {
    let kyc = await KycDocument.findOne({ where: { userId: req.user.id } });

    if (!kyc) {
      return res.json(successResponse({ status: 'not-submitted' }, 'KYC status retrieved'));
    }

    res.json(successResponse(kyc, 'KYC status retrieved'));
  } catch (error) {
    next(error);
  }
};

export const uploadKycDocuments = async (req, res, next) => {
  try {
    const files = req.files || {};

    let kyc = await KycDocument.findOne({ where: { userId: req.user.id } });

    const updateData = {
      status: 'pending',
      submittedAt: new Date(),
      rejectionReason: null  // Clear previous rejection reason on resubmit
    };

    // Document type & number from form
    if (req.body.documentType) updateData.documentType = req.body.documentType;
    if (req.body.documentNumber) updateData.documentNumber = req.body.documentNumber;

    // Map uploaded files to model fields
    if (files.idProofFront) updateData.frontImage = files.idProofFront[0].filename;
    if (files.idProofBack) updateData.backImage = files.idProofBack[0].filename;
    if (files.addressProof) updateData.addressProof = files.addressProof[0].filename;
    if (files.selfie) updateData.selfieImage = files.selfie[0].filename;
    if (files.bankStatement) updateData.bankStatement = files.bankStatement[0].filename;

    if (!kyc) {
      updateData.userId = req.user.id;
      kyc = await KycDocument.create(updateData);
    } else {
      await kyc.update(updateData);
    }

    // Also update user kycStatus to pending
    await User.update({ kycStatus: 'pending' }, { where: { id: req.user.id } });

    res.json(successResponse(kyc, 'KYC documents uploaded successfully'));
  } catch (error) {
    next(error);
  }
};

export default { getKycStatus, uploadKycDocuments };
