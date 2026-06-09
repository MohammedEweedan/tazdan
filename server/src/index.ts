import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';

// Initialize Sentry early
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    release: process.env.npm_package_version,
  });
}

import { validateEnv, isProduction } from './utils/env';
import { initRedis } from './utils/redis';
import { logger } from './utils/logger';
validateEnv();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import cluster from 'cluster';

import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { walletRouter } from './routes/wallet';
import { depositRouter } from './routes/deposit';
import { withdrawalRouter } from './routes/withdrawal';
import { adminRouter } from './routes/admin';
import { exchangeRouter } from './routes/exchange';
import bankAccountRouter from './routes/bankAccount';
import linkedWalletRouter from './routes/linkedWallet';
import { transferRouter } from './routes/transfer';
import whatsappRouter from './routes/whatsapp';
import { profileRouter } from './routes/profile';
import { p2pRouter } from './routes/p2p';
import { messageRouter } from './routes/messages';
import { referralRouter } from './routes/referral';
import { notificationRouter } from './routes/notification';
import { claimLinkRouter } from './routes/claimLink';
import { securityRouter } from './routes/security';
import { apiKeyRouter } from './routes/apikey';
import { exportRouter } from './routes/export';
import { cardRouter } from './routes/card';
import { marketsRouter } from './routes/markets';
import transactionRouter from './routes/transactions';
import activitiesRouter from './routes/activities';
import geoRouter from './routes/geo';
import platformBanksRouter from './routes/platformBanks';
import ratesRouter from './routes/rates';
import { waitlistRouter } from './routes/waitlist';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './utils/prisma';
import { seedAdmin } from './utils/seed';
import { ensureMasterSeed } from './services/wallet/masterSeed.service';
import { cryptoWalletRouter } from './routes/cryptoWallet';
import { cryptoWithdrawalRouter } from './routes/cryptoWithdrawal';
import { recurringBuyRouter } from './routes/recurringBuy';
import { startRecurringBuyScheduler } from './services/recurringBuy.service';
import { budgetRouter } from './routes/budget';
import { assetDiscussionRouter } from './routes/assetDiscussion';
import { startBudgetScheduler } from './services/budget.service';
import { startLydSampler } from './services/exchange/lydOrderBook.service';
import { startReconciliation } from './services/ledger/reconcile.service';
import { getEmailStatus } from './services/email';
import { startFundIntegrityAudit } from './services/ledger/fundIntegrity.service';
import { globalLimiter, authLimiter, registerLimiter, withdrawalLimiter, webhookLimiter } from './middleware/rateLimiters';
import { protectedUploadsRouter } from './middleware/protectedUploads';
import { ipBanMiddleware } from './middleware/ipBan';

// ── Cluster load balancing ────────────────────────────────────────────────
// Default to ONE production worker. Each worker has its own Prisma pool, so
// automatically forking per CPU can exhaust small managed Postgres plans.
// Scale only by explicitly setting CLUSTER_WORKERS after sizing DB capacity.
// In dev/test: single-process (ts-node-dev / jest don't play well with cluster).
const NUM_WORKERS = parseInt(process.env.CLUSTER_WORKERS ?? '1', 10) || 1;
const CLUSTER_ENABLED = process.env.NODE_ENV === 'production' && NUM_WORKERS > 1 && cluster.isPrimary;

