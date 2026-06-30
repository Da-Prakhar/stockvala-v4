import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as supportController from '../controllers/support.controller.js';

const router = express.Router();

/**
 * Support routes
 */

router.post('/tickets', verifyToken, validate(schemas.createTicket), supportController.createTicket);
router.get('/tickets', verifyToken, supportController.getUserTickets);
router.get('/tickets/:ticketId', verifyToken, supportController.getTicketDetails);
router.put('/tickets/:ticketId', verifyToken, supportController.updateTicket);
router.post('/tickets/:ticketId/messages', verifyToken, validate(schemas.addMessage), supportController.addTicketMessage);
router.get('/tickets/:ticketId/messages', verifyToken, supportController.getTicketMessages);

export default router;
