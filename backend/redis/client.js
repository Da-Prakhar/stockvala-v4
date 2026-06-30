/**
 * Singleton Redis client for the backend
 * Drop-in: import { redis, sub } from './redis/client.js'
 */
import Redis from 'ioredis';

const opts = {
  host:        process.env.REDIS_HOST     || '127.0.0.1',
  port:        parseInt(process.env.REDIS_PORT) || 6379,
  password:    process.env.REDIS_PASSWORD || undefined,
  username:    process.env.REDIS_USER     || undefined,
  tls:         process.env.REDIS_TLS === 'true' ? {} : undefined,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 3000),
};

// Main client — for get/set/hget etc.
export const redis = new Redis(opts);

// Subscriber client — dedicated connection for pub/sub
export const sub = new Redis(opts);

redis.on('error', err => console.error('[Redis] client error:', err.message));
sub.on('error',   err => console.error('[Redis] sub error:',    err.message));

export async function connectRedis() {
  await redis.connect();
  await sub.connect();
  console.log('[Redis] connected');
}

// ── Helpers ────────────────────────────────────────────────────────

// Get latest price for a symbol
export async function getPrice(symbol) {
  const raw = await redis.get(`price:${symbol}`);
  return raw ? JSON.parse(raw) : null;
}

// Get live positions for an account
export async function getPositions(accountId) {
  const raw = await redis.hget(`positions:${accountId}`, 'data');
  return raw ? JSON.parse(raw) : [];
}

// Write copy-trade follower relationship (called on follow/unfollow)
export async function setFollower(masterAccountId, followerAccountId, settings) {
  await redis.hset(
    `copy:master:${masterAccountId}:followers`,
    String(followerAccountId),
    JSON.stringify(settings)
  );
  await redis.sadd('copy:masters:active', String(masterAccountId));
}

export async function removeFollower(masterAccountId, followerAccountId) {
  await redis.hdel(`copy:master:${masterAccountId}:followers`, String(followerAccountId));
  const remaining = await redis.hlen(`copy:master:${masterAccountId}:followers`);
  if (remaining === 0) await redis.srem('copy:masters:active', String(masterAccountId));
}
