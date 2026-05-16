import dotenv from 'dotenv';
dotenv.config();

import { validateEnv, isProduction } from './utils/env';
validateEnv();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';

import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { walletRouter } from './routes/wallet';
import { depositRouter } from './routes/deposit';
import { withdrawalRouter } from './routes/withdrawal';
import { orderRouter } from './routes/order';
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
import { securityRouter } from './routes/security';
import { apiKeyRouter } from './routes/apikey';
import { exportRouter } from './routes/export';
import { cardRouter } from './routes/card';
import { marketsRouter } from './routes/markets';
import transactionRouter from './routes/transactions';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './utils/prisma';
import { seedAdmin } from './utils/seed';
import { ensureMasterSeed } from './services/wallet/masterSeed.service';
import { cryptoWalletRouter } from './routes/cryptoWallet';
import { cryptoWithdrawalRouter } from './routes/cryptoWithdrawal';
import { globalLimiter, authLimiter, registerLimiter, withdrawalLimiter, webhookLimiter } from './middleware/rateLimiters';
import { protectedUploadsRouter } from './middleware/protectedUploads';

const app = express();
const httpServer = createServer(app);

/**
 * CORS — production accepts only the configured origins. Development
 * additionally accepts localhost/LAN for Expo. Native apps (no Origin
 * header) are always allowed.
 *
 * CLIENT_URL may be a comma-separated list (e.g.
 * "https://promrkts.com,https://app.promrkts.com").
 */
const PROD_ORIGINS = (process.env.CLIENT_URL ?? 'https://promrkts.com')
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

// Trust the first proxy hop (load balancer / ingress) so req.ip is the
// real client IP — required for rate limiting to work behind a proxy.
app.set('trust proxy', 1);

// Global middleware
app.use(helmet());
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
  return express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit on /api/.
app.use('/api/', globalLimiter);

// Tighter limits on credential / money endpoints.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/verify-email-code', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/withdrawals', withdrawalLimiter);
app.use('/api/withdrawal', withdrawalLimiter);
app.use('/api/withdrawal/webhook', webhookLimiter);

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
app.use('/api/orders', orderRouter);
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
app.use('/api/security', securityRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/export', exportRouter);
app.use('/api/cards', cardRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/wallet', cryptoWalletRouter);
app.use('/api/withdrawal', cryptoWithdrawalRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    socket.join(`user:${user.id}`);
  }

  socket.on('subscribe:prices', () => socket.join('prices'));

  // Legacy explicit subscribe (kept for backward compat with older clients).
  socket.on('subscribe:orders', (userId: string) => socket.join(`user:${userId}`));

  socket.on('typing:start', ({ toUserId }: { toUserId: string }) => {
    if (user?.id) io.to(`user:${toUserId}`).emit('typing:start', { fromUserId: user.id });
  });
  socket.on('typing:stop', ({ toUserId }: { toUserId: string }) => {
    if (user?.id) io.to(`user:${toUserId}`).emit('typing:stop', { fromUserId: user.id });
  });

  socket.on('disconnect', () => { /* nothing to clean up */ });
});

const PORT = parseInt(process.env.PORT || '5000');

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    await seedAdmin();
    await ensureMasterSeed();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { io };
