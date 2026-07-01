import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env relative to this file — always points to the correct app's .env
dotenv.config({ path: resolve(__dirname, '../.env'), override: true });

console.log('[ENV] DB_NAME=' + process.env.DB_NAME);
console.log('[ENV] COPY_ENGINE_ENABLED=' + process.env.COPY_ENGINE_ENABLED);
console.log('[ENV] MAM_ENGINE_ENABLED=' + process.env.MAM_ENGINE_ENABLED);
console.log('[ENV] PAMM_ENGINE_ENABLED=' + process.env.PAMM_ENGINE_ENABLED);
console.log('[ENV] NODE_ENV=' + process.env.NODE_ENV);
console.log('[ENV] REDIS_HOST=' + (process.env.REDIS_HOST || '127.0.0.1'));

// Ensure upload directories exist
const appRoot = resolve(__dirname, '..');
const uploadDirs = ['uploads', 'uploads/proofs', 'uploads/kyc', 'uploads/general', 'uploads/qr'];
for (const dir of uploadDirs) {
  for (const base of [appRoot, process.cwd()]) {
    const fullPath = resolve(base, dir);
    if (!fs.existsSync(fullPath)) {
      try { fs.mkdirSync(fullPath, { recursive: true }); } catch (e) { /* ignore */ }
    }
  }
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server } from 'socket.io';
import http from 'http';
import rateLimit from 'express-rate-limit';
import db from './config/database.js';
import setupSocket from './config/socket.js';
import routes from './routes/index.js';
import { globalErrorHandler } from './utils/errors.js';
import { connectRedis } from './redis/client.js';
import { startPriceStream } from './redis/priceStream.js';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    // When CORS_ORIGINS=* (or unset) reflect any origin — required because
    // Socket.IO with credentials:true rejects the literal '*' string.
    // When specific origins are listed (comma-separated), only allow those.
    origin: (() => {
      const raw = process.env.CORS_ORIGINS || '*';
      if (raw === '*') return (origin, cb) => cb(null, true);
      const list = raw.split(',').map(s => s.trim()).filter(Boolean);
      return (origin, cb) => {
        if (!origin || list.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      };
    })(),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5006;  // V2 runs on 5006 (V1 is on 5005)
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log(`[Startup] Port=${PORT} | Node=${process.version} | ENV=${NODE_ENV}`);
console.log(`[Startup] CWD=${process.cwd()} | __dirname=${__dirname}`);

// Middleware — CORS must come before everything else
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.options('*', cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

if (NODE_ENV === 'production') {
  // Strict limit for auth endpoints only — prevents brute-force login attacks.
  // Keep max low (20 per 15 min) so attackers can't cycle passwords quickly.
  app.use(['/api/auth/login', '/api/auth/register'], rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts, please wait 15 minutes.' }
  }));

  // Generous limit for all other API routes.
  // Trading apps make 10-50 req/s per user (tick polling, position updates, etc.).
  // With Socket.IO active this drops to near zero, but keep ceiling high for safety.
  // 500,000 / 15 min per IP = ~555 req/s — well above any legitimate user's need.
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500000,
    message: { success: false, message: 'Too many requests, try again later.' },
    skip: (req) => !!req.headers.authorization,   // skip entirely for authenticated requests
  }));
}

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(resolve(appRoot, 'uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 'v2', timestamp: new Date().toISOString(), port: PORT, node: process.version });
});

// One-time setup route
import setupRoutes from './routes/setup.routes.js';
app.use('/setup', setupRoutes);

// API Routes
app.use('/api/', routes);

