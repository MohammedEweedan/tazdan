/**
 * Ledger reconciliation + trading halt.
 *
 * Two checks:
 *   1. CACHE INTEGRITY — every LedgerAccount.balance must equal the sum of its
 *      entries. A mismatch means a balance was mutated outside postLedger() or
 *      a write was lost; the cache is not trustworthy.
 *   2. GLOBAL CONSERVATION — for each currency, the signed sum of ALL entries
 *      must be ~0. The whole ledger is closed: every user credit is matched by
 *      a system/platform debit. Non-zero ⇒ money was created or destroyed.
 *
 * On any drift we set an in-memory + persisted halt flag. The exchange/quote
 * paths check `isTradingHalted()` and refuse new orders until an admin clears
 * it after investigation. Better to stop trading than to keep compounding a
 * discrepancy you can't explain — the cardinal rule of running a money system.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

const HALT_KEY = 'ledger_trading_halt';
const EPS = new Decimal('0.000001'); // 1e-6 tolerance on aggregate sums

let _haltedMemo: boolean | null = null;

export interface ReconcileResult {
  ok: boolean;
  checkedAt: number;
  cacheDrift: { accountId: string; cached: string; derived: string; diff: string }[];
  conservation: { currency: string; sum: string }[]; // non-zero currencies only
}

/** Full reconciliation pass. Read-only except for setting the halt flag. */
export async function reconcileLedger(): Promise<ReconcileResult> {
  // 1) Cache integrity — compare each account's cached balance to entry sum.
  const accounts = await prisma.ledgerAccount.findMany({ select: { id: true, balance: true } });
  const sums = await prisma.ledgerEntry.groupBy({ by: ['accountId'], _sum: { amount: true } });
  const sumByAccount = new Map(sums.map((s) => [s.accountId, new Decimal((s._sum.amount ?? 0).toString())]));

  const cacheDrift: ReconcileResult['cacheDrift'] = [];
  for (const a of accounts) {
    const derived = sumByAccount.get(a.id) ?? new Decimal(0);
    const cached = new Decimal(a.balance.toString());
    if (cached.minus(derived).abs().gt(EPS)) {
      cacheDrift.push({ accountId: a.id, cached: cached.toString(), derived: derived.toString(), diff: cached.minus(derived).toString() });
    }
  }

  // 2) Global conservation — signed entry sum per currency must be ~0.
  const byCurrency = await prisma.ledgerEntry.groupBy({ by: ['currency'], _sum: { amount: true } });
  const conservation: ReconcileResult['conservation'] = [];
  for (const c of byCurrency) {
    const sum = new Decimal((c._sum.amount ?? 0).toString());
    if (sum.abs().gt(EPS)) conservation.push({ currency: c.currency, sum: sum.toString() });
  }

  const ok = cacheDrift.length === 0 && conservation.length === 0;
  if (!ok) {
    await setTradingHalt(true, `reconcile failed: ${cacheDrift.length} cache drifts, ${conservation.length} conservation breaks`);
    logger.error('[ledger] RECONCILIATION FAILED — trading halted', { cacheDrift, conservation });
  }
  return { ok, checkedAt: Date.now(), cacheDrift, conservation };
}

export async function setTradingHalt(halted: boolean, reason?: string): Promise<void> {
  _haltedMemo = halted;
  await prisma.platformSettings.upsert({
    where: { key: HALT_KEY },
    update: { value: halted ? '1' : '0', description: reason ?? 'ledger trading halt' },
    create: { key: HALT_KEY, value: halted ? '1' : '0', description: reason ?? 'ledger trading halt' },
  }).catch(() => { /* non-fatal — memo flag still protects this instance */ });
}

export async function isTradingHalted(): Promise<boolean> {
  if (_haltedMemo !== null) return _haltedMemo;
  const row = await prisma.platformSettings.findUnique({ where: { key: HALT_KEY } }).catch(() => null);
  _haltedMemo = row?.value === '1';
  return _haltedMemo;
}

let started = false;
/** Start periodic reconciliation (one worker only). Default every 5 min. */
export function startReconciliation(intervalMs = Number(process.env.LEDGER_RECONCILE_MS ?? 5 * 60_000)): void {
  if (started) return;
  started = true;
  setInterval(() => { void reconcileLedger().catch((e) => logger.error('[ledger] reconcile threw', { err: e })); }, intervalMs).unref?.();
  logger.info('[ledger] reconciliation scheduler started');
}
