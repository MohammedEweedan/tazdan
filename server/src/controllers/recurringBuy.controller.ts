import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import {
  defaultNetwork,
  computeNextRun,
  executeRecurringBuy,
} from '../services/recurringBuy.service';
import type { RecurringFrequency } from '@prisma/client';

const CRYPTO_ASSETS = [
  'BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
] as const;
const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'] as const;

const createSchema = z.object({
  asset: z.string().min(2).max(12).transform((s) => s.toUpperCase()),
  network: z.string().optional(),
  fiatCurrency: z.enum(FIAT_CURRENCIES),
  fiatAmount: z.coerce.number().positive().max(1_000_000),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  sourceType: z.enum(['WALLET', 'CARD']),
  sourceId: z.string().optional(),
  // Optional first-run time; defaults to "one cadence from now".
  startAt: z.string().datetime().optional(),
});

const updateSchema = z.object({
  fiatAmount: z.coerce.number().positive().max(1_000_000).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  sourceType: z.enum(['WALLET', 'CARD']).optional(),
  sourceId: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

export class RecurringBuyController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recurringBuys = await prisma.recurringBuy.findMany({
        where: { userId: req.user!.id, status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ recurringBuys });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createSchema.parse(req.body);

      if (!CRYPTO_ASSETS.includes(data.asset as any)) {
        // Allow long-tail assets too, but block obvious fiat/junk.
        if (FIAT_CURRENCIES.includes(data.asset as any)) {
          throw new AppError('Cannot schedule a recurring buy of a fiat currency', 400);
        }
      }

      if (data.sourceType === 'CARD') {
        if (!data.sourceId) {
          throw new AppError('A card must be selected for card-funded recurring buys', 400);
        }
        const card = await prisma.card.findFirst({
          where: { id: data.sourceId, userId: req.user!.id, status: 'ACTIVE' },
        });
        if (!card) throw new AppError('Selected card not found or inactive', 400);
      }
      if (data.sourceType === 'WALLET') {
        // sourceId for WALLET is the funding fiat wallet currency; default to
        // the buy currency when omitted.
        data.sourceId = data.sourceId || data.fiatCurrency;

        // Reject scheduling against a wallet that can't cover even the first
        // run — an empty wallet would just fail on the first execution and
        // confuse the user. Only enforce when the funding wallet currency
        // matches the buy currency (same-unit comparison).
        const fundingWallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: data.sourceId as any } },
        });
        if (!fundingWallet) {
          throw new AppError(`No ${data.sourceId} wallet to fund this recurring buy`, 400);
        }
        if (data.sourceId === data.fiatCurrency && Number(fundingWallet.balance) < data.fiatAmount) {
          throw new AppError('Insufficient balance in the selected wallet for the first buy', 400);
        }
      }

      const now = new Date();
      const nextRunAt = data.startAt
        ? new Date(data.startAt)
        : computeNextRun(now, data.frequency as RecurringFrequency);

      const recurringBuy = await prisma.recurringBuy.create({
        data: {
          userId: req.user!.id,
          asset: data.asset,
          network: data.network?.toUpperCase() || defaultNetwork(data.asset),
          fiatCurrency: data.fiatCurrency as any,
          fiatAmount: data.fiatAmount,
          frequency: data.frequency as RecurringFrequency,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
          nextRunAt,
        },
      });

      res.status(201).json({ recurringBuy });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);

      const existing = await prisma.recurringBuy.findFirst({
        where: { id, userId: req.user!.id, status: { not: 'CANCELLED' } },
      });
      if (!existing) throw new AppError('Recurring buy not found', 404);

      const recurringBuy = await prisma.recurringBuy.update({
        where: { id },
        data: {
          fiatAmount: data.fiatAmount,
          frequency: data.frequency as RecurringFrequency | undefined,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          status: data.status,
        },
      });

      res.json({ recurringBuy });
    } catch (error) {
      next(error);
    }
  }

  /** Cancel (soft-delete) a schedule. */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.recurringBuy.findFirst({
        where: { id, userId: req.user!.id },
      });
      if (!existing) throw new AppError('Recurring buy not found', 404);

      await prisma.recurringBuy.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /** Run a schedule immediately (manual "buy now" from the list). */
  static async runNow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.recurringBuy.findFirst({
        where: { id, userId: req.user!.id, status: 'ACTIVE' },
      });
      if (!existing) throw new AppError('Active recurring buy not found', 404);

      const order = await executeRecurringBuy(id);
      await prisma.recurringBuy.update({
        where: { id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 }, lastError: null, failureCount: 0 },
      });

      res.json({ order });
    } catch (error) {
      next(error);
    }
  }
}