// ── Static file serving (production / VPS only) ───────────────────────────
// In dev, Vite dev servers handle this with HMR + proxy.
// In production, the backend serves built dist files with SPA fallback.
if (NODE_ENV === 'production') {
  const findDist = (...candidates) => candidates.find(p => fs.existsSync(p));

  const brokerDist = findDist(
    resolve(appRoot, '..', 'admin', 'dist'),                                              // V2 admin (primary)
    resolve(appRoot, '..', '..', 'stockvala-platform', 'packages', 'broker-crm', 'dist'), // legacy fallback
    resolve(appRoot, '..', 'broker-crm', 'dist'),
  );
  const userDist = findDist(
    resolve(appRoot, '..', 'frontend', 'dist'),
    resolve(appRoot, 'public'),
  );

  if (brokerDist) {
    console.log(`[Static] Broker CRM: ${brokerDist}`);
    app.use('/broker', express.static(brokerDist, { index: false }));
    app.get('/broker', (_req, res) => res.sendFile(resolve(brokerDist, 'index.html')));
    app.get('/broker/*', (_req, res) => res.sendFile(resolve(brokerDist, 'index.html')));
  }

  if (userDist) {
    console.log(`[Static] User portal: ${userDist}`);
    app.use(express.static(userDist, { index: false }));
    app.get('*', (_req, res) => res.sendFile(resolve(userDist, 'index.html')));
  }
}

