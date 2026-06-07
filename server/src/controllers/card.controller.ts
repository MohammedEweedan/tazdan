import { Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { collectFee } from '../services/fee/feeCollector.service';
import { postLedger, isLedgerCurrency } from '../services/ledger/ledger.service';
import { emitActivity } from '../utils/realtime';
import { isDateLocked, requiresStepUp } from '../services/budget.service';
import { issueStepUp, verifyStepUp } from '../services/security/stepUp.service';

/** Physical card order fee (USD). Admin-configurable via PlatformSettings,
 *  floored at the $20 minimum the product requires. */
export const PHYSICAL_CARD_FEE_KEY = 'card_physical_order_fee';
const PHYSICAL_CARD_FEE_MIN = 20;
async function getPhysicalCardFee(): Promise<number> {
  const row = await prisma.platformSettings.findUnique({ where: { key: PHYSICAL_CARD_FEE_KEY } });
  const v = parseFloat(row?.value ?? '');
  return Math.max(PHYSICAL_CARD_FEE_MIN, Number.isFinite(v) ? v : PHYSICAL_CARD_FEE_MIN);
}

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
        // Look up the configured card-spend fee percent.
        const feeSetting = await prisma.platformSettings.findUnique({
          where: { key: 'card_fee_percent' },
        });
        const feePercent = parseFloat(feeSetting?.value ?? '1.0');
        const cardFee = +(data.amount * feePercent / 100).toFixed(2);

        await prisma.card.update({
          where: { id: card.id },
          data: {
            spentTotal: { increment: data.amount },
            spentMonth: { increment: data.amount },
            cashbackBalance: { increment: cashback },
          },
        });

        // Mirror the card spend into the unified Transaction ledger
        // so it shows up in the user's activity list alongside trades,
        // deposits, withdrawals, and P2P.
        await prisma.transaction.create({
          data: {
            userId: req.user!.id,
            type:   'CARD_SPEND' as any,
            currency: card.currency as any,
            amount:   new Decimal(-data.amount),
            fee:      new Decimal(cardFee),
            balanceBefore: 0,
            balanceAfter:  0,
            description:   `Card purchase · ${data.merchant ?? data.category ?? 'POS'}`,
            reference:     tx.reference,
            metadata: { cardId: card.id, merchant: data.merchant, country: data.country, cashback, cardFee } as any,
          },
        }).catch(() => null); // non-fatal — card record is the source of truth

        // Pour the card-spend platform fee into the platform wallet.
        if (cardFee > 0) {
          await collectFee({
            source:   'card_spend',
            sourceId: tx.id,
            payerId:  req.user!.id,
            amount:   new Decimal(cardFee),
            currency: card.currency as string,
            description: `Card spend fee · ${data.merchant ?? 'POS'}`,
            metadata: { cardId: card.id, merchant: data.merchant, country: data.country, cashback },
          }).catch((e) => console.warn('[card] collectFee failed', e));
        }
      }

      emitActivity(req, [req.user!.id], { kind: 'card', txId: tx.id });
      res.status(201).json({ transaction: tx, declined });
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/cards/:id/topup — debit a user wallet and record a TOPUP CardTransaction. */
  static async topup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, currency } = z.object({
        amount:   z.number().positive(),
        currency: z.string().min(1).max(10),
      }).parse(req.body);

      const userId = req.user!.id;
      const card = await prisma.card.findFirst({ where: { id: req.params.id, userId } });
      if (!card)                              throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED')        throw new AppError('Card is cancelled', 400);

      const wallet = await prisma.wallet.findFirst({ where: { userId, currency: currency as any } });
      if (!wallet) throw new AppError(`No ${currency} wallet`, 400);

      const available = Number(wallet.balance) - Number(wallet.frozen ?? 0);
      if (available < amount) throw new AppError('Insufficient balance', 400);

      const tx = await prisma.$transaction(async (prismaTx) => {
        await prismaTx.wallet.update({
          where: { id: wallet.id },
          data:  { balance: { decrement: amount } },
        });
        // Double-entry: funds leave the user's wallet onto the card spend rail
        // (SYSTEM_OFFRAMP is the off-platform counterparty).
        if (isLedgerCurrency(currency)) {
          await postLedger(prismaTx, {
            refType: 'card_topup',
            refId: card.id,
            memo: `Card top-up ${currency}`,
            legs: [
              { type: 'USER', userId, currency: currency as any, amount: new Decimal(-amount) },
              { type: 'SYSTEM_OFFRAMP', currency: currency as any, amount: new Decimal(amount) },
            ],
          });
        }
        return prismaTx.cardTransaction.create({
          data: {
            cardId:    card.id,
            userId,
            type:      'TOPUP',
            merchant:  'Wallet Top-Up',
            amount,
            currency:  currency as any,
            cashback:  0,
            declined:  false,
            reference: genRef(),
            metadata:  { fromCurrency: currency } as any,
          },
        });
      });

      res.status(201).json({ transaction: tx });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/cards/physical-fee — the current physical-card order fee (USD). */
  static async physicalFee(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ fee: await getPhysicalCardFee(), currency: 'USD', min: PHYSICAL_CARD_FEE_MIN });
    } catch (error) { next(error); }
  }

  /* POST /api/cards/:id/order-physical — request a physical print of a card.
     Charges the admin-configured fee (min $20) from the user's spendable
     balance (card currency first, else USD), records it in the fee ledger,
     captures the shipping address, and flags the card REQUESTED. */
  static async orderPhysical(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ship = z.object({
        shippingName:     z.string().min(2).max(120),
        shippingLine1:    z.string().min(2).max(160),
        shippingLine2:    z.string().max(160).optional(),
        shippingCity:     z.string().min(1).max(80),
        shippingPostcode: z.string().max(20).optional(),
        shippingCountry:  z.string().min(2).max(60),
        shippingPhone:    z.string().max(32).optional(),
      }).parse(req.body);

      const userId = req.user!.id;
      const card = await prisma.card.findFirst({ where: { id: req.params.id, userId } });
      if (!card)                       throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED') throw new AppError('Card is cancelled', 400);
      if (card.physicalStatus !== 'NONE') throw new AppError('A physical card is already on the way', 400);

      const fee = await getPhysicalCardFee();

      // Pick the funding wallet: the card's currency first, then USD, then USDT.
      const candidates = [card.currency as string, 'USD', 'USDT'];
      let funding: { id: string; currency: string } | null = null;
      for (const cur of candidates) {
        const w = await prisma.wallet.findFirst({ where: { userId, currency: cur as any } });
        if (w && Number(w.balance) - Number(w.frozen ?? 0) >= fee) { funding = { id: w.id, currency: cur }; break; }
      }
      if (!funding) throw new AppError(`Insufficient balance — the physical card costs $${fee.toFixed(2)}`, 400);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({ where: { id: funding!.id }, data: { balance: { decrement: fee } } });
        // Double-entry: physical-card fee leaves the user to the platform.
        if (isLedgerCurrency(funding!.currency)) {
          await postLedger(tx, {
            refType: 'card_physical_fee',
            refId: card.id,
            memo: 'Physical card order fee',
            legs: [
              { type: 'USER', userId, currency: funding!.currency as any, amount: new Decimal(-fee) },
              { type: 'PLATFORM', currency: funding!.currency as any, amount: new Decimal(fee) },
            ],
          });
        }
        await tx.cardTransaction.create({
          data: {
            cardId: card.id, userId, type: 'FEE', merchant: 'Physical card',
            amount: fee, currency: funding!.currency as any, cashback: 0, declined: false,
            reference: genRef(), metadata: { kind: 'physical_card_order' } as any,
          },
        });
        return tx.card.update({
          where: { id: card.id },
          data: {
            physicalStatus: 'REQUESTED', physicalOrderedAt: new Date(), physicalFee: fee,
            shippingName: ship.shippingName, shippingLine1: ship.shippingLine1,
            shippingLine2: ship.shippingLine2 ?? null, shippingCity: ship.shippingCity,
            shippingPostcode: ship.shippingPostcode ?? null, shippingCountry: ship.shippingCountry,
            shippingPhone: ship.shippingPhone ?? null,
          },
        });
      });

      await collectFee({
        source: 'card_order', sourceId: card.id, payerId: userId,
        amount: fee, currency: funding.currency,
        description: `Physical card order · •••• ${card.last4}`,
        metadata: { cardId: card.id, city: ship.shippingCity, country: ship.shippingCountry },
      }).catch((e) => console.warn('[card] order fee collect failed', e));

      await prisma.notification.create({
        data: {
          userId, type: 'card',
          title: 'Physical card ordered',
          message: `Your physical card ending ${card.last4} is being printed and will ship to ${ship.shippingCity}. A $${fee.toFixed(2)} fee was charged.`,
          metadata: { cardId: card.id } as any,
        },
      }).catch(() => null);

      emitActivity(req, [userId], { kind: 'card', cardId: card.id });
      res.status(201).json({ card: updated, fee });
    } catch (error) { next(error); }
  }

  /* POST /api/cards/:id/fund-from-budget — move money from a budget onto the
     card (lets the card "spend out of" a savings goal once it's unlocked).
     Enforces the budget lock: a DATE lock blocks until the unlock date and a
     STEP_UP lock requires the 6-digit code. Atomic: releases the budget hold
     and loads the card in one transaction. */
  static async fundFromBudget(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { budgetId, amount, stepUpCode } = z.object({
        budgetId:   z.string().uuid(),
        amount:     z.number().positive(),
        stepUpCode: z.string().regex(/^\d{6}$/).optional(),
      }).parse(req.body);

      const userId = req.user!.id;
      const card = await prisma.card.findFirst({ where: { id: req.params.id, userId } });
      if (!card)                       throw new AppError('Card not found', 404);
      if (card.status === 'CANCELLED') throw new AppError('Card is cancelled', 400);

      const budget = await prisma.budgetWallet.findFirst({ where: { id: budgetId, userId } });
      if (!budget) throw new AppError('Budget not found', 404);
      if (budget.currency !== card.currency) {
        throw new AppError(`Budget is in ${budget.currency} but the card is ${card.currency}`, 400);
      }
      if (Number(budget.balance) < amount) throw new AppError('Amount exceeds budget balance', 400);

      // Lock enforcement — identical rules to a normal budget withdrawal.
      if (isDateLocked(budget)) {
        throw new AppError(`Locked until ${new Date(budget.unlockDate!).toISOString().slice(0, 10)}`, 403);
      }
      if (requiresStepUp(budget)) {
        if (!stepUpCode) {
          const { method } = await issueStepUp(userId, 'withdrawal');
          return res.status(401).json({ requiresStepUp: true, method });
        }
        await verifyStepUp(userId, 'withdrawal', stepUpCode);
      }

      const amt = new Decimal(amount);
      const result = await prisma.$transaction(async (tx) => {
        // Release the budget hold AND move the money off the wallet onto the card.
        await tx.wallet.update({
          where: { userId_currency: { userId, currency: budget.currency } },
          data: { frozen: { decrement: amt }, balance: { decrement: amt } },
        });
        // Double-entry: budget funds leave the user's wallet onto the card rail.
        if (isLedgerCurrency(budget.currency)) {
          await postLedger(tx, {
            refType: 'card_budget_load',
            refId: card.id,
            memo: `Budget → card ${budget.currency}`,
            legs: [
              { type: 'USER', userId, currency: budget.currency as any, amount: amt.neg() },
              { type: 'SYSTEM_OFFRAMP', currency: budget.currency as any, amount: amt },
            ],
          });
        }
        await tx.budgetWallet.update({ where: { id: budget.id }, data: { balance: { decrement: amt } } });
        await tx.budgetContribution.create({ data: { budgetId: budget.id, amount: amt.neg(), kind: 'WITHDRAWAL' } });
        const ctx = await tx.cardTransaction.create({
          data: {
            cardId: card.id, userId, type: 'TOPUP', merchant: `Budget · ${budget.name}`,
            amount: amt, currency: card.currency, cashback: 0, declined: false,
            reference: genRef(), metadata: { budgetId: budget.id, kind: 'budget_to_card' } as any,
          },
        });
        await tx.transaction.create({
          data: {
            userId, type: 'BUDGET_RELEASE', currency: budget.currency, amount: amt,
            balanceBefore: 0, balanceAfter: 0,
            description: `Loaded "${budget.name}" onto card •••• ${card.last4}`,
          },
        }).catch(() => null);
        return ctx;
      });

      emitActivity(req, [userId], { kind: 'card', cardId: card.id });
      res.status(201).json({ transaction: result });
    } catch (error) { next(error); }
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
