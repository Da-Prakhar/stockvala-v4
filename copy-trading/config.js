module.exports = {
  mt5: {
    server:   process.env.MT5_SERVER   || '127.0.0.1',
    port:     process.env.MT5_PORT     || 443,
    login:    process.env.MT5_LOGIN    || 'manager_login',
    password: process.env.MT5_PASSWORD || 'manager_password',
  },
  redis: {
    host:     process.env.REDIS_HOST   || '127.0.0.1',
    port:     process.env.REDIS_PORT   || 6379,
    password: process.env.REDIS_PASS   || undefined,
  },
  // How often to poll master positions (ms) — lower = faster copy
  pollInterval: 500,
};
