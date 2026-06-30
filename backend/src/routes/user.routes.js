import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

// All user routes require authentication
router.use(verifyToken);

// Inline schemas (kept here so validate.js stays clean)
const updateProfileSchema = Joi.object({
  body: Joi.object({
    firstName:         Joi.string().min(1).max(100).optional(),
    lastName:          Joi.string().min(1).max(100).optional(),
    phone:             Joi.string().allow('', null).optional(),
    country:           Joi.string().allow('', null).optional(),
    city:              Joi.string().allow('', null).optional(),
    twoFactorEnabled:  Joi.boolean().optional(),
  }).min(1),   // at least one field required
});

const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword:     Joi.string().min(8).required(),
  }),
});

/**
 * GET  /users/me      — full profile (user + UserProfile)
 * PUT  /users/profile — update name / phone / country / city / 2FA
 * PUT  /users/change-password — change password
 */
router.get('/me',              userController.getProfile);
router.put('/profile',         validate(updateProfileSchema), userController.updateProfile);
router.put('/change-password', validate(changePasswordSchema), userController.changePassword);

export default router;
