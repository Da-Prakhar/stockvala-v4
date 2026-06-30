import { SupportTicket, SupportMessage, User } from '../../models/index.js';
import { NotFoundError, BusinessError } from '../../utils/errors.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

export const getAllTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, priority } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const { count, rows } = await SupportTicket.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Tickets retrieved'));
  } catch (error) {
    next(error);
  }
};

export const getTicketDetails = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findByPk(ticketId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: SupportMessage, as: 'messages', order: [['createdAt', 'ASC']] }
      ]
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    res.json(successResponse(ticket, 'Ticket details retrieved'));
  } catch (error) {
    next(error);
  }
};

export const assignTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { assignedTo, status } = req.body;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const updates = {};
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (status !== undefined) updates.status = status;

    await ticket.update(updates);

    res.json(successResponse(ticket, 'Ticket assigned'));
  } catch (error) {
    next(error);
  }
};

export const closeTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new BusinessError('Ticket is already closed');
    }

    await ticket.update({
      status: 'closed',
      resolution,
      closedAt: new Date(),
      closedBy: req.user.id
    });

    res.json(successResponse(ticket, 'Ticket closed'));
  } catch (error) {
    next(error);
  }
};

export const respondToTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new BusinessError('Cannot respond to closed ticket');
    }

    const response = await SupportMessage.create({
      ticketId,
      senderId: req.user.id,
      senderType: 'admin',
      message
    });

    // Update ticket status to in_progress if it's open
    if (ticket.status === 'open') {
      await ticket.update({ status: 'in_progress' });
    }

    res.status(201).json(successResponse(response, 'Response added'));
  } catch (error) {
    next(error);
  }
};

export const updateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { status, priority, assignedTo } = req.body;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;

    // Handle closure via status update if necessary
    if (status === 'closed' && ticket.status !== 'closed') {
      updates.closedAt = new Date();
      updates.closedBy = req.user.id;
    }

    await ticket.update(updates);

    res.json(successResponse(ticket, 'Ticket updated'));
  } catch (error) {
    next(error);
  }
};

export default { getAllTickets, getTicketDetails, assignTicket, closeTicket, respondToTicket, updateTicket };
