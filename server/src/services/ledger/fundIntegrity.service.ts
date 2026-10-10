/**
 * Fund-integrity audit — does every unit of value inside Tazdan trace back to
 * a real event at the boundary?
 *
 * Per ledger currency:
 *
 *   internalHeld   = customer wallets (Wallet rows; the platform and support
 *                    users excluded, their money is counted on the ledger)
 *                  + value Tazdan holds on internal ledger accounts (escrow,
 *                    remittance clearing, revenue, FX position, treasury,
 *                    partner settlement, suspense)
 *   enteredOutside = net value that crossed a boundary account (on-ramp,
 *                    off-ramp, chain/venue, operator adjustments)
 *   diff           = internalHeld − enteredOutside
 *
 * The database rejects unbalanced journals, so a non-zero diff means a Wallet
 * row moved without its journal (read-model drift) — never a rounding matter.
 *
 * Boundary flows are then classified by journal type:
 *   EVIDENCED — each posting has a record behind it (deposit, on-ramp
 *               transaction, withdrawal, on-chain transaction, treasury
 *               movement, remittance, card, approved adjustment). Postings
 *               whose record is missing or differs are listed as exceptions.
 *   TRADE     — buy/sell against the venue, or Tazdan as principal when the
 *               venue fill was simulated. Reported as the trading position.
 *   UNBACKED  — value that entered with no external record: opening balances
 *               backfilled from pre-ledger history, simulator seeds, legacy
 *               onboarding credits, earlier "credit reconciliations", or an
 *               unknown journal type. An authorised operator acknowledges the
 *               historical amount once, with a note (the baseline). Any
 *               unbacked flow after the baseline is a breach.
 *
 * The previous version compared Wallet sums with the Deposit and Withdrawal
 * tables only. Swaps, trades, fees credited to the platform in USDT, escrow,
 * referrals and remittances all moved value it could not see, so it reported
 * discrepancies that were artefacts of the formula (CL-47).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { setTradingHalt } from './reconcile.service';

const BOUNDARY: string[] = ['SYSTEM_ONRAMP', 'SYSTEM_OFFRAMP', 'SYSTEM_CHAIN', 'ADJUSTMENT'];
const TAZDAN_HELD: string[] = ['SYSTEM_ESCROW', 'REMITTANCE_CLEARING', 'PLATFORM', 'SYSTEM_FX', 'TREASURY', 'PARTNER_SETTLEMENT', 'SUSPENSE'];
/** Users whose Wallet rows are presentation only (their value is on the ledger). */
const HOUSE_USERNAMES: string[] = ['platform', 'support'];
const CRYPTO = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']);
const BASELINE_KEY = (currency: string) => `fund_audit_baseline.${currency}`;

export type FlowClass = 'EVIDENCED' | 'TRADE' | 'UNBACKED';

const EVIDENCED_TYPES = new Set([
  'deposit', 'withdrawal', 'onchain_deposit', 'onchain_withdrawal', 'onchain_withdrawal_refund',
  'remittance_payout', 'remittance_payout_reversal', 'card_topup', 'card_budget_load', 'adjustment',
]);

export function classifyFlow(refType: string): FlowClass {
  if (refType === 'buy' || refType === 'sell') return 'TRADE';
  if (EVIDENCED_TYPES.has(refType) || refType.startsWith('treasury_')) return 'EVIDENCED';
  return 'UNBACKED';
}

/** Rounding tolerance: Wallet rows keep 8 decimals, the ledger 18. */
function tolerance(currency: string): Decimal {
  return new Decimal(CRYPTO.has(currency) ? '0.0001' : '0.01');
}

const D = (v: unknown) => new Decimal(v == null ? 0 : String(v));

export interface FlowLine { refType: string; class: FlowClass; amount: string; postings: number }

export interface RailException {
  rail: 'DEPOSIT' | 'WITHDRAWAL' | 'ONCHAIN' | 'TRADE' | 'TREASURY' | 'REMITTANCE' | 'ADJUSTMENT';
  currency: string;
  refType: string;
  refId: string | null;
  posted: string | null;
  recorded: string | null;
  problem: string;
}

export interface Baseline { at: string; amount: string; by: string; note: string }

