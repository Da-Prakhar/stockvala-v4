/**
 * Socket.IO configuration — V2
 *
 * Changes vs V1:
 *   • Clients can join price:{symbol} rooms → receive live ticks from C# Gateway via Redis
 *   • Clients can join account:{login} rooms → receive live position events
 *   • startPriceStream(io) wires Redis pub/sub → Socket.IO (called from index.js)
 */

import jwt from 'jsonwebtoken';

const setupSocket = (io) => {
  const connectedUsers = new Map();

  // ── Auth middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: Token missing'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id, 'User:', socket.user?.id);

    // Auto-join personal user room
    if (socket.user?.id) {
      const userId = socket.user.id.toString();
      connectedUsers.set(socket.id, userId);
      socket.join(`user:${userId}`);
      socket.broadcast.emit('user:status', { userId, status: 'online', timestamp: new Date() });
      console.log(`User ${userId} joined room user:${userId}`);
    }

    // ── V2: price streaming rooms ────────────────────────────────
    // Client sends: socket.emit('price:subscribe', ['EURUSD', 'XAUUSD'])
    socket.on('price:subscribe', (symbols) => {
      if (!Array.isArray(symbols)) symbols = [symbols];
      symbols.forEach(sym => {
        socket.join(`price:${sym}`);
        console.log(`[Socket] ${socket.id} subscribed to price:${sym}`);
      });
    });

    socket.on('price:unsubscribe', (symbols) => {
      if (!Array.isArray(symbols)) symbols = [symbols];
      symbols.forEach(sym => socket.leave(`price:${sym}`));
    });

    // ── V2: account live-position room ───────────────────────────
    // Client sends: socket.emit('account:subscribe', mt5Login)
    socket.on('account:subscribe', (mt5Login) => {
      socket.join(`account:${mt5Login}`);
      console.log(`[Socket] ${socket.id} subscribed to account:${mt5Login}`);
    });

    socket.on('account:unsubscribe', (mt5Login) => {
      socket.leave(`account:${mt5Login}`);
    });

    // ── Standard events (same as V1) ─────────────────────────────
    socket.on('trade:update', (data) => {
      io.to(`user:${data.userId}`).emit('trade:updated', data);
    });

    socket.on('position:update', (data) => {
      io.to(`user:${data.userId}`).emit('position:updated', data);
    });

    socket.on('order:update', (data) => {
      io.to(`user:${data.userId}`).emit('order:updated', data);
    });

    socket.on('notification:send', (data) => {
      io.to(`user:${data.userId}`).emit('notification:received', data);
    });

    socket.on('price:tick', (data) => {
      io.emit('price:updated', data);
    });

    socket.on('support:message', (data) => {
      io.to(`ticket:${data.ticketId}`).emit('support:new-message', data);
    });

    socket.on('disconnect', () => {
      const userId = connectedUsers.get(socket.id);
      if (userId) {
        connectedUsers.delete(socket.id);
        io.emit('user:status', { userId, status: 'offline', timestamp: new Date() });
        console.log(`User ${userId} disconnected`);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

export default setupSocket;
