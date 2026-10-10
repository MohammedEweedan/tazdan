/**
 * Reconciliation — first-class, automated, with an exception workflow.
 *
 * Provider reconciliation: a payout rail's statement is matched to internal
 * RemittancePayout records by provider reference. Each line becomes a
 * ReconciliationItem: MATCHED, MISSING_INTERNAL, MISSING_EXTERNAL,
 * AMOUNT_MISMATCH, CURRENCY_MISMATCH, FEE_MISMATCH, STATUS_MISMATCH,
 * DUPLICATE or LATE_SETTLEMENT. Fully matched paid transfers move
 * RECONCILIATION_PENDING → RECONCILED → COMPLETED.
 *
 * Internal integrity reconciliation checks the books against themselves:
 *   - ledger account cache vs Σ entries, and per-currency conservation
 *   - Wallet read model vs USER ledger balances
 *   - treasury pools vs the TREASURY ledger position
 *   - REMITTANCE_CLEARING vs Σ transfers funded but not paid or refunded
 *   - boundary postings vs their records (deposits, withdrawals, on-chain
 *     transactions, orders, treasury movements, payouts, adjustments) and
 *     unbacked value since the acknowledged baseline (fundIntegrity.service)
 *
 * Exceptions are resolved in the cockpit (resolveItem) with a note; nothing
 * is fixed by editing the database.
 */
import type { Prisma, RemittanceState } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { getPayoutProvider, listPayoutAdapters, adapterUsable } from '../providers/registry';
import { reconcileLedger } from '../ledger/reconcile.service';
import { auditFundIntegrity } from '../ledger/fundIntegrity.service';
import { transition } from '../remittance/stateMachine';
import { writeAudit } from '../platform/audit';

const D = (v: unknown) => new Decimal(String(v ?? 0));
type ItemInput = Omit<Prisma.ReconciliationItemCreateManyInput, 'runId'>;

