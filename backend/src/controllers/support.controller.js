import { SupportTicket, SupportMessage } from '../models/index.js';
import { NotFoundError, BusinessError } from '../utils/errors.js';
import { successResponse, paginatedResponse } from '../utils/response.js';

export const createTicket = async (req, res, next) => {
  try {
    const { subject, category, description, priority } = req.validated.body;
    const ticket = await SupportTicket.create({
      userId: req.user.id,
      subject,
      category,
      priority: priority || 'medium',
      status: 'open'
    });

    // If description provided, create it as the first message on the ticket
    if (description) {
      await SupportMessage.create({
        ticketId: ticket.id,
        senderId: req.user.id,
        senderType: 'user',
        message: description
      });
    }

    res.status(201).json(successResponse(ticket, 'Ticket created'));
  } catch (error) {
    next(error);
  }
};

export const getUserTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await SupportTicket.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
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
        { model: SupportMessage, as: 'messages', order: [['createdAt', 'ASC']] }
      ]
    });

    if (!ticket || ticket.userId !== req.user.id) {
      throw new NotFoundError('Ticket not found');
    }

    res.json(successResponse(ticket, 'Ticket retrieved'));
  } catch (error) {
    next(error);
  }
};

export const updateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { status, priority } = req.body;

    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket || ticket.userId !== req.user.id) {
      throw new NotFoundError('Ticket not found');
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;

    await ticket.update(updates);

    res.json(successResponse(ticket, 'Ticket updated'));
  } catch (error) {
    next(error);
  }
};

export const addTicketMessage = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.validated.body;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket || ticket.userId !== req.user.id) {
      throw new NotFoundError('Ticket not found');
    }

    const msg = await SupportMessage.create({
      ticketId,
      senderId: req.user.id,
      senderType: 'user',
      message
    });

    res.status(201).json(successResponse(msg, 'Message added'));
  } catch (error) {
    next(error);
  }
};

export const getTicketMessages = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket || ticket.userId !== req.user.id) {
      throw new NotFoundError('Ticket not found');
    }

    const { count, rows } = await SupportMessage.findAndCountAll({
      where: { ticketId },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'ASC']]
    });

    res.json(paginatedResponse(rows, count, parseInt(page), parseInt(limit), 'Messages retrieved'));
  } catch (error) {
    next(error);
  }
};

export default { createTicket, getUserTickets, getTicketDetails, updateTicket, addTicketMessage, getTicketMessages };
