import { Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

/* ── Tier config ─────────────────────────────────────────────
   Centralised so limits / cashback are in one place and can be
   tuned without touching callers. */
const TIER_CONFIG = {
  STARTER: { dailyLimit: 5_000, monthlyLimit: 50_000, cashbackRate: 0.01 },
  MASTER:  { dailyLimit: 15_000, monthlyLimit: 150_000, cashbackRate: 0.015 },
  PRO:     { dailyLimit: 50_000, monthlyLimit: 500_000, cashbackRate: 0.02 },
} as const;

/* ── Schemas ─────────────────────────────────────────────── */

const createCardSchema = z.object({
  tier: z.enum(['STARTER', 'MASTER', 'PRO']).default('STARTER'),
  nickname: z.string().max(32).optional(),
  currency: z.enum(['USDT', 'USD', 'LYD']).default('USDT'),
});

const updateCardSchema = z.object({
  nickname: z.string().max(32).optional(),
  contactlessOn: z.boolean().optional(),
  onlineOn: z.boolean().optional(),
  atmOn: z.boolean().optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
});

const transactionSchema = z.object({
  merchant: z.string().min(1),
  category: z.string().optional(),
  country: z.string().length(2).optional(),
  amount: z.number().positive(),
  type: z.enum(['PURCHASE', 'REFUND', 'FEE', 'CASHBACK', 'TOPUP', 'WITHDRAWAL']).default('PURCHASE'),
  metadata: z.record(z.any()).optional(),
});

/* ── Helpers ─────────────────────────────────────────────── */

const genLast4 = () => crypto.randomInt(1000, 9999).toString();
const genRef = () => `card_${crypto.randomBytes(8).toString('hex')}`;

export class CardController {
  /* GET /api/cards — user's cards */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cards = await prisma.card.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ cards });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/cards/:id — single card with last 20 tx */
  static async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!card) throw new AppError('Card not found', 404);
      res.json({ card });
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/cards — issue a new virtual card */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createCardSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new AppError('User not found', 404);
      if (user.kycStatus !== 'APPROVED') {
        throw new AppError('KYC approval required before issuing a card', 403);
      }

      const cfg = TIER_CONFIG[data.tier];
      const now = new Date();
      const card = await prisma.card.create({
        data: {
          userId: user.id,
          tier: data.tier,
          status: 'ACTIVE',
          nickname: data.nickname,
          last4: genLast4(),
          expiryMonth: ((now.getMonth() + 1 + 48 - 1) % 12) + 1,
          expiryYear: now.getFullYear() + 4,
          cardHolder: `${user.firstName} ${user.lastName}`.toUpperCase(),
          currency: data.currency as any,
          dailyLimit: cfg.dailyLimit,
          monthlyLimit: cfg.monthlyLimit,
          cashbackRate: cfg.cashbackRate,
          issuedAt: now,
          activatedAt: now,
        },
      });

      res.status(201).json({ card });
    } catch (error) {
      next(error);
    }
  }

  /* PATCH /api/cards/:id — update nickname / controls / limits */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateCardSchema.parse(req.body);
      const existing = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!existing) throw new AppError('Card not found', 404);
      if (existing.status === 'CANCELLED') {
        throw new AppError('Cannot modify a cancelled card', 400);
      }

      const card = await prisma.card.update({
        where: { id: existing.id },
        data,
      });
      res.json({ card });
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/cards/:id/freeze */
  static async freeze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!card) throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED') throw new AppError('Card is cancelled', 400);

      const updated = await prisma.card.update({
        where: { id: card.id },
        data: { frozen: true, status: 'FROZEN' },
      });
      res.json({ card: updated });
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/cards/:id/unfreeze */
  static async unfreeze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!card) throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED') throw new AppError('Card is cancelled', 400);

      const updated = await prisma.card.update({
        where: { id: card.id },
        data: { frozen: false, status: 'ACTIVE' },
      });
      res.json({ card: updated });
    } catch (error) {
      next(error);
    }
  }

  /* DELETE /api/cards/:id — cancel card permanently */
  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!card) throw new AppError('Card not found', 404);

      const updated = await prisma.card.update({
        where: { id: card.id },
        data: { status: 'CANCELLED', frozen: true, cancelledAt: new Date() },
      });
      res.json({ card: updated });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/cards/:id/transactions — paginated tx list */
  static async transactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '25', 10)));

      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!card) throw new AppError('Card not found', 404);

      const [items, total] = await Promise.all([
        prisma.cardTransaction.findMany({
          where: { cardId: card.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.cardTransaction.count({ where: { cardId: card.id } }),
      ]);

      res.json({ items, total, page, pageSize });
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/cards/:id/transactions — simulate a purchase/refund/etc.
     Useful while there's no external acquirer integration. Enforces
     frozen-state, cancelled-state, and daily/monthly limits. */
  static async recordTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = transactionSchema.parse(req.body);
      const card = await prisma.card.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!card) throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED') throw new AppError('Card is cancelled', 400);

      let declined = false;
      let declinedReason: string | undefined;

      if (card.frozen || card.status === 'FROZEN') {
        declined = true;
        declinedReason = 'Card is frozen';
      } else if (data.type === 'PURCHASE') {
        const newMonth = Number(card.spentMonth) + data.amount;
        if (data.amount > Number(card.dailyLimit)) {
          declined = true;
          declinedReason = 'Exceeds daily limit';
        } else if (newMonth > Number(card.monthlyLimit)) {
          declined = true;
          declinedReason = 'Exceeds monthly limit';
        }
      }

      const cashback =
        !declined && data.type === 'PURCHASE'
          ? +(data.amount * Number(card.cashbackRate)).toFixed(2)
          : 0;

      const tx = await prisma.cardTransaction.create({
        data: {
          cardId: card.id,
          userId: req.user!.id,
          type: data.type,
          merchant: data.merchant,
          category: data.category,
          country: data.country,
          amount: data.amount,
          currency: card.currency,
          cashback,
          declined,
          declinedReason,
          reference: genRef(),
          metadata: (data.metadata as any) ?? undefined,
        },
      });

      if (!declined && data.type === 'PURCHASE') {
        await prisma.card.update({
          where: { id: card.id },
          data: {
            spentTotal: { increment: data.amount },
            spentMonth: { increment: data.amount },
            cashbackBalance: { increment: cashback },
          },
        });
      }

      res.status(201).json({ transaction: tx, declined });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/cards/tiers — public tier catalogue (used on landing + dashboard) */
  static async tiers(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ tiers: TIER_CONFIG });
    } catch (error) {
      next(error);
    }
  }
}