if (CLUSTER_ENABLED) {
  const log = (msg: string) => process.stdout.write(`[cluster:primary] ${msg}\n`);
  log(`PID ${process.pid} — forking ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    log(`Worker ${worker.process.pid} exited (code=${code ?? '—'} signal=${signal ?? '—'}) — restarting`);
    cluster.fork();
  });

  cluster.on('online', (w) => log(`Worker ${w.process.pid} online`));

  process.on('SIGTERM', () => {
    log('SIGTERM — stopping all workers');
    for (const w of Object.values(cluster.workers ?? {})) w?.send('shutdown');
    setTimeout(() => process.exit(0), 5_000).unref();
  });

  // Primary exits the module here — do NOT fall through to Express setup.
  // (TypeScript doesn't have a clean "stop execution" so we rely on the
  //  `if (CLUSTER_ENABLED) { ... }` above preventing `start()` below.)
}

export const app = express();
const httpServer = createServer(app);

/**
 * CORS — production accepts only the configured origins. Development
 * additionally accepts localhost/LAN for Expo. Native apps (no Origin
 * header) are always allowed.
 *
 * CLIENT_URL may be a comma-separated list (e.g.
 * "https://tazdan.com,https://app.tazdan.com").
 */
const PROD_ORIGINS = (process.env.CLIENT_URL ?? 'https://tazdan.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const DEV_EXTRA_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:5001',
];

const DEV_LAN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+):\d+$/;

const corsOrigin: cors.CorsOptions['origin'] = (origin, cb) => {
  if (!origin) return cb(null, true);                              // native apps / curl
  if (PROD_ORIGINS.includes(origin)) return cb(null, true);
  if (!isProduction()) {
    if (DEV_EXTRA_ORIGINS.includes(origin)) return cb(null, true);
    if (DEV_LAN_REGEX.test(origin)) return cb(null, true);
  }
  return cb(new Error(`CORS: origin ${origin} not allowed`));
};

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
});
const onlineUsers = new Map<string, number>();
app.set('onlineUsers', onlineUsers);

// Trust the first proxy hop (load balancer / ingress) so req.ip is the
// real client IP — required for rate limiting to work behind a proxy.
app.set('trust proxy', 1);

// Block banned IPs before any processing
app.use(ipBanMiddleware);

// ── Vary header for CDN / proxy caching ───────────────────────────────
// Tell every cache layer that the response varies by Accept-Encoding so a
// gzip-compressed cached response is never served to a client that doesn't
// accept it. Actual gzip/Brotli compression should be done at the nginx or
// CDN layer (add `gzip on;` in nginx.conf) — in-process compression is
// unnecessary overhead when a reverse proxy is present.
app.use((_req, res, next) => {
  res.setHeader('Vary', 'Accept-Encoding');
  next();
});

// Sentry auto-instruments HTTP requests in v8+ — no requestHandler middleware needed.

// Global middleware
app.use(helmet());
// Gzip/Brotli compression for all JSON and text responses.
// Skip compression for small payloads (<1kb) and streaming responses.
app.use(compression({ threshold: 1024 }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());

// IMPORTANT — webhook endpoints that verify HMAC over the raw request
// body must be mounted with express.raw() BEFORE the global JSON
// parser, otherwise the body becomes a re-serialised object and the
// signature check fails. We handle the actual route registration
// inside the deposit router using its own raw() middleware; here we
// just exempt it from JSON parsing.
app.use((req, res, next) => {
  if (req.path === '/api/deposits/webhook/stripe') return next();
  // Capture raw body on webhooks that verify an HMAC over the exact bytes the
  // sender signed (Meta WhatsApp X-Hub-Signature-256, Fulus X-Webhook-Signature).
  // The body is still parsed into req.body.
  const needsRawBody =
    req.path === '/api/whatsapp/webhook/meta' ||
    req.path === '/api/exchange/webhook/fulus';
  return express.json({
    limit:  '1mb',
    verify: needsRawBody
      ? (req2: any, _res, buf) => { req2.rawBody = buf.toString('utf8'); }
      : undefined,
  })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Cache-Control on public read-only endpoints ───────────────────────
// Allows CDN / reverse-proxy caching for high-traffic public routes.
app.use(['/api/markets', '/api/exchange/search'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  next();
});

// Global rate limit on /api/.
app.use('/api/', globalLimiter);

// Tighter limits on credential / money endpoints.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/verify-email-code', authLimiter);
app.use('/api/auth/2fa/recover', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/withdrawals', withdrawalLimiter);
app.use('/api/withdrawal', withdrawalLimiter);
app.use('/api/withdrawal/webhook', webhookLimiter);

// Public media files for announcements (UUID filenames = unguessable).
const MEDIA_DIR = path.resolve(process.env.MEDIA_UPLOAD_DIR || './uploads/media');
app.use('/media', (req, res, next) => {
  const name = req.path.replace(/^\//, '');
  if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/.test(name)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const absolute = path.resolve(MEDIA_DIR, name);
  if (!absolute.startsWith(MEDIA_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  res.sendFile(absolute, (err) => { if (err) next(); });
});

// Auth-gated downloads for /uploads (KYC docs, avatars, evidence).
// IMPORTANT: never serve this directory as raw static.
app.use('/uploads', protectedUploadsRouter);

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/deposits', depositRouter);
app.use('/api/withdrawals', withdrawalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/bank-accounts', bankAccountRouter);
app.use('/api/linked-wallets', linkedWalletRouter);
app.use('/api/transfers', transferRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/profile', profileRouter);
app.use('/api/p2p', p2pRouter);
app.use('/api/messages', messageRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/notifications', notificationRouter);
// News proxy/cache — wraps CryptoCompare (and future feeds) so the
// mobile asset detail page doesn't hit a public CDN directly.  See
// controllers/news.controller.ts for the rationale.
import { newsRouter } from './routes/news';
app.use('/api/news', newsRouter);
app.use('/api/claim-links',  claimLinkRouter);
app.use('/api/security', securityRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/export', exportRouter);
app.use('/api/cards', cardRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/countries', geoRouter);
app.use('/api/platform-banks', platformBanksRouter);
app.use('/api/wallet', cryptoWalletRouter);
app.use('/api/withdrawal', cryptoWithdrawalRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/recurring-buys', recurringBuyRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/asset-discussions', assetDiscussionRouter);
app.use('/api/waitlist', waitlistRouter);

// Health check
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Redis check
  try {
    const { getRedisClient } = await import('./utils/redis');
    const client = getRedisClient();
    if (client) {
      await client.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'error';
    }
  } catch {
    checks.redis = 'error';
  }

  const healthy = Object.values(checks).every(v => v === 'ok');
  const status = healthy ? 200 : 503;

  res.status(status).json({
    status: healthy ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
    diagnostics: {
      email: getEmailStatus(),
    },
    worker: process.pid,
  });
});

// Sentry error handler (v8+ API) — must be before your own error handler
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

// Error handler
app.use(errorHandler);

/**
 * Socket.IO — authenticated namespace.
 *
 * Clients pass a JWT either via `auth.token` on the handshake or as a
 * `?token=` query string. Authenticated sockets are auto-joined to
 * `user:{id}` so controllers can emit per-user events without the
 * client having to subscribe explicitly.
 */
io.use((socket, next) => {
  // Only accept tokens via the handshake `auth` object — never via the
  // query string. URL-borne tokens leak through proxy logs, browser
  // history, and Referer headers.
  const raw = (socket.handshake.auth as any)?.token as string | undefined;
  if (!raw) return next();   // allow unauthenticated for public events
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'],
    }) as { id: string; email: string; role: string };
    (socket.data as any).user = decoded;
    next();
  } catch {
    next();                  // invalid token → unauthenticated socket, no rooms
  }
});

io.on('connection', (socket) => {
  const user = (socket.data as any).user as { id: string } | undefined;
  if (user?.id) {
    onlineUsers.set(user.id, (onlineUsers.get(user.id) ?? 0) + 1);
    socket.join(`user:${user.id}`);
  }

  socket.on('subscribe:prices', () => socket.join('prices'));

  // Asset-discussion live feed — join/leave the per-symbol room as the user
  // opens/closes the Discussions tab on an asset page.
  socket.on('discussion:join', (symbol: string) => {
    if (typeof symbol === 'string' && symbol.length <= 24) {
      socket.join(`discussion:${symbol.toUpperCase()}`);
    }
  });
  socket.on('discussion:leave', (symbol: string) => {
    if (typeof symbol === 'string' && symbol.length <= 24) {
      socket.leave(`discussion:${symbol.toUpperCase()}`);
    }
  });

  // Legacy explicit subscribe (kept for backward compat with older clients).
  socket.on('subscribe:orders', (userId: string) => socket.join(`user:${userId}`));

  socket.on('typing:start', ({ toUserId }: { toUserId: string }) => {
    if (user?.id) io.to(`user:${toUserId}`).emit('typing:start', { fromUserId: user.id });
  });
  socket.on('typing:stop', ({ toUserId }: { toUserId: string }) => {
    if (user?.id) io.to(`user:${toUserId}`).emit('typing:stop', { fromUserId: user.id });
  });

  socket.on('disconnect', () => {
    if (!user?.id) return;
    const next = (onlineUsers.get(user.id) ?? 1) - 1;
    if (next <= 0) onlineUsers.delete(user.id);
    else onlineUsers.set(user.id, next);
  });
});

const PORT = parseInt(process.env.PORT || '5000');

async function start() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    // Admin/support bootstrap is non-critical. Custody seed and Redis are
    // critical for a money server, so those fail startup if misconfigured.
    await seedAdmin().catch((e) => logger.error('[boot] seedAdmin failed', { err: e }));
    await ensureMasterSeed();
    await initRedis();

    httpServer.keepAliveTimeout = 65_000;
    httpServer.headersTimeout    = 66_000;
    httpServer.listen(PORT, () => {
      const workerTag = cluster.isWorker ? ` [worker ${process.pid}]` : '';
      logger.info(`Server running on port ${PORT}${workerTag}`);
    });

    // Recurring-buy scheduler. In a clustered deploy only worker 1 runs it
    // so due schedules aren't executed once per worker. The DB-level
    // idempotency key (rb_<id>_<slot>) is the real safety net regardless.
    const isSchedulerWorker = !cluster.isWorker || cluster.worker?.id === 1;
    if (isSchedulerWorker && process.env.DISABLE_RECURRING_BUY_SCHEDULER !== '1') {
      startRecurringBuyScheduler();
      startBudgetScheduler();
    }
    // Sample USD/LYD price + volume for the admin chart (one worker only).
    if (isSchedulerWorker) {
      startLydSampler();

      // FX boot tasks (one worker only, fire-and-forget — never block startup):
      //  1. Demote legacy auto-override rows wrongly left isActive=true, which
      //     would otherwise freeze a pair (e.g. USD/LYD stuck at an old value).
      //  2. Backfill chart history for every Fulus currency so the admin charts
      //     are populated immediately. Both are idempotent and gated by env.
      (async () => {
        try {
          if (process.env.FX_CLEAR_STALE_OVERRIDES_ON_BOOT === '1') {
            const { clearStaleAutoOverrides } = await import('./services/exchange/fxRateProvider.service');
            await clearStaleAutoOverrides();
          }
          const days = Number(process.env.FULUS_BACKFILL_DAYS ?? 7);
          if (days > 0) {
            const { backfillAllHistory } = await import('./services/exchange/fulus.service');
            await backfillAllHistory(days);
          }
        } catch (e) { logger.warn('[fx] boot tasks failed', { err: e }); }
      })();
    }
    // One-time idempotent ledger backfill — sync opening balances from the
    // live Wallet/UserWallet tables so the ledger is an authoritative copy.
    // Safe to run every boot (only posts diffs). Off by default once stable
    // via LEDGER_BACKFILL_ON_BOOT=0.
    const runLedgerBackfill = process.env.LEDGER_BACKFILL_ON_BOOT === '1';
    if (isSchedulerWorker && runLedgerBackfill) {
      try {
        const { backfillLedgerOpeningBalances } = await import('./services/ledger/backfill.service');
        await backfillLedgerOpeningBalances();
      } catch (e) { logger.error('[ledger] boot backfill failed', { err: e }); }
    }
    // Periodic ledger reconciliation — re-derives balances, halts trading on
    // any money-conservation drift (one worker only).
    if (isSchedulerWorker) {
      startReconciliation();
    }
    // Fund-integrity audit against the live Wallet tables — detects missing or
    // conjured funds (internal balances vs net external deposits/withdrawals).
    if (isSchedulerWorker) {
      startFundIntegrityAudit();
    }
  } catch (error) {
    logger.error('Failed to start server:', { err: error });
    process.exit(1);
  }
}

// Workers and single-process dev start the Express server.
// The cluster primary only forks workers (handled above) and never listens.
if (!CLUSTER_ENABLED) {
  start();
}

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  // Close Socket.IO first so it drops all persistent connections,
  // otherwise httpServer.close() waits forever for them to drain.
  io.close(() => {
    httpServer.close(async () => {
      logger.info('HTTP server closed');
      try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
      } catch (e) {
        logger.error('Error during shutdown', { err: e });
      }
      process.exit(0);
    });
  });
  // Force-exit after 10 s if still draining
  setTimeout(() => {
    logger.error('Shutdown timeout — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export { io };