export async function runProviderReconciliation(providerCode: string, from: Date, to: Date, actorId?: string | null) {
  const provider = getPayoutProvider(providerCode);
  const run = await prisma.reconciliationRun.create({ data: { source: 'PROVIDER_STATEMENT', providerCode, periodStart: from, periodEnd: to, startedById: actorId ?? null } });
  try {
    const statement = await provider.statement(from, to);
    const internal = await prisma.remittancePayout.findMany({
      where: { providerCode, OR: [{ submittedAt: { gte: from, lt: to } }, { createdAt: { gte: from, lt: to } }] },
      include: { transfer: { select: { id: true, reference: true, state: true, correlationId: true } } },
    });
    const byRef = new Map(internal.filter((p) => p.providerRef).map((p) => [p.providerRef!, p]));
    const seen = new Map<string, number>();
    const items: ItemInput[] = [];
    const matchedTransfers = new Set<string>();
    const slaMs = (provider.descriptor.terms?.slaMinutes ?? 60) * 60_000;

    for (const line of statement) {
      seen.set(line.providerRef, (seen.get(line.providerRef) ?? 0) + 1);
      if ((seen.get(line.providerRef) ?? 0) > 1) {
        items.push({ status: 'DUPLICATE', externalRef: line.providerRef, externalAmount: line.amount, currency: line.currency, details: { line } as any });
        continue;
      }
      const p = byRef.get(line.providerRef);
      if (!p) { items.push({ status: 'MISSING_INTERNAL', externalRef: line.providerRef, externalAmount: line.amount, currency: line.currency, details: { line } as any }); continue; }
      const base = { internalType: 'REMITTANCE_PAYOUT', internalId: p.id, externalRef: line.providerRef, internalAmount: p.amount, externalAmount: line.amount, currency: p.currency };
      const ref = { transferId: p.transfer.id, transferReference: p.transfer.reference };
      if (line.currency !== p.currency) { items.push({ ...base, status: 'CURRENCY_MISMATCH', details: { ...ref, internal: p.currency, external: line.currency } as any }); continue; }
      if (!D(line.amount).equals(D(p.amount).toDecimalPlaces(2))) { items.push({ ...base, status: 'AMOUNT_MISMATCH', details: { ...ref, difference: D(line.amount).minus(p.amount).toFixed(2) } as any }); continue; }
      const expectedFee = (await provider.quoteFee(p.amount.toString(), p.currency)).fee;
      if (!D(line.fee).equals(D(expectedFee))) { items.push({ ...base, status: 'FEE_MISMATCH', details: { ...ref, expectedFee, statementFee: line.fee } as any }); continue; }
      const internalStatus = p.status === 'SUBMITTED' || p.status === 'PENDING' ? 'SUBMITTED' : p.status;
      if (internalStatus !== line.status) {
        const late = line.status === 'SUBMITTED' && p.submittedAt && Date.now() - p.submittedAt.getTime() > slaMs * 2;
        items.push({ ...base, status: late ? 'LATE_SETTLEMENT' : 'STATUS_MISMATCH', details: { ...ref, internal: p.status, external: line.status } as any });
        continue;
      }
      items.push({ ...base, status: 'MATCHED', resolution: 'NOT_REQUIRED', details: { ...ref, status: line.status } as any });
      if (p.status === 'PAID') matchedTransfers.add(p.transfer.id);
    }
    const statementRefs = new Set(statement.map((l) => l.providerRef));
    for (const p of internal) {
      if (p.providerRef && !statementRefs.has(p.providerRef) && ['SUBMITTED', 'PAID'].includes(p.status)) {
        items.push({ status: 'MISSING_EXTERNAL', internalType: 'REMITTANCE_PAYOUT', internalId: p.id, externalRef: p.providerRef, internalAmount: p.amount, currency: p.currency, details: { internalStatus: p.status } as any });
      }
    }
    if (items.length) await prisma.reconciliationItem.createMany({ data: items.map((i) => ({ ...i, runId: run.id })) });

    // Advance fully matched transfers.
    let completed = 0;
    for (const transferId of matchedTransfers) {
      const t = await prisma.remittanceTransfer.findUnique({ where: { id: transferId } });
      if (!t || t.state !== 'RECONCILIATION_PENDING') continue;
      await prisma.$transaction(async (tx) => {
        const tr = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
        await transition(tx, tr, 'RECONCILED', { actorType: 'SYSTEM', reason: `Matched in reconciliation run ${run.id}`, provider: providerCode });
        await transition(tx, tr, 'COMPLETED', { actorType: 'SYSTEM', reason: 'Paid and reconciled' });
      }).then(() => { completed++; }).catch((err) => logger.warn('[recon] could not complete transfer', { transferId, err: (err as Error).message }));
    }
    const counts = items.reduce<Record<string, number>>((acc, i) => { acc[i.status as string] = (acc[i.status as string] ?? 0) + 1; return acc; }, {});
    return prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), totals: { statementLines: statement.length, internalPayouts: internal.length, ...counts, transfersCompleted: completed } } });
  } catch (err) {
    await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), totals: { error: (err as Error).message } } });
    throw err;
  }
}

