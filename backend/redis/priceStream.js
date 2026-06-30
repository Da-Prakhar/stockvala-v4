/**
 * Bridges Redis pub/sub → Socket.IO
 * Replaces the V1 price polling from Python Flask bridge
 *
 * Usage: import { startPriceStream } from './redis/priceStream.js'
 *        startPriceStream(io)
 */
import { sub } from './client.js';

export function startPriceStream(io) {
  // Subscribe to all symbol tick channels
  sub.psubscribe('tick:*', (err) => {
    if (err) console.error('[PriceStream] psubscribe error:', err.message);
    else console.log('[PriceStream] subscribed to tick:* channels');
  });

  sub.on('pmessage', (_pattern, channel, message) => {
    // channel = "tick:EURUSD"  message = {"bid":1.1,"ask":1.1001,"t":...}
    const symbol = channel.split(':')[1];

    // Broadcast to all clients watching this symbol
    io.to(`price:${symbol}`).emit('price_update', {
      symbol,
      ...JSON.parse(message),
    });
  });

  // Account-level events (position open/close, balance change)
  sub.psubscribe('account:*', (err) => {
    if (err) console.error('[PriceStream] account subscribe error:', err.message);
  });

  sub.on('pmessage', (_pattern, channel, message) => {
    // channel = "account:12345:position:open"
    const parts   = channel.split(':');
    const acctId  = parts[1];
    const evtType = parts.slice(2).join(':');

    io.to(`account:${acctId}`).emit(evtType, JSON.parse(message));
  });

  console.log('[PriceStream] live — prices now flow Redis → Socket.IO');
}
