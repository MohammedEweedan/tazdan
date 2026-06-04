/**
 * Budget Wallets — named savings goals.
 *
 * Money model: contributing to a budget moves funds from the user's SPENDABLE
 * balance into the budget by incrementing `Wallet.frozen` (the funds still live
 * on the user's wallet, just reclassified as not-spendable) AND `BudgetWallet.
 * balance`. Net spendable = balance - frozen, which the rest of the app already
 * honours, so this is conservation-safe with no new money created or destroyed.
 * Releasing (withdraw/close) reverses it. Every move writes a Transaction audit
 * row. Auto-contributions run on a minute scheduler that mirrors recurringBuy.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import type { RecurringFrequency } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

/** Next run time for an auto-contribution cadence (same rules as recurringBuy). */
export function computeNextRun(from: Date, frequency: RecurringFrequency): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'DAILY':    d.setDate(d.getDate() + 1); break;
    case 'WEEKLY':   d.setDate(d.getDate() + 7); break;
    case 'BIWEEKLY': d.setDate(d.getDate() + 14); break;
    case 'MONTHLY':  d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

/** Spendable = balance - frozen for the given user+currency (0 if no wallet). */
async function spendable(tx: any, userId: string, currency: string): Promise<Decimal> {
  const w = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency } } });
  if (!w) return new Decimal(0);
  return new Decimal(w.balance).sub(new Decimal(w.frozen));
}

/**
 * Move `amount` from the user's spendable wallet INTO the budget (freeze it).
 * Throws if spendable < amount. Marks the budget COMPLETED when the target is
 * reached. Returns the updated budget.
 */
export async function contribute(
  userId: string,
  budgetId: string,
  amount: Decimal | number | string,
  kind: 'MANUAL' | 'AUTO' = 'MANUAL',
) {
  const amt = new Decimal(amount);
  if (amt.lte(0)) throw new AppError('Amount must be positive', 400);

  return prisma.$transaction(async (tx: any) => {
    const budget = await tx.budgetWallet.findFirst({ where: { id: budgetId, userId } });
    if (!budget) throw new AppError('Budget not found', 404);
    if (budget.status === 'CLOSED') throw new AppError('Budget is closed', 400);

    const avail = await spendable(tx, userId, budget.currency);
    if (avail.lt(amt)) throw new AppError(`Insufficient ${budget.currency} balance`, 400);

    const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: budget.currency } } });
    const balanceBefore = new Decimal(wallet.balance);

    // Reclassify spendable → frozen (total wallet balance is unchanged).
    await tx.wallet.update({
      where: { userId_currency: { userId, currency: budget.currency } },
      data: { frozen: { increment: amt } },
    });

    const newBudgetBalance = new Decimal(budget.balance).add(amt);
    const reachedTarget = budget.targetAmount != null && newBudgetBalance.gte(new Decimal(budget.targetAmount));

    const updated = await tx.budgetWallet.update({
      where: { id: budget.id },
      data: {
        balance: newBudgetBalance,
        status: reachedTarget ? 'COMPLETED' : budget.status,
      },
    });
    await tx.budgetContribution.create({ data: { budgetId: budget.id, amount: amt, kind } });
    await tx.transaction.create({
      data: {
        userId, type: 'BUDGET_CONTRIBUTION', currency: budget.currency, amount: amt,
        balanceBefore, balanceAfter: balanceBefore, // total unchanged; frozen moved
        description: `Saved to budget "${budget.name}"`,
      },
    });
    return updated;
  });
}

/**
 * Release `amount` (or all remaining if omitted) from the budget back to
 * spendable. Caller MUST have already enforced the lock (date / step-up).
 */
export async function release(
  userId: string,
  budgetId: string,
  amount?: Decimal | number | string,
) {
  return prisma.$transaction(async (tx: any) => {
    const budget = await tx.budgetWallet.findFirst({ where: { id: budgetId, userId } });
    if (!budget) throw new AppError('Budget not found', 404);

    const have = new Decimal(budget.balance);
    const amt = amount != null ? new Decimal(amount) : have;
    if (amt.lte(0)) throw new AppError('Amount must be positive', 400);
    if (amt.gt(have)) throw new AppError('Amount exceeds budget balance', 400);

    const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: budget.currency } } });
    const balanceBefore = new Decimal(wallet.balance);

    await tx.wallet.update({
      where: { userId_currency: { userId, currency: budget.currency } },
      data: { frozen: { decrement: amt } },
    });
    const updated = await tx.budgetWallet.update({
      where: { id: budget.id },
      data: { balance: have.sub(amt) },
    });
    await tx.budgetContribution.create({ data: { budgetId: budget.id, amount: amt.neg(), kind: 'WITHDRAWAL' } });
    await tx.transaction.create({
      data: {
        userId, type: 'BUDGET_RELEASE', currency: budget.currency, amount: amt,
        balanceBefore, balanceAfter: balanceBefore,
        description: `Released from budget "${budget.name}"`,
      },
    });
    return updated;
  });
}

/** True when the budget's lock currently blocks a withdrawal. */
export function isDateLocked(budget: { lockType: string; unlockDate: Date | null }, now = new Date()): boolean {
  if (budget.lockType !== 'DATE' && budget.lockType !== 'DATE_AND_STEP_UP') return false;
  return !!budget.unlockDate && now < new Date(budget.unlockDate);
}
export function requiresStepUp(budget: { lockType: string }): boolean {
  return budget.lockType === 'STEP_UP' || budget.lockType === 'DATE_AND_STEP_UP';
}

/* ── Auto-contribution scheduler (mirrors recurringBuy) ──────────────── */

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

export function startBudgetScheduler(intervalMs = 60_000): void {
  if (schedulerTimer) return;
  logger.info('[budget] auto-contribution scheduler started');
  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try { await runDueBudgets(); }
    catch (e) { logger.error('[budget] scheduler tick failed', { err: e }); }
    finally { schedulerRunning = false; }
  };
  setTimeout(tick, 12_000);
  schedulerTimer = setInterval(tick, intervalMs);
}

export function stopBudgetScheduler(): void {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

export async function runDueBudgets(now: Date = new Date()): Promise<void> {
  const due = await prisma.budgetWallet.findMany({
    where: { status: 'ACTIVE', autoEnabled: true, nextRunAt: { lte: now } },
    take: 100,
  });
  if (due.length === 0) return;
  logger.info(`[budget] running ${due.length} due auto-contribution(s)`);

  for (const b of due) {
    const base = b.nextRunAt && b.nextRunAt > now ? b.nextRunAt : now;
    const next = b.autoFrequency ? computeNextRun(base, b.autoFrequency) : null;
    try {
      if (b.autoAmount && new Decimal(b.autoAmount).gt(0)) {
        await contribute(b.userId, b.id, new Decimal(b.autoAmount), 'AUTO');
      }
      await prisma.budgetWallet.update({
        where: { id: b.id },
        data: { lastRunAt: now, nextRunAt: next, lastError: null },
      });
    } catch (e: any) {
      // Insufficient funds etc. — skip this cycle, keep the schedule going.
      logger.warn(`[budget] auto-contribution skipped for ${b.id}`, { err: e?.message });
      await prisma.budgetWallet.update({
        where: { id: b.id },
        data: { lastRunAt: now, nextRunAt: next, lastError: String(e?.message ?? e).slice(0, 300) },
      });
    }
  }
}
