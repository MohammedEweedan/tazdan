/**
 * Recurring buy — scheduling + execution.
 *
 * A RecurringBuy is a standing order to buy a fixed fiat amount of an
 * asset on a fixed cadence. Execution reuses the exact same path a
 * manual buy uses: build a quote, then execute it. Funding:
 *
 *   • WALLET — the amount is quoted in the user's selected fiat currency and
 *     the engine debits that exact wallet at execution time.
 *   • CARD  — the schedule is recorded and the user is notified; an
 *     automated card charge requires the off-session Stripe flow which
 *     is provisioned separately. The wallet path is the fully-automated
 *     one today.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { buildQuote } from './exchange/priceEngine.service';
import { executeQuote } from './exchange/orderExecution.service';
import { pushTxEvent, pushCopy } from './push.service';
import type { RecurringFrequency } from '@prisma/client';

// Default network per asset — mirrors the mobile BuyWidget defaults so a
// recurring buy lands on the same chain a manual buy would.
const DEFAULT_NETWORK: Record<string, string> = {
  BTC: 'BTC', ETH: 'ERC20', SOL: 'SOL', USDT: 'ERC20', USDC: 'ERC20',
  BNB: 'BEP20', XRP: 'XRP', ADA: 'Cardano', DOGE: 'DOGE', TRX: 'TRON',
  LTC: 'LTC', MATIC: 'ERC20', DOT: 'DOT', AVAX: 'AVAX',
};

export function defaultNetwork(asset: string): string {
  return DEFAULT_NETWORK[asset.toUpperCase()] ?? asset.toUpperCase();
}

/** Compute the next run time from a base date and cadence. */
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

/**
 * Execute a single recurring buy now. Returns the created order, or
 * throws on failure (caller records lastError + bumps failureCount).
 */
export async function executeRecurringBuy(id: string) {
  const rb = await prisma.recurringBuy.findUnique({ where: { id } });
  if (!rb) throw new Error('Recurring buy not found');
  if (rb.status !== 'ACTIVE') throw new Error(`Recurring buy is ${rb.status}`);

  // CARD funding requires an off-session card charge that is not yet
  // wired end-to-end; we execute WALLET-funded buys against the engine.
  if (rb.sourceType === 'CARD') {
    throw new Error('Card-funded auto-buy requires off-session charge (not yet enabled)');
  }

  // The funding wallet is the user's chosen fiat currency. The quote amount is
  // expressed in that same currency, and the engine carries that settlement
  // currency through quote → execute → transaction. No hidden USDT default.
  const fundingCurrency = rb.sourceId || rb.fiatCurrency;

  const quote = await buildQuote({
    asset: rb.asset,
    network: rb.network,
    side: 'BUY',
    fiatAmount: (rb.fiatAmount as unknown as Decimal).toString(),
    settlementCurrency: fundingCurrency,
  });

  // Idempotency: one execution per (schedule, scheduled slot). Using the
  // nextRunAt epoch guarantees a retry within the same slot won't double-buy.
  const idempotencyKey = `rb_${rb.id}_${rb.nextRunAt.getTime()}`;

  const order = await executeQuote({
    userId: rb.userId,
    quoteId: quote.id,
    idempotencyKey,
    fundingCurrency,
  });

  // Notify the user their scheduled buy ran.
  try {
    const cryptoAmt = order.cryptoAmount.toString().replace(/\.?0+$/, '');
    await pushTxEvent(rb.userId, pushCopy.buy(cryptoAmt, order.asset), order.id);
  } catch { /* non-fatal */ }

  return order;
}

/**
 * Walk all due ACTIVE schedules and execute them. Called by the
 * scheduler tick. Each schedule advances its nextRunAt regardless of
 * success so a single failure doesn't wedge the loop; failures are
 * recorded and the schedule auto-pauses after repeated failures.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

/**
 * Start the recurring-buy scheduler. Ticks every minute, executes any
 * due schedules, and guards against overlapping runs (a slow tick won't
 * stack on top of the next). Idempotent — calling twice is a no-op.
 */
export function startRecurringBuyScheduler(intervalMs = 60_000): void {
  if (schedulerTimer) return;
  logger.info('[recurringBuy] scheduler started');
  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await runDueRecurringBuys();
    } catch (e) {
      logger.error('[recurringBuy] scheduler tick failed', { err: e });
    } finally {
      schedulerRunning = false;
    }
  };
  // Kick once shortly after boot, then on the interval.
  setTimeout(tick, 10_000);
  schedulerTimer = setInterval(tick, intervalMs);
}

export function stopRecurringBuyScheduler(): void {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

export async function runDueRecurringBuys(now: Date = new Date()): Promise<void> {
  const due = await prisma.recurringBuy.findMany({
    where: { status: 'ACTIVE', nextRunAt: { lte: now } },
    take: 100,
  });
  if (due.length === 0) return;

  logger.info(`[recurringBuy] executing ${due.length} due schedule(s)`);

  for (const rb of due) {
    const next = computeNextRun(rb.nextRunAt > now ? rb.nextRunAt : now, rb.frequency);
    try {
      await executeRecurringBuy(rb.id);
      await prisma.recurringBuy.update({
        where: { id: rb.id },
        data: {
          lastRunAt: now,
          nextRunAt: next,
          lastError: null,
          runCount: { increment: 1 },
          failureCount: 0,
        },
      });
    } catch (e: any) {
      const failures = rb.failureCount + 1;
      const shouldPause = failures >= MAX_CONSECUTIVE_FAILURES;
      logger.warn(`[recurringBuy] execution failed for ${rb.id}`, { err: e?.message, failures });
      await prisma.recurringBuy.update({
        where: { id: rb.id },
        data: {
          lastRunAt: now,
          nextRunAt: next,
          lastError: String(e?.message ?? e).slice(0, 500),
          failureCount: failures,
          status: shouldPause ? 'PAUSED' : undefined,
        },
      });
    }
  }
}
