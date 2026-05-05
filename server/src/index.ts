import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

const app = express();
const httpServer = createServer(app);

/**
 * CORS — accepts a comma-separated list in CLIENT_URL, plus any
 * Expo dev origin (localhost on any port + LAN IPs). Native (no
 * `Origin` header) is always allowed.
 */
const ALLOWED_ORIGINS = [process.env.CLIENT_URL ?? 'https://promrkts.com',
  'https://www.promrkts.com',
  'https://api.promrkts.com',
  'http://localhost:3003',
  'http://localhost:5000'];

const corsOrigin: cors.CorsOptions['origin'] = (origin, cb) => {
  if (!origin) return cb(null, true);                              // native apps / curl
  if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
  // Expo dev: any localhost or 127.0.0.1 or LAN IP on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+):\d+$/.test(origin)) {
    return cb(null, true);
  }
  return cb(new Error(`CORS: origin ${origin} not allowed`));
};

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
});

// Global middleware
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '90000000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '10000'),
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  const raw =
    (socket.handshake.auth as any)?.token ??
    (socket.handshake.query?.token as string | undefined);
  if (!raw) return next();   // allow unauthenticated for public events
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET || 'secret') as {
      id: string; email: string; role: string;
    };
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
