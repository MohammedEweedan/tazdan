/**
 * Budget Wallets controller — savings goals with optional auto-contribution
 * and an optional lock (until a date and/or behind a 2FA/email step-up code).
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import {
  contribute, release, computeNextRun,
  isDateLocked, requiresStepUp,
} from '../services/budget.service';
import { issueStepUp, verifyStepUp } from '../services/security/stepUp.service';

const CURRENCIES = z.string().min(2).max(12);
const FREQ = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);

const createSchema = z.object({
  name:         z.string().min(1).max(60),
  emoji:        z.string().max(8).optional(),
  currency:     CURRENCIES,
  targetAmount: z.number().positive().optional(),
  targetDate:   z.string().datetime().optional(),
  lockType:     z.enum(['NONE', 'DATE', 'STEP_UP', 'DATE_AND_STEP_UP']).default('NONE'),
  unlockDate:   z.string().datetime().optional(),
  auto: z.object({
    amount:         z.number().positive(),
    frequency:      FREQ,
    sourceCurrency: CURRENCIES.optional(),
    firstRunAt:     z.string().datetime().optional(),
  }).optional(),
});

function progress(b: any) {
  const target = b.targetAmount != null ? Number(b.targetAmount) : null;
  const bal = Number(b.balance);
  return {
    ...b,
    progressPct: target && target > 0 ? Math.min(100, (bal / target) * 100) : null,
    locked: isDateLocked(b) || requiresStepUp(b),
    dateLocked: isDateLocked(b),
    needsStepUp: requiresStepUp(b),
  };
}

export class BudgetController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const budgets = await prisma.budgetWallet.findMany({
        where: { userId: req.user!.id, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ budgets: budgets.map(progress) });
    } catch (e) { next(e); }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = await prisma.budgetWallet.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        include: { contributions: { orderBy: { createdAt: 'desc' }, take: 30 } },
      });
      if (!b) throw new AppError('Budget not found', 404);
      res.json({ budget: progress(b) });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const d = createSchema.parse(req.body);
      if ((d.lockType === 'DATE' || d.lockType === 'DATE_AND_STEP_UP') && !d.unlockDate) {
        throw new AppError('unlockDate is required for a date lock', 400);
      }
      const budget = await prisma.budgetWallet.create({
        data: {
          userId: req.user!.id,
          name: d.name.trim(),
          emoji: d.emoji,
          currency: d.currency as any,
          targetAmount: d.targetAmount ?? null,
          targetDate: d.targetDate ? new Date(d.targetDate) : null,
          lockType: d.lockType,
          unlockDate: d.unlockDate ? new Date(d.unlockDate) : null,
          autoEnabled: !!d.auto,
          autoAmount: d.auto?.amount ?? null,
          autoFrequency: (d.auto?.frequency as any) ?? null,
          autoSourceCurrency: (d.auto?.sourceCurrency as any) ?? null,
          nextRunAt: d.auto
            ? (d.auto.firstRunAt ? new Date(d.auto.firstRunAt) : computeNextRun(new Date(), d.auto.frequency))
            : null,
        },
      });
      res.status(201).json({ budget: progress(budget) });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const d = createSchema.partial().parse(req.body);
      const existing = await prisma.budgetWallet.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
      if (!existing) throw new AppError('Budget not found', 404);

      const budget = await prisma.budgetWallet.update({
        where: { id: existing.id },
        data: {
          name: d.name?.trim() ?? undefined,
          emoji: d.emoji ?? undefined,
          targetAmount: d.targetAmount ?? undefined,
          targetDate: d.targetDate ? new Date(d.targetDate) : undefined,
          lockType: d.lockType ?? undefined,
          unlockDate: d.unlockDate ? new Date(d.unlockDate) : undefined,
          ...(d.auto
            ? {
                autoEnabled: true,
                autoAmount: d.auto.amount,
                autoFrequency: d.auto.frequency as any,
                autoSourceCurrency: (d.auto.sourceCurrency as any) ?? undefined,
                nextRunAt: existing.nextRunAt ?? computeNextRun(new Date(), d.auto.frequency),
              }
            : {}),
        },
      });
      res.json({ budget: progress(budget) });
    } catch (e) { next(e); }
  }

  /** Pause/resume auto-contribution. */
  static async setAuto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      const b = await prisma.budgetWallet.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
      if (!b) throw new AppError('Budget not found', 404);
      const budget = await prisma.budgetWallet.update({
        where: { id: b.id },
        data: {
          autoEnabled: enabled,
          nextRunAt: enabled
            ? (b.nextRunAt ?? (b.autoFrequency ? computeNextRun(new Date(), b.autoFrequency) : null))
            : b.nextRunAt,
        },
      });
      res.json({ budget: progress(budget) });
    } catch (e) { next(e); }
  }

  static async contribute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
      const budget = await contribute(req.user!.id, req.params.id, amount, 'MANUAL');
      res.json({ budget: progress(budget) });
    } catch (e) { next(e); }
  }

  /**
   * Withdraw from a budget back to spendable. Enforces the lock:
   *  - DATE: blocked until unlockDate.
   *  - STEP_UP: requires a valid 6-digit step-up code (email/TOTP).
   *  - DATE_AND_STEP_UP: both.
   */
  static async withdraw(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, stepUpCode } = z.object({
        amount: z.number().positive().optional(),
        stepUpCode: z.string().regex(/^\d{6}$/).optional(),
      }).parse(req.body);

      const b = await prisma.budgetWallet.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
      if (!b) throw new AppError('Budget not found', 404);

      if (isDateLocked(b)) {
        throw new AppError(`Locked until ${new Date(b.unlockDate!).toISOString().slice(0, 10)}`, 403);
      }
      if (requiresStepUp(b)) {
        // No code yet → issue one and tell the client to prompt for it.
        if (!stepUpCode) {
          const { method } = await issueStepUp(req.user!.id, 'withdrawal');
          return res.status(401).json({ requiresStepUp: true, method });
        }
        await verifyStepUp(req.user!.id, 'withdrawal', stepUpCode);
      }

      const budget = await release(req.user!.id, req.params.id, amount);
      res.json({ budget: progress(budget) });
    } catch (e) { next(e); }
  }

  /** Close a budget: release all remaining funds (lock rules still apply), mark CLOSED. */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { stepUpCode } = z.object({ stepUpCode: z.string().regex(/^\d{6}$/).optional() }).parse(req.body ?? {});
      const b = await prisma.budgetWallet.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
      if (!b) throw new AppError('Budget not found', 404);

      if (Number(b.balance) > 0) {
        if (isDateLocked(b)) throw new AppError(`Locked until ${new Date(b.unlockDate!).toISOString().slice(0, 10)}`, 403);
        if (requiresStepUp(b)) {
          if (!stepUpCode) {
            const { method } = await issueStepUp(req.user!.id, 'withdrawal');
            return res.status(401).json({ requiresStepUp: true, method });
          }
          await verifyStepUp(req.user!.id, 'withdrawal', stepUpCode);
        }
        await release(req.user!.id, b.id);
      }
      await prisma.budgetWallet.update({ where: { id: b.id }, data: { status: 'CLOSED', autoEnabled: false } });
      res.json({ message: 'Budget closed' });
    } catch (e) { next(e); }
  }
}