export async function runIntegrityReconciliation(actorId?: string | null) {
  const run = await prisma.reconciliationRun.create({ data: { source: 'LEDGER_INTEGRITY', startedById: actorId ?? null } });
  const items: ItemInput[] = [];

  const ledger = await reconcileLedger();
  for (const d of ledger.cacheDrift) items.push({ status: 'AMOUNT_MISMATCH', internalType: 'LEDGER_ACCOUNT_CACHE', internalId: d.accountId, internalAmount: d.cached, externalAmount: d.derived, details: { diff: d.diff } as any });
  for (const c of ledger.conservation) items.push({ status: 'AMOUNT_MISMATCH', internalType: 'LEDGER_CONSERVATION', internalId: c.currency, currency: c.currency, internalAmount: c.sum, externalAmount: 0, details: { message: 'Signed sum of all entries is not zero' } as any });

  // Wallet read model vs USER ledger balance (enum currencies, platform/support excluded).
  const mismatches = await prisma.$queryRaw<Array<{ userId: string; currency: string; wallet: string; ledger: string }>>`
    SELECT w."userId", w."currency"::text AS currency, w."balance"::text AS wallet, COALESCE(a."balance", 0)::text AS ledger
    FROM "Wallet" w
    LEFT JOIN "LedgerAccount" a ON a."type" = 'USER' AND a."userId" = w."userId" AND a."currency" = w."currency"
    JOIN "User" u ON u."id" = w."userId"
    WHERE COALESCE(u."username", '') NOT IN ('platform', 'support')
      AND ABS(w."balance" - COALESCE(a."balance", 0)) > 0.000001
    LIMIT 500
  `;
  for (const m of mismatches) items.push({ status: 'AMOUNT_MISMATCH', internalType: 'WALLET_READ_MODEL', internalId: `${m.userId}:${m.currency}`, currency: m.currency, internalAmount: m.wallet, externalAmount: m.ledger, details: { meaning: 'Wallet balance differs from the USER ledger account' } as any });

  // Negative balances (impossible states).
  const negatives = await prisma.wallet.findMany({ where: { OR: [{ balance: { lt: 0 } }, { frozen: { lt: 0 } }] }, take: 200 });
  for (const w of negatives) items.push({ status: 'AMOUNT_MISMATCH', internalType: 'NEGATIVE_WALLET', internalId: w.id, currency: w.currency, internalAmount: w.balance, details: { frozen: w.frozen.toString() } as any });

  // Treasury pools vs ledger TREASURY position, in ONE statement (a payout
  // writes its CONSUME movement and its journal together; two separate reads
  // could straddle it). TREASURY also receives remittance principal (source
  // currency) at payout, which is not pool money. Pool-tracked legs are
  // exactly: treasury_* journals, the negative TREASURY leg of a payout (pool
  // consumed) and the positive TREASURY leg of a payout reversal (refilled).
  const treasury = await prisma.$queryRaw<Array<{ currency: string; pools: string; ledger: string }>>`
    WITH c AS (
      SELECT "currency"::text AS currency FROM "TreasuryPool"
      UNION SELECT "currency"::text FROM "LedgerAccount" WHERE "type" = 'TREASURY'
    )
    SELECT c.currency,
      COALESCE((
        SELECT SUM(CASE WHEN m."type" IN ('PREFUND', 'ADJUST_IN') THEN m."amount"
                        WHEN m."type" IN ('WITHDRAW', 'ADJUST_OUT', 'CONSUME') THEN -m."amount" ELSE 0 END)
        FROM "TreasuryMovement" m JOIN "TreasuryPool" p ON p."id" = m."poolId"
        WHERE p."currency"::text = c.currency
      ), 0)::text AS pools,
      COALESCE((
        SELECT SUM(e."amount") FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
        WHERE a."type" = 'TREASURY' AND e."currency"::text = c.currency
          AND (e."refType" LIKE 'treasury_%'
               OR (e."refType" = 'remittance_payout' AND e."amount" < 0)
               OR (e."refType" = 'remittance_payout_reversal' AND e."amount" > 0))
      ), 0)::text AS ledger
    FROM c
  `;
  for (const t of treasury) {
    if (!D(t.ledger).minus(D(t.pools)).abs().lte(new Decimal('0.01'))) {
      items.push({ status: 'AMOUNT_MISMATCH', internalType: 'TREASURY_POOLS', internalId: t.currency, currency: t.currency, internalAmount: D(t.pools).toFixed(2), externalAmount: D(t.ledger).toFixed(2), details: { meaning: 'Σ pool balances differs from the treasury ledger position for pool movements' } as any });
    }
  }

  // Remittance clearing vs open transfers, read in ONE statement so a transfer
  // funded or paid mid-check cannot appear as a break (same reason as CL-19).
  // A transfer in review before funding has no clearing balance yet.
  const clearing = await prisma.$queryRaw<Array<{ currency: string; balance: string; expected: string }>>`
    SELECT a."currency"::text AS currency, a."balance"::text AS balance,
           COALESCE((
             SELECT SUM(t."totalDebit") FROM "RemittanceTransfer" t
             WHERE t."sourceCurrency"::text = a."currency"::text
               AND t."state"::text IN ('FUNDED', 'MANUAL_REVIEW', 'ROUTING', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'PAYOUT_PENDING', 'FAILED', 'REFUND_PENDING', 'DISPUTED')
               AND (t."state"::text <> 'MANUAL_REVIEW'
                    OR EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."refType" = 'remittance_funding' AND e."refId" = t."id"))
           ), 0)::text AS expected
    FROM "LedgerAccount" a
    WHERE a."type" = 'REMITTANCE_CLEARING'
  `;
  for (const acct of clearing) {
    if (!D(acct.balance).minus(D(acct.expected)).abs().lte(new Decimal('0.001'))) {
      items.push({ status: 'AMOUNT_MISMATCH', internalType: 'REMITTANCE_CLEARING', internalId: acct.currency, currency: acct.currency, internalAmount: acct.balance, externalAmount: D(acct.expected).toFixed(), details: { meaning: 'Clearing balance differs from transfers funded but not yet paid or refunded' } as any });
    }
  }

  // Boundary postings vs their records, and value that entered unbacked.
  const funds = await auditFundIntegrity({ haltOnBreach: false });
  for (const r of funds.railExceptions) {
    const status = r.posted === null ? 'MISSING_INTERNAL' : r.recorded === null ? 'MISSING_EXTERNAL' : /not (CONFIRMED|COMPLETED)/.test(r.problem) ? 'STATUS_MISMATCH' : 'AMOUNT_MISMATCH';
    items.push({ status, internalType: `RAIL_${r.rail}`, internalId: r.refId ?? `${r.refType}:${r.currency}`, currency: r.currency, internalAmount: r.posted, externalAmount: r.recorded, details: { refType: r.refType, meaning: r.problem } as any });
  }
  for (const c of funds.perCurrency) {
    if (D(c.unbackedSinceBaseline).abs().gt(c.currency.match(/^(USD|EUR|GBP|AED|SAR|EGP|LYD|TRY|TND|USDT)$/) ? '0.01' : '0.0001')) {
      items.push({ status: 'MISSING_EXTERNAL', internalType: 'UNBACKED_VALUE', internalId: c.currency, currency: c.currency, internalAmount: c.unbackedSinceBaseline, externalAmount: 0, details: { meaning: c.baseline ? `Value entered with no external record since the baseline of ${c.baseline.at}` : 'Value entered with no external record; no baseline acknowledged yet', flows: c.flows.filter((f) => f.class === 'UNBACKED') } as any });
    }
  }

  const persisted = await persistIntegrityItems(run.id, items);
  return prisma.reconciliationRun.update({
    where: { id: run.id },
    data: { status: 'COMPLETED', completedAt: new Date(), totals: { exceptions: items.length, ...persisted, cacheDrift: ledger.cacheDrift.length, conservationBreaks: ledger.conservation.length, walletMismatches: mismatches.length, negativeWallets: negatives.length, railExceptions: funds.railExceptions.length } },
  });
}

