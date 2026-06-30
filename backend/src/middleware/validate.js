import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';

/**
 * Request validation middleware using Joi
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @returns {Function} Middleware function
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      console.log(`[Validate] ${req.method} ${req.path} body:`, JSON.stringify(req.body));
      const { error, value } = schema.validate({
        body: req.body,
        query: req.query,
        params: req.params
      }, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        console.log(`[Validate] FAILED:`, error.details.map(d => d.message).join(', '));
        const messages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        throw new ValidationError('Validation failed', messages);
      }

      req.validated = value;
      next();
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message || 'Validation failed',
        errors: err.details || []
      });
    }
  };
};

/**
 * Common validation schemas
 */
export const schemas = {
  // Auth
  register: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      referralCode: Joi.string().optional()
    })
  }),

  login: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    })
  }),

  refreshToken: Joi.object({
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  }),

  forgotPassword: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required()
    })
  }),

  resetPassword: Joi.object({
    body: Joi.object({
      token: Joi.string().required(),
      password: Joi.string().min(8).required()
    })
  }),

  // Account
  createAccount: Joi.object({
    body: Joi.object({
      accountType: Joi.string().valid('live', 'demo', 'cent', 'copy_trading').required(),
      leverage: Joi.number().min(1).max(1000).required(),
      market: Joi.string().valid('forex', 'forex_crypto', 'comex', 'mcx', 'nse', 'mcx_nse').optional().default('forex'),
      group: Joi.string().optional(),
      initialDeposit: Joi.number().min(0).optional(),
      masterTraderId: Joi.number().optional(),
      copyRatio: Joi.number().min(0.01).max(10).optional().default(1),
      allocationAmount: Joi.number().min(0).optional()
    })
  }),

  updateLeverage: Joi.object({
    params: Joi.object({
      id: Joi.number().required()
    }),
    body: Joi.object({
      leverage: Joi.number().min(1).max(1000).required()
    })
  }),

  // Fund
  createDeposit: Joi.object({
    body: Joi.object({
      amount: Joi.number().min(1).required(),
      paymentMethodId: Joi.number().required(),
      mt5AccountId: Joi.number().optional().allow(null),
      transactionRef: Joi.string().optional().allow(null, ''),
    })
  }),

  createWithdrawal: Joi.object({
    body: Joi.object({
      amount: Joi.number().min(1).required(),
      paymentMethodId: Joi.number().required(),
      mt5AccountId: Joi.number().optional().allow(null),
      withdrawalDetails: Joi.object().optional().allow(null),
    })
  }),

  // Support
  createTicket: Joi.object({
    body: Joi.object({
      subject: Joi.string().required(),
      category: Joi.string().optional(),
      description: Joi.string().optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional()
    })
  }),

  addMessage: Joi.object({
    params: Joi.object({
      ticketId: Joi.number().required()
    }),
    body: Joi.object({
      message: Joi.string().required()
    })
  })
};

export default validate;
