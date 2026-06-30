import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as kycController from '../controllers/kyc.controller.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: (process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024 }
});

const router = express.Router();

router.get('/status', verifyToken, kycController.getKycStatus);
router.post('/upload', verifyToken, upload.fields([
  { name: 'idProofFront', maxCount: 1 },
  { name: 'idProofBack', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'bankStatement', maxCount: 1 }
]), kycController.uploadKycDocuments);

export default router;