export interface CurrencyIntegrity {
  currency: string;
  /** Σ customer wallets + Tazdan-held ledger accounts. */
  internalHeld: string;
  /** Net value that crossed boundary accounts. */
  enteredOutside: string;
  /** internalHeld − enteredOutside; non-zero = wallet read-model drift. */
  diff: string;
  customerWallets: string;
  tazdanHeld: string;
  /** Net inflow by journal type (negative = net outflow). */
  flows: FlowLine[];
  /** Σ UNBACKED flows, all time. */
  unbacked: string;
  /** Σ UNBACKED flows posted after the acknowledged baseline (all time if none). */
  unbackedSinceBaseline: string;
  baseline: Baseline | null;
  /** Net trading position against the venue/principal (Σ TRADE flows). */
  tradingPosition: string;
  railExceptions: number;
  ok: boolean;
}

export interface FundIntegrityReport {
  checkedAt: number;
  ok: boolean;
  perCurrency: CurrencyIntegrity[];
  railExceptions: RailException[];
}

/**
 * Rail checks: every boundary posting has its record, with the same amount,
 * and every record completed since the rail started posting has a journal.
 * Records completed before a rail's first posting predate the ledger and are
 * covered by the opening-balance backfill.
 */
export async function railEvidenceExceptions(limit = 200): Promise<RailException[]> {
  const out: RailException[] = [];
  const push = (rows: any[], rail: RailException['rail'], problemFor: (r: any) => string) => {
    for (const r of rows) {
      out.push({
        rail, currency: r.currency, refType: r.refType, refId: r.refId ?? null,
        posted: r.posted ?? null, recorded: r.recorded ?? null, problem: problemFor(r),
      });
    }
  };

  // Deposits (bank deposit or card on-ramp) — SYSTEM_ONRAMP leg carries −amount.
  push(await prisma.$queryRaw<any[]>`
    SELECT e."refType", e."refId", e."currency"::text AS currency, (-e."amount")::text AS posted,
           COALESCE(d."amount", o."fiatAmount")::text AS recorded,
           d."status"::text AS dstatus, o."status"::text AS ostatus
    FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
    LEFT JOIN "Deposit" d ON d."id" = e."refId"
    LEFT JOIN "OnRampTransaction" o ON o."id" = e."refId"
    WHERE a."type" = 'SYSTEM_ONRAMP' AND e."refType" = 'deposit'
      AND (
        (d."id" IS NULL AND o."id" IS NULL)
        OR (d."id" IS NOT NULL AND (d."status" <> 'CONFIRMED' OR d."amount" <> -e."amount"))
        OR (d."id" IS NULL AND o."id" IS NOT NULL AND o."fiatAmount" <> -e."amount")
      )
    LIMIT ${limit}
  `, 'DEPOSIT', (r) => (r.recorded == null ? 'Posting has no deposit record'
    : r.dstatus && r.dstatus !== 'CONFIRMED' ? `Deposit is ${r.dstatus}, not CONFIRMED`
    : 'Posted amount differs from the record'));

  push(await prisma.$queryRaw<any[]>`
    SELECT 'deposit' AS "refType", d."id" AS "refId", d."currency"::text AS currency, NULL AS posted, d."amount"::text AS recorded
    FROM "Deposit" d
    WHERE d."status" = 'CONFIRMED'
      AND d."confirmedAt" >= (SELECT MIN(e."createdAt") FROM "LedgerEntry" e WHERE e."refType" = 'deposit')
      AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."refType" = 'deposit' AND e."refId" = d."id")
    LIMIT ${limit}
  `, 'DEPOSIT', () => 'Confirmed deposit has no journal');

  // Withdrawals — SYSTEM_OFFRAMP leg carries the net amount (amount − fee).
  push(await prisma.$queryRaw<any[]>`
    SELECT e."refType", e."refId", e."currency"::text AS currency, e."amount"::text AS posted,
           (w."amount" - w."fee")::text AS recorded, w."status"::text AS wstatus
    FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
    LEFT JOIN "Withdrawal" w ON w."id" = e."refId"
    WHERE a."type" = 'SYSTEM_OFFRAMP' AND e."refType" = 'withdrawal'
      AND (w."id" IS NULL OR w."status" <> 'COMPLETED' OR (w."amount" - w."fee") <> e."amount")
    LIMIT ${limit}
  `, 'WITHDRAWAL', (r) => (r.recorded == null ? 'Posting has no withdrawal record'
    : r.wstatus !== 'COMPLETED' ? `Withdrawal is ${r.wstatus}, not COMPLETED` : 'Posted amount differs from the record'));

  push(await prisma.$queryRaw<any[]>`
    SELECT 'withdrawal' AS "refType", w."id" AS "refId", w."currency"::text AS currency, NULL AS posted, w."amount"::text AS recorded
    FROM "Withdrawal" w
    WHERE w."status" = 'COMPLETED'
      AND w."processedAt" >= (SELECT MIN(e."createdAt") FROM "LedgerEntry" e WHERE e."refType" = 'withdrawal')
      AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."refType" = 'withdrawal' AND e."refId" = w."id")
    LIMIT ${limit}
  `, 'WITHDRAWAL', () => 'Completed withdrawal has no journal');

  // On-chain — the SYSTEM_CHAIN leg's absolute value equals the transaction amount.
  push(await prisma.$queryRaw<any[]>`
    SELECT e."refType", e."refId", e."currency"::text AS currency, ABS(e."amount")::text AS posted, t."amount"::text AS recorded
    FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
    LEFT JOIN "OnChainTransaction" t ON t."id" = e."refId"
    WHERE a."type" = 'SYSTEM_CHAIN' AND e."refType" IN ('onchain_deposit', 'onchain_withdrawal', 'onchain_withdrawal_refund')
      AND (t."id" IS NULL OR t."amount" <> ABS(e."amount"))
    LIMIT ${limit}
  `, 'ONCHAIN', (r) => (r.recorded == null ? 'Posting has no on-chain transaction' : 'Posted amount differs from the transaction'));

  // Trades, treasury, remittance payouts, adjustments — the record must exist.
  push(await prisma.$queryRaw<any[]>`
    SELECT DISTINCT e."refType", e."refId", e."currency"::text AS currency
    FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
    LEFT JOIN "CryptoOrder" o ON o."id" = e."refId"
    WHERE a."type" = 'SYSTEM_CHAIN' AND e."refType" IN ('buy', 'sell') AND o."id" IS NULL
    LIMIT ${limit}
  `, 'TRADE', () => 'Trade posting has no order');

  push(await prisma.$queryRaw<any[]>`
    SELECT DISTINCT e."refType", e."refId", e."currency"::text AS currency
    FROM "LedgerEntry" e
    LEFT JOIN "TreasuryMovement" m ON m."id" = e."refId"
    WHERE e."refType" LIKE 'treasury\\_%' AND m."id" IS NULL
    LIMIT ${limit}
  `, 'TREASURY', () => 'Treasury posting has no movement record');

  push(await prisma.$queryRaw<any[]>`
    SELECT DISTINCT e."refType", e."refId", e."currency"::text AS currency
    FROM "LedgerEntry" e
    LEFT JOIN "RemittanceTransfer" t ON t."id" = e."refId"
    WHERE e."refType" IN ('remittance_payout', 'remittance_payout_reversal') AND t."id" IS NULL
    LIMIT ${limit}
  `, 'REMITTANCE', () => 'Payout posting has no transfer');

  push(await prisma.$queryRaw<any[]>`
    SELECT DISTINCT e."refType", e."refId", e."currency"::text AS currency
    FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
    WHERE a."type" = 'ADJUSTMENT' AND e."refType" = 'adjustment'
      AND NOT EXISTS (SELECT 1 FROM "Transaction" t WHERE t."reference" = e."refId" AND t."type" IN ('ADMIN_CREDIT', 'ADMIN_DEBIT'))
    LIMIT ${limit}
  `, 'ADJUSTMENT', () => 'Adjustment posting has no customer history row');

  return out;
}