if (NODE_ENV !== 'production') {
  app.get('/', (_req, res) => res.json({ status: 'ok', version: 'v2', env: NODE_ENV }));
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

app.use(globalErrorHandler);

setupSocket(io);

// ─── Start server ───
const startServer = async () => {
  try {
    // ── Connect Redis — price stream runs regardless (gateway polling fallback) ──
    try {
      await connectRedis();
    } catch (redisErr) {
      console.warn('[Redis] Could not connect:', redisErr.message);
    }
    try {
      startPriceStream(io);   // Wire Redis pub/sub → Socket.IO rooms (+ gateway polling fallback)
      console.log('[Redis] Price stream started (gateway polling fallback).');
    } catch (streamErr) {
      console.warn('[Redis] Price stream error:', streamErr.message);
    }

    await db.authenticate();
    console.log('DB connected.');

    await import('./models/index.js');

    // ─── Pre-sync cleanup: remove duplicates ───

    // 1. Deduplicate copy_trade_followers
    try {
      const [dupeFollowers] = await db.query(`
        SELECT master_id, follower_mt5_account_id, COUNT(*) AS cnt
        FROM copy_trade_followers
        GROUP BY master_id, follower_mt5_account_id
        HAVING cnt > 1
      `);
      if (dupeFollowers.length > 0) {
        console.log(`[Migration] Found ${dupeFollowers.length} duplicate follower subscriptions — cleaning up...`);
        await db.query(`
          DELETE cf FROM copy_trade_followers cf
          INNER JOIN copy_trade_followers cf2
            ON cf.master_id = cf2.master_id
           AND cf.follower_mt5_account_id = cf2.follower_mt5_account_id
           AND cf.id < cf2.id
        `);
        console.log('[Migration] Duplicate copy_trade_followers rows removed.');
      }
    } catch (e) {
      console.warn('[Migration] copy_trade_followers dedup warning:', e.message);
    }

    // 2. Deduplicate copy_trades
    try {
      const [dupeRows] = await db.query(`
        SELECT follower_id, master_ticket, COUNT(*) AS cnt
        FROM copy_trades
        GROUP BY follower_id, master_ticket
        HAVING cnt > 1
      `);
      if (dupeRows.length > 0) {
        console.log(`[Migration] Found ${dupeRows.length} duplicate (follower_id, master_ticket) pairs in copy_trades — cleaning up...`);
        await db.query(`
          DELETE ct FROM copy_trades ct
          INNER JOIN copy_trades ct2
            ON ct.follower_id = ct2.follower_id
           AND ct.master_ticket = ct2.master_ticket
           AND ct.id > ct2.id
        `);
        console.log('[Migration] Duplicate copy_trades rows removed.');
      }
    } catch (e) {
      console.warn('[Migration] copy_trades dedup warning:', e.message);
    }

    // Never alter on a remote DB host — only alter on localhost (safe for local dev)
    const isLocalDb = ['localhost', '127.0.0.1'].includes(process.env.DB_HOST);
    if (NODE_ENV !== 'production' && isLocalDb) {
      await db.sync({ alter: true });
      console.log('Tables synced (dev/local — alter).');
    } else {
      await db.sync();
      console.log('Tables synced (no-alter).');
    }

    // ─── Force-create unique indexes ───
    const indexMigrations = [
      {
        sql: 'ALTER TABLE copy_trades ADD UNIQUE INDEX uq_copy_follower_master_ticket (follower_id, master_ticket)',
        name: 'copy_trades.uq_copy_follower_master_ticket'
      },
      {
        sql: 'ALTER TABLE copy_trade_followers ADD UNIQUE INDEX uq_follower_master_account (master_id, follower_mt5_account_id)',
        name: 'copy_trade_followers.uq_follower_master_account'
      }
    ];
    for (const m of indexMigrations) {
      try {
        await db.query(m.sql);
        console.log(`[Migration] Index created: ${m.name}`);
      } catch (e) {
        if (e.original?.errno === 1061 || e.message?.includes('Duplicate key name')) {
          console.log(`[Migration] Index already exists: ${m.name}`);
        } else {
          console.error(`[Migration] Index creation failed: ${m.name} —`, e.message);
        }
      }
    }

    // ─── Column migrations (ADD IF NOT EXISTS — safe to run every boot) ───
    const columnMigrations = [
      // ── users — V2 2FA + IP columns (may be missing on DBs migrated from V1) ──
      {
        sql: `ALTER TABLE users
                ADD COLUMN last_login_ip VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.last_login_ip'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN two_factor_secret VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.two_factor_secret'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN two_factor_method ENUM('email','totp') NOT NULL DEFAULT 'email'`,
        name: 'users.two_factor_method'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN email_otp_code VARCHAR(10) NULL DEFAULT NULL`,
        name: 'users.email_otp_code'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN email_otp_expires DATETIME NULL DEFAULT NULL`,
        name: 'users.email_otp_expires'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN referral_code VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.referral_code'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN referred_by BIGINT NULL DEFAULT NULL`,
        name: 'users.referred_by'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN email_verification_token VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.email_verification_token'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN email_verification_expires DATETIME NULL DEFAULT NULL`,
        name: 'users.email_verification_expires'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN password_reset_token VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.password_reset_token'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN password_reset_expires DATETIME NULL DEFAULT NULL`,
        name: 'users.password_reset_expires'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN phone_number VARCHAR(255) NULL DEFAULT NULL`,
        name: 'users.phone_number'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN kyc_status ENUM('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending'`,
        name: 'users.kyc_status'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0`,
        name: 'users.email_verified'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0`,
        name: 'users.two_factor_enabled'
      },
      {
        sql: `ALTER TABLE users
                ADD COLUMN last_login DATETIME NULL DEFAULT NULL`,
        name: 'users.last_login'
      },
      // copy_trade_followers — lot sizing columns added in V2
      {
        sql: `ALTER TABLE copy_trade_followers
                ADD COLUMN lot_mode ENUM('ratio','fixed','equity_pct') NOT NULL DEFAULT 'ratio'`,
        name: 'copy_trade_followers.lot_mode'
      },
      {
        sql: `ALTER TABLE copy_trade_followers
                ADD COLUMN fixed_lot DECIMAL(18,4) NULL DEFAULT NULL`,
        name: 'copy_trade_followers.fixed_lot'
      },
      {
        sql: `ALTER TABLE copy_trade_followers
                ADD COLUMN equity_pct DECIMAL(6,2) NULL DEFAULT NULL`,
        name: 'copy_trade_followers.equity_pct'
      },
      {
        sql: `ALTER TABLE copy_trade_followers
                ADD COLUMN max_lot_per_trade DECIMAL(18,4) NULL DEFAULT NULL`,
        name: 'copy_trade_followers.max_lot_per_trade'
      },
      // risk_pct — required for risk_pct lot mode
      {
        sql: `ALTER TABLE copy_trade_followers
                ADD COLUMN risk_pct DECIMAL(6,2) NULL DEFAULT NULL`,
        name: 'copy_trade_followers.risk_pct'
      },
      // Expand lot_mode ENUM to include balance_ratio and risk_pct
      {
        sql: `ALTER TABLE copy_trade_followers
                MODIFY COLUMN lot_mode ENUM('ratio','fixed','equity_pct','balance_ratio','risk_pct') NOT NULL DEFAULT 'ratio'`,
        name: 'copy_trade_followers.lot_mode enum expand'
      },
      // closed_at on copy_trades for sync service
      {
        sql: `ALTER TABLE copy_trades
                ADD COLUMN closed_at DATETIME NULL DEFAULT NULL`,
        name: 'copy_trades.closed_at'
      },
      // kyc_documents — back_image added for ID proof back side
      {
        sql: `ALTER TABLE kyc_documents
                ADD COLUMN back_image VARCHAR(255) NULL DEFAULT NULL`,
        name: 'kyc_documents.back_image'
      }
    ];
    for (const m of columnMigrations) {
      try {
        await db.query(m.sql);
        console.log(`[Migration] Column OK: ${m.name}`);
      } catch (e) {
        // errno 1060 = Duplicate column (MySQL < 8 doesn't support IF NOT EXISTS on ADD COLUMN)
        if (e.original?.errno === 1060 || e.message?.includes('Duplicate column')) {
          console.log(`[Migration] Column already exists: ${m.name}`);
        } else {
          console.error(`[Migration] Column migration failed: ${m.name} —`, e.message);
        }
      }
    }

    // ─── Engines ───
    if (String(process.env.COPY_ENGINE_ENABLED).toLowerCase() === 'true') {
      try {
        const { startCopyEngine } = await import('./services/copyEngine.service.js');
        await startCopyEngine();
        console.log('Copy Engine ON.');
      } catch (e) { console.error('Copy Engine failed:', e.message); }
    } else {
      console.log('Copy Engine OFF.');
    }

    if (String(process.env.MAM_ENGINE_ENABLED).toLowerCase() === 'true') {
      try {
        const { startMamEngine } = await import('./services/mamEngine.service.js');
        await startMamEngine();
        console.log('MAM Engine ON.');
      } catch (e) { console.error('MAM Engine failed:', e.message); }
    } else {
      console.log('MAM Engine OFF.');
    }

    if (String(process.env.PAMM_ENGINE_ENABLED).toLowerCase() === 'true') {
      try {
        const { startPammEngine } = await import('./services/pammEngine.service.js');
        await startPammEngine();
        console.log('PAMM Engine ON.');
      } catch (e) { console.error('PAMM Engine failed:', e.message); }
    } else {
      console.log('PAMM Engine OFF.');
    }

    // ─── Copy Trade Position Sync ───────────────────────────────────────────
    // Reconciles open DB copy_trades against real MT5 positions every 30 s.
    // Closes follower positions + marks DB records closed when master closes.
    // Always ON (no env flag needed — it's lightweight and critical for accuracy).
    try {
      const { startCopyTradeSync } = await import('./services/copyTradeSync.service.js');
      startCopyTradeSync();
      console.log('CopyTrade Sync ON (30s interval).');
    } catch (e) { console.error('CopyTrade Sync failed to start:', e.message); }

    // ─── Listen with EADDRINUSE retry ───
    // Use `once` (not `on`) so the listener is removed after firing — prevents
    // MaxListenersExceededWarning and duplicate handlers across retries.
    // Close the server before retrying so it isn't in a half-open state when
    // listen() is called again (avoids ERR_SERVER_ALREADY_LISTEN).
    const listen = (port, attempt) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          if (attempt < 5) {
            const wait = (attempt + 1) * 2000;
            console.log(`Port ${port} busy — retry #${attempt + 1} in ${wait / 1000}s...`);
            server.close(() => setTimeout(() => listen(port, attempt + 1), wait));
          } else {
            console.error(`Port ${port} still busy after 5 retries. Exiting.`);
            process.exit(1);
          }
        } else {
          console.error('Server error:', err);
          process.exit(1);
        }
      });
      server.listen(port, () => {
        console.log(`✓ StockVala V2 live on port ${port} [${NODE_ENV}]`);
      });
    };

    listen(Number(PORT), 0);

  } catch (error) {
    console.error('FATAL:', error);
    process.exit(1);
  }
};

startServer();

export default { app, server, io };
