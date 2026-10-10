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
let _haltedAt = 0;
const HALT_MEMO_MS = 5_000;

export interface ReconcileResult {
  ok: boolean;
  checkedAt: number;
  cacheDrift: { accountId: string; cached: string; derived: string; diff: string }[];
  conservation: { currency: string; sum: string }[]; // non-zero currencies only
}

/** Full reconciliation pass. Read-only except for setting the halt flag. */
export async function reconcileLedger(): Promise<ReconcileResult> {
  // 1) Cache integrity — compare each account's cached balance to entry sum.
  // One statement = one snapshot. Reading accounts and entry sums in two
  // queries let a posting that committed in between look like drift — and
  // drift halts trading — so under live traffic the check could stop the
  // platform for nothing.
  const drift = await prisma.$queryRaw<Array<{ id: string; cached: string; derived: string }>>`
    SELECT a."id", a."balance"::text AS cached, COALESCE(s.total, 0)::text AS derived
    FROM "LedgerAccount" a
    LEFT JOIN (SELECT "accountId", SUM("amount") AS total FROM "LedgerEntry" GROUP BY "accountId") s ON s."accountId" = a."id"
    WHERE ABS(a."balance" - COALESCE(s.total, 0)) > ${EPS.toString()}::numeric
  `;
  const cacheDrift: ReconcileResult['cacheDrift'] = drift.map((d) => {
    const cached = new Decimal(d.cached); const derived = new Decimal(d.derived);
    return { accountId: d.id, cached: cached.toString(), derived: derived.toString(), diff: cached.minus(derived).toString() };
  });

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
  _haltedAt = Date.now();
  await prisma.platformSettings.upsert({
    where: { key: HALT_KEY },
    update: { value: halted ? '1' : '0', description: reason ?? 'ledger trading halt' },
    create: { key: HALT_KEY, value: halted ? '1' : '0', description: reason ?? 'ledger trading halt' },
  }).catch(() => { /* non-fatal — memo flag still protects this instance */ });
}

/**
 * The halt is shared through the database. Each process re-reads it every few
 * seconds, so a halt set by the scheduler worker (or lifted from the console
 * by another process or a script) reaches every API process promptly. If the
 * read fails, the last known value stands.
 */
export async function isTradingHalted(): Promise<boolean> {
  if (_haltedMemo !== null && Date.now() - _haltedAt < HALT_MEMO_MS) return _haltedMemo;
  const row = await prisma.platformSettings.findUnique({ where: { key: HALT_KEY } }).catch(() => undefined);
  if (row !== undefined) { _haltedMemo = row?.value === '1'; _haltedAt = Date.now(); }
  return _haltedMemo ?? false;
}

let started = false;
/** Start periodic reconciliation (one worker only). Default every 5 min. */
export function startReconciliation(intervalMs = Number(process.env.LEDGER_RECONCILE_MS ?? 5 * 60_000)): void {
  if (started) return;
  started = true;
  setInterval(() => { void reconcileLedger().catch((e) => logger.error('[ledger] reconcile threw', { err: e })); }, intervalMs).unref?.();
  logger.info('[ledger] reconciliation scheduler started');
}