/**
 * Integrity checks run on a schedule, so the same break would otherwise be
 * re-opened every run. A break that already has an open exception is not
 * duplicated; an OPEN exception whose break is no longer present is closed
 * with a note saying so (ESCALATED ones stay with the person handling them).
 */
async function persistIntegrityItems(runId: string, items: ItemInput[]) {
  const key = (i: { internalType?: string | null; internalId?: string | null; status: string }) => `${i.internalType}|${i.internalId}|${i.status}`;
  const open = await prisma.reconciliationItem.findMany({
    where: { run: { source: 'LEDGER_INTEGRITY' }, resolution: { in: ['OPEN', 'ESCALATED'] } },
    select: { id: true, internalType: true, internalId: true, status: true, resolution: true },
  });
  const openKeys = new Set(open.map(key));
  const fresh = items.filter((i) => !openKeys.has(key(i as any)));
  const present = new Set(items.map((i) => key(i as any)));
  const cleared = open.filter((o) => o.resolution === 'OPEN' && !present.has(key(o))).map((o) => o.id);
  if (fresh.length) await prisma.reconciliationItem.createMany({ data: fresh.map((i) => ({ ...i, runId })) });
  if (cleared.length) {
    await prisma.reconciliationItem.updateMany({
      where: { id: { in: cleared }, resolution: 'OPEN' },
      data: { resolution: 'RESOLVED', resolutionNote: `Cleared automatically: the break was not present in integrity run ${runId}`, resolvedAt: new Date() },
    });
  }
  return { newExceptions: fresh.length, stillOpen: items.length - fresh.length, autoCleared: cleared.length };
}

