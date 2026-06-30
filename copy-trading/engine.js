const Redis          = require('ioredis');
const config         = require('./config');
const MasterMonitor  = require('./masterMonitor');
const FollowerExecutor = require('./followerExecutor');
const RiskGuard      = require('./riskGuard');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

// Separate client for pub/sub (ioredis requirement)
const redisSub = redis.duplicate();

async function main() {
  console.log('[Engine] Starting copy trading engine...');

  const monitor  = new MasterMonitor(redisSub);
  const executor = new FollowerExecutor(redis);
  const guard    = new RiskGuard(redis);

  await monitor.connect();
  await executor.connect();

  monitor.on('position:open', async (master, position) => {
    const followers = await getActiveFollowers(master.accountId);
    for (const follower of followers) {
      const safe = await guard.check(follower, executor.mt5);
      if (safe) await executor.copyOpen(follower, position);
    }
  });

  monitor.on('position:close', async (master, position) => {
    const followers = await getActiveFollowers(master.accountId);
    for (const follower of followers) {
      await executor.copyClose(follower, position);
    }
  });

  monitor.startPolling();
  console.log('[Engine] Copy trading LIVE');
}

async function getActiveFollowers(masterAccountId) {
  const raw = await redis.hgetall(`copy:master:${masterAccountId}:followers`);
  if (!raw) return [];
  return Object.entries(raw).map(([accountId, json]) => ({
    accountId: parseInt(accountId),
    ...JSON.parse(json),
  }));
}

main().catch(err => {
  console.error('[Engine] Fatal:', err);
  process.exit(1);
});
