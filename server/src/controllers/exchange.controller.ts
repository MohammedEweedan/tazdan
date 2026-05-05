import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Server as IOServer } from 'socket.io';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import {
  buildQuote,
  getQuote,
  type SupportedAsset,
} from '../services/exchange/priceEngine.service';
import { executeQuote } from '../services/exchange/orderExecution.service';

const quoteSchema = z.object({
  asset: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  network: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  fiatAmount: z.union([z.string(), z.number()]).optional(),
  cryptoAmount: z.union([z.string(), z.number()]).optional(),
});

const executeSchema = z.object({
  quoteId: z.string().min(1),
  confirmedByUser: z.literal(true),
  idempotencyKey: z.string().min(8).max(128).optional(),
  // Required when the user has 2FA enabled (we re-check server-side).
  twoFactorCode: z.string().min(6).max(8).optional(),
});

export class ExchangeController {
  static async getRates(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await prisma.exchangeRate.findMany({ where: { isActive: true } });
      res.json({ rates });
    } catch (error) {
      next(error);
    }
  }

  static async getRatePair(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const rate = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: base.toUpperCase() as any, quoteCurrency: quote.toUpperCase() as any } },
      });
      res.json({ rate });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/exchange/quote
  static async createQuote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = quoteSchema.parse(req.body);
      if (body.side === 'BUY' && body.fiatAmount == null) {
        throw new AppError('fiatAmount required for BUY', 400);
      }
      if (body.side === 'SELL' && body.cryptoAmount == null) {
        throw new AppError('cryptoAmount required for SELL', 400);
      }
      const quote = await buildQuote({
        asset: body.asset,
        network: body.network,
        side: body.side,
        fiatAmount: body.fiatAmount,
        cryptoAmount: body.cryptoAmount,
      });
      res.json({ quote });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/exchange/execute
  static async executeOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = executeSchema.parse(req.body);
      // Surface the quote before consumption so the client can re-render
      // even on the 400 expired path.
      const peek = getQuote(body.quoteId);
      if (!peek) throw new AppError('Quote expired or not found', 400);

      // 2FA enforcement on every BUY/SELL — sensitive action.
      const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (me?.twoFactorEnabled) {
        if (!body.twoFactorCode) throw new AppError('2FA code required', 401);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const speakeasy = require('speakeasy');
        const ok = speakeasy.totp.verify({
          secret: me.twoFactorSecret!,
          encoding: 'base32',
          token: body.twoFactorCode,
          window: 2,
        });
        if (!ok) throw new AppError('Invalid 2FA code', 401);
      } else {
        // 2FA not yet configured. We allow the order to go through but
        // nudge the user — strict policy (block until enabled) is
        // toggled with EXCHANGE_REQUIRE_2FA=1.
        if (process.env.EXCHANGE_REQUIRE_2FA === '1') {
          throw new AppError('Enable 2FA before trading', 403);
        }
      }

      const order = await executeQuote({
        userId: req.user!.id,
        quoteId: body.quoteId,
        idempotencyKey: body.idempotencyKey,
      });

      // Fire-and-forget socket notification to the user's room.
      const io = req.app.get('io') as IOServer | undefined;
      io?.to(`user:${req.user!.id}`).emit('order:executed', {
        id: order.id,
        asset: order.asset,
        network: order.network,
        type: order.type,
        status: order.status,
        cryptoAmount: order.cryptoAmount.toString(),
        quotedPrice: order.quotedPrice.toString(),
      });

      res.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/exchange/orders
  static async listOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const [items, total] = await Promise.all([
        prisma.cryptoOrder.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.cryptoOrder.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({ orders: items, total, page, limit });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/exchange/orders/:id
  static async getOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await prisma.cryptoOrder.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!order) throw new AppError('Order not found', 404);
      res.json({ order });
    } catch (error) {
      next(error);
    }
  }
}
