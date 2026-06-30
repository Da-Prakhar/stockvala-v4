// PM2 process manager config
// Usage: pm2 start pm2.config.js
module.exports = {
  apps: [
    {
      name:        'stockvala-backend',
      cwd:         '../../../stockvala-platform/packages/backend',
      script:      'src/index.js',
      instances:   'max',          // one per CPU core
      exec_mode:   'cluster',
      watch:       false,
      env: {
        NODE_ENV:         'production',
        REDIS_HOST:       process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT:       '6379',
        REDIS_PASSWORD:   process.env.REDIS_PASSWORD || '',
      },
    },
    {
      name:   'stockvala-copy-engine',
      cwd:    '../copy-trading',
      script: 'engine.js',
      instances: 1,        // single instance — owns the copy logic
      watch:  false,
      env: {
        NODE_ENV:         'production',
        MT5_SERVER:       process.env.MT5_SERVER,
        MT5_PORT:         process.env.MT5_PORT || '443',
        MT5_LOGIN:        process.env.MT5_LOGIN,
        MT5_PASSWORD:     process.env.MT5_PASSWORD,
        REDIS_HOST:       process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT:       '6379',
        REDIS_PASS:       process.env.REDIS_PASSWORD || '',
      },
    },
  ],
};