export async function resolveItem(itemId: string, resolution: 'RESOLVED' | 'WRITTEN_OFF' | 'ESCALATED', note: string, staffId: string, req?: { ip?: string; headers?: Record<string, any> }) {
  if (note.trim().length < 5) throw new AppError('A resolution note is required', 400);
  const item = await prisma.reconciliationItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Item not found', 404);
  if (item.resolution !== 'OPEN' && item.resolution !== 'ESCALATED') throw new AppError(`Item is already ${item.resolution}`, 409);
  const updated = await prisma.reconciliationItem.update({ where: { id: itemId }, data: { resolution, resolutionNote: note.trim(), resolvedById: staffId, resolvedAt: new Date() } });
  await writeAudit(prisma, { actorId: staffId, action: 'RECON_ITEM_RESOLVE', entity: 'ReconciliationItem', entityId: itemId, before: { resolution: item.resolution, status: item.status }, after: { resolution }, reason: note, req });
  return updated;
}

let timer: NodeJS.Timeout | null = null;
export function startReconciliationScheduler(intervalMs = Number(process.env.RECON_INTERVAL_MS ?? 30 * 60_000)) {
  if (timer) return;
  const tick = async () => {
    const to = new Date(); const from = new Date(Date.now() - 2 * 86400_000);
    for (const a of listPayoutAdapters()) {
      if (!adapterUsable(a) || a.descriptor.terms?.settlementModel === 'INTERNAL') continue;
      await runProviderReconciliation(a.descriptor.code, from, to).catch((e) => logger.warn('[recon] provider run failed', { code: a.descriptor.code, err: (e as Error).message }));
    }
    // Internal payouts (Tazdan wallet) reconcile against the ledger directly.
    await completeInternalPayouts().catch(() => undefined);
    await runIntegrityReconciliation().catch((e) => logger.warn('[recon] integrity run failed', { err: (e as Error).message }));
  };
  timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();
}

/** Tazdan-wallet payouts have no external statement: the posted ledger journal is the evidence. */
export async function completeInternalPayouts() {
  const pending = await prisma.remittanceTransfer.findMany({ where: { state: 'RECONCILIATION_PENDING', providerCode: 'TAZDAN_WALLET' }, take: 200 });
  for (const t of pending) {
    const posted = await prisma.ledgerEntry.count({ where: { refType: 'remittance_payout', refId: t.id } });
    if (!posted) continue;
    await prisma.$transaction(async (tx) => {
      const tr = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
      await transition(tx, tr, 'RECONCILED', { actorType: 'SYSTEM', reason: 'Internal payout: ledger journal verified', provider: 'TAZDAN_WALLET' });
      await transition(tx, tr, 'COMPLETED', { actorType: 'SYSTEM', reason: 'Paid and reconciled' });
    }).catch(() => undefined);
  }
}