async function loadBaselines(): Promise<Map<string, Baseline>> {
  const rows = await prisma.platformSettings.findMany({ where: { key: { startsWith: 'fund_audit_baseline.' } } });
  const map = new Map<string, Baseline>();
  for (const r of rows) {
    try { map.set(r.key.slice('fund_audit_baseline.'.length), JSON.parse(r.value)); } catch { /* ignore malformed */ }
  }
  return map;
}

/**
 * Run the audit. Read-only, except that `haltOnBreach` sets the trading halt
 * when a currency shows read-model drift or unbacked value since its baseline.
 * Rail exceptions do not halt; they go to the reconciliation queue.
 */
export async function auditFundIntegrity(opts: { haltOnBreach?: boolean } = {}): Promise<FundIntegrityReport> {
  const [wallets, held, flows, baselines, rail] = await Promise.all([
    prisma.$queryRaw<Array<{ currency: string; total: string }>>`
      SELECT w."currency"::text AS currency, SUM(w."balance")::text AS total
      FROM "Wallet" w JOIN "User" u ON u."id" = w."userId"
      WHERE NOT (COALESCE(u."username", '') = ANY(${HOUSE_USERNAMES}))
      GROUP BY 1
    `,
    // Tazdan-held = internal accounts + any USER accounts of the house users.
    prisma.$queryRaw<Array<{ currency: string; total: string }>>`
      SELECT a."currency"::text AS currency, SUM(a."balance")::text AS total
      FROM "LedgerAccount" a LEFT JOIN "User" u ON u."id" = a."userId"
      WHERE a."type"::text = ANY(${TAZDAN_HELD})
         OR (a."type" = 'USER' AND COALESCE(u."username", '') = ANY(${HOUSE_USERNAMES}))
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ currency: string; refType: string; total: string; n: bigint; latest: Date }>>`
      SELECT e."currency"::text AS currency, e."refType", (-SUM(e."amount"))::text AS total, COUNT(*) AS n, MAX(e."createdAt") AS latest
      FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
      WHERE a."type"::text = ANY(${BOUNDARY})
      GROUP BY 1, 2
    `,
    loadBaselines(),
    railEvidenceExceptions(),
  ]);

  const currencies = new Set<string>([...wallets.map((w) => w.currency), ...held.map((h) => h.currency), ...flows.map((f) => f.currency)]);
  const perCurrency: CurrencyIntegrity[] = [];

  for (const c of [...currencies].sort()) {
    const customer = D(wallets.find((w) => w.currency === c)?.total);
    const tazdan = D(held.find((h) => h.currency === c)?.total);
    const lines = flows.filter((f) => f.currency === c);
    const entered = lines.reduce((s, f) => s.plus(D(f.total)), new Decimal(0));
    const internal = customer.plus(tazdan);
    const diff = internal.minus(entered);

    const baseline = baselines.get(c) ?? null;
    let unbacked = new Decimal(0);
    let trading = new Decimal(0);
    for (const f of lines) {
      const cls = classifyFlow(f.refType);
      if (cls === 'UNBACKED') unbacked = unbacked.plus(D(f.total));
      if (cls === 'TRADE') trading = trading.plus(D(f.total));
    }
    // Unbacked flow after the baseline: only computed per entry when needed.
    let since = unbacked;
    if (baseline) {
      const unbackedTypes = lines.filter((f) => classifyFlow(f.refType) === 'UNBACKED' && new Date(f.latest) > new Date(baseline.at)).map((f) => f.refType);
      since = new Decimal(0);
      if (unbackedTypes.length) {
        const rows = await prisma.$queryRaw<Array<{ total: string | null }>>`
          SELECT (-SUM(e."amount"))::text AS total
          FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
          WHERE a."type"::text = ANY(${BOUNDARY})
            AND e."currency"::text = ${c}
            -- createdAt is stored as UTC without a zone; compare in UTC whatever the session zone is.
            AND e."createdAt" > (${baseline.at}::timestamptz AT TIME ZONE 'UTC')
            AND e."refType" = ANY(${unbackedTypes})
        `;
        since = D(rows[0]?.total);
      }
    }

    const tol = tolerance(c);
    const railCount = rail.filter((r) => r.currency === c).length;
    perCurrency.push({
      currency: c,
      internalHeld: internal.toString(),
      enteredOutside: entered.toString(),
      diff: diff.toString(),
      customerWallets: customer.toString(),
      tazdanHeld: tazdan.toString(),
      flows: lines
        .map((f) => ({ refType: f.refType, class: classifyFlow(f.refType), amount: D(f.total).toString(), postings: Number(f.n) }))
        .sort((a, b) => D(b.amount).abs().comparedTo(D(a.amount).abs())),
      unbacked: unbacked.toString(),
      unbackedSinceBaseline: since.toString(),
      baseline,
      tradingPosition: trading.toString(),
      railExceptions: railCount,
      ok: diff.abs().lte(tol) && since.abs().lte(tol) && railCount === 0,
    });
  }

  const ok = perCurrency.every((p) => p.ok);
  const halting = perCurrency.filter((p) => D(p.diff).abs().gt(tolerance(p.currency)) || D(p.unbackedSinceBaseline).abs().gt(tolerance(p.currency)));
  if (halting.length && opts.haltOnBreach) {
    await setTradingHalt(true, `fund integrity breach: ${halting.map((b) => `${b.currency} drift ${b.diff}, unbacked since baseline ${b.unbackedSinceBaseline}`).join('; ')}`);
    logger.error('[fund-integrity] BREACH — trading halted', { breaches: halting.map((h) => ({ currency: h.currency, diff: h.diff, unbackedSinceBaseline: h.unbackedSinceBaseline })) });
  } else if (!ok) {
    logger.warn('[fund-integrity] exceptions found', {
      currencies: perCurrency.filter((p) => !p.ok).map((p) => ({ currency: p.currency, diff: p.diff, unbackedSinceBaseline: p.unbackedSinceBaseline, railExceptions: p.railExceptions })),
    });
  }

  return { checkedAt: Date.now(), ok, perCurrency, railExceptions: rail };
}

/**
 * Acknowledge the historical unbacked amount for one currency after it has
 * been investigated. Moves no money: it records who looked, what they found
 * and when, so later unbacked flows stand out. Refuses while the currency
 * shows read-model drift (that must be fixed, not acknowledged).
 */
export async function acknowledgeBaseline(opts: {
  currency: string;
  staffId: string;
  note: string;
  req?: { ip?: string; headers?: Record<string, any> };
}): Promise<{ currency: string; acknowledgedAmount: string; unbackedSinceBaseline: string; baseline: Baseline }> {
  const currency = opts.currency.toUpperCase();
  const note = opts.note.trim();
  if (note.length < 10) throw new AppError('Write what was found (at least 10 characters)', 400);

  const report = await auditFundIntegrity({ haltOnBreach: false });
  const row = report.perCurrency.find((p) => p.currency === currency);
  if (!row) throw new AppError(`No ledger activity for ${currency}`, 404);
  if (D(row.diff).abs().gt(tolerance(currency))) {
    throw new AppError(`${currency} wallets differ from the ledger by ${row.diff}. Fix the drift before acknowledging history.`, 409);
  }

  const before = row.baseline;
  const baseline: Baseline = { at: new Date().toISOString(), amount: row.unbacked, by: opts.staffId, note };
  await prisma.$transaction(async (tx) => {
    await tx.platformSettings.upsert({
      where: { key: BASELINE_KEY(currency) },
      create: { key: BASELINE_KEY(currency), value: JSON.stringify(baseline), description: 'Acknowledged unbacked value (fund-integrity audit)', updatedBy: opts.staffId },
      update: { value: JSON.stringify(baseline), updatedBy: opts.staffId },
    });
    await writeAudit(tx as any, {
      actorId: opts.staffId,
      action: 'FUND_BASELINE_ACKNOWLEDGED',
      entity: 'FundIntegrity',
      entityId: currency,
      before: before ?? undefined,
      after: { ...baseline, flows: row.flows.filter((f) => f.class === 'UNBACKED') },
      reason: note,
      req: opts.req,
    });
  });
  logger.info('[fund-integrity] baseline acknowledged', { currency, amount: row.unbacked, by: opts.staffId });
  return { currency, acknowledgedAmount: row.unbacked, unbackedSinceBaseline: '0', baseline };
}

let started = false;
/** Start periodic fund-integrity auditing (one worker only). */
export function startFundIntegrityAudit(intervalMs = Number(process.env.FUND_AUDIT_MS ?? 10 * 60_000)): void {
  if (started) return;
  started = true;
  // Halt-on-breach is opt-in (FUND_AUDIT_HALT=1). Turn it on in production
  // once each currency's history has been acknowledged.
  const haltOnBreach = process.env.FUND_AUDIT_HALT === '1';
  setInterval(() => {
    void auditFundIntegrity({ haltOnBreach }).catch((e) => logger.error('[fund-integrity] audit threw', { err: e }));
  }, intervalMs).unref?.();
  logger.info('[fund-integrity] audit scheduler started');
}
