import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import agentRouter from './routes/agent';
import { transferRouter } from './routes/transfer';
import whatsappRouter from './routes/whatsapp';
import { profileRouter } from './routes/profile';
import { p2pRouter } from './routes/p2p';
import { messageRouter } from './routes/messages';
import { memeTokenRouter } from './routes/memetoken';
import { smartContractRouter } from './routes/smartcontract';
import { referralRouter } from './routes/referral';
import { notificationRouter } from './routes/notification';
import { securityRouter } from './routes/security';
import { apiKeyRouter } from './routes/apikey';
import { exportRouter } from './routes/export';
import { cardRouter } from './routes/card';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './utils/prisma';
import { seedAdmin } from './utils/seed';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Global middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
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
app.use('/api/agents', agentRouter);
app.use('/api/transfers', transferRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/profile', profileRouter);
app.use('/api/p2p', p2pRouter);
app.use('/api/messages', messageRouter);
app.use('/api/tokens', memeTokenRouter);
app.use('/api/contracts', smartContractRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/security', securityRouter);
app.use('/api/api-keys', apiKeyRouter);
app.use('/api/export', exportRouter);
app.use('/api/cards', cardRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe:prices', () => {
    socket.join('prices');
  });

  socket.on('subscribe:orders', (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = parseInt(process.env.PORT || '5000');

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    await seedAdmin();

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
