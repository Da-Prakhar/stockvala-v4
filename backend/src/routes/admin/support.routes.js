import express from 'express';
import * as supportController from '../../controllers/admin/support.controller.js';

const router = express.Router();

/**
 * Admin support management routes
 */

router.get('/', supportController.getAllTickets);
router.get('/:ticketId', supportController.getTicketDetails);
router.put('/:ticketId', supportController.updateTicket);
router.put('/:ticketId/assign', supportController.assignTicket);
router.post('/:ticketId/respond', supportController.respondToTicket);
router.put('/:ticketId/close', supportController.closeTicket);

export default router;
