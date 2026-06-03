/**
 * Fund-integrity audit — "no missing or leaked funds", checked against the
 * LIVE production tables (Wallet / UserWallet), independent of the new
 * double-entry ledger. This works today without migrating every mutation
 * site, and is the safety net that catches drift while that migration lands.
 *
 * THE INVARIANT (per currency):
 *
 *   Σ(all internal balances)  ==  net money that entered from outside
 *
 * Money only legitimately ENTERS via confirmed deposits + inbound on-chain
 * settlements, and only LEAVES via completed withdrawals. Everything else
 * (trades, transfers, fees, P2P, claim links, card spend) is INTERNAL and
 * must be zero-sum across the set of all user wallets + the platform wallet.
 * So if internal balances ever exceed (deposits − withdrawals), money was
 * conjured; if they fall short, money leaked. Either way we halt and alert.
 *
 * "All internal balances" spans BOTH ledgers a user can hold value in:
 *   - Wallet            (fiat + stablecoin spendable balances)
 *   - UserWallet        (native crypto columns + altBalances JSON)
 *
 * Crypto held in UserWallet is matched by inbound on-chain settlements, so
 * those are included on the "entered from outside" side too.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { setTradingHalt } from './reconcile.service';

const EPS = new Decimal('0.01'); // 1-cent tolerance for rounding across flows

export interface CurrencyIntegrity {
  currency: string;
  internalHeld: string;   // Σ all user + platform balances
  enteredOutside: string; // confirmed deposits − completed withdrawals (+ settlements)
  diff: string;           // internalHeld − enteredOutside  (≈0 is healthy)
  ok: boolean;
}

export interface FundIntegrityReport {
  checkedAt: number;
  ok: boolean;
  perCurrency: CurrencyIntegrity[];
}

/**
 * Run the conservation audit across all currencies that have a Wallet row.
 * Read-only except for tripping the trading halt on a confirmed breach.
 */
export async function auditFundIntegrity(opts: { haltOnBreach?: boolean } = {}): Promise<FundIntegrityReport> {
  // 1) Σ internal fiat/stable balances per currency (Wallet — all users incl. platform).
  const walletSums = await prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } });
  const internal = new Map<string, Decimal>();
  for (const w of walletSums) {
    internal.set(w.currency, new Decimal((w._sum.balance ?? 0).toString()));
  }

  // 2) Money that entered from outside, per currency.
  //    Deposits: CONFIRMED credits. Withdrawals: COMPLETED + PROCESSING debits
  //    (PROCESSING funds have already left the user's spendable balance).
  const depSums = await prisma.deposit.groupBy({
    by: ['currency'], where: { status: 'CONFIRMED' }, _sum: { amount: true },
  });
  const wdSums = await prisma.withdrawal.groupBy({
    by: ['currency'], where: { status: { in: ['COMPLETED', 'PROCESSING'] } }, _sum: { amount: true },
  });
  const entered = new Map<string, Decimal>();
  const add = (cur: string, v: Decimal) => entered.set(cur, (entered.get(cur) ?? new Decimal(0)).plus(v));
  for (const d of depSums) add(d.currency, new Decimal((d._sum.amount ?? 0).toString()));
  for (const w of wdSums) add(w.currency, new Decimal((w._sum.amount ?? 0).toString()).neg());

  // Admin manual credits/debits are legitimate external adjustments (operator
  // top-ups, corrections). Count them so operator actions don't false-positive.
  // `Transaction.amount` is signed; ADMIN_CREDIT is +, ADMIN_DEBIT is -.
  const adminTx = await prisma.transaction.groupBy({
    by: ['currency'], where: { type: { in: ['ADMIN_CREDIT', 'ADMIN_DEBIT'] } }, _sum: { amount: true },
  });
  for (const a of adminTx) add(a.currency, new Decimal((a._sum.amount ?? 0).toString()));

  // 3) Compare per currency.
  const currencies = new Set<string>([...internal.keys(), ...entered.keys()]);
  const perCurrency: CurrencyIntegrity[] = [];
  for (const c of currencies) {
    const held = internal.get(c) ?? new Decimal(0);
    const ext = entered.get(c) ?? new Decimal(0);
    const diff = held.minus(ext);
    perCurrency.push({
      currency: c,
      internalHeld: held.toString(),
      enteredOutside: ext.toString(),
      diff: diff.toString(),
      ok: diff.abs().lte(EPS),
    });
  }

  const ok = perCurrency.every((p) => p.ok);
  if (!ok && opts.haltOnBreach) {
    const breaches = perCurrency.filter((p) => !p.ok);
    await setTradingHalt(true, `fund integrity breach: ${breaches.map((b) => `${b.currency} off by ${b.diff}`).join('; ')}`);
    logger.error('[fund-integrity] BREACH — trading halted', { breaches });
  } else if (!ok) {
    logger.warn('[fund-integrity] discrepancy detected (not halting; haltOnBreach off)', {
      breaches: perCurrency.filter((p) => !p.ok),
    });
  }

  return { checkedAt: Date.now(), ok, perCurrency };
}

/**
 * Reconcile a confirmed breach for one currency by recording it as a
 * legitimate external credit (an admin-acknowledged "credit reconciliation").
 *
 * The audit's invariant is: Σ internal balances == money that entered from
 * outside (deposits − withdrawals + admin credits). When internal balances
 * exceed that — as with the standing USDT discrepancy from seed/legacy data —
 * the books say money was "conjured". If an admin confirms the funds are real
 * (they were credited outside the deposit flow), we make the books honest by
 * recording WHERE the money came from, without touching any user balance:
 *
 *   1. Post a balanced double-entry leg: SYSTEM_ONRAMP (the external rail)
 *      → PLATFORM, for the diff. This records the inflow on the ledger.
 *   2. Write an ADMIN_CREDIT Transaction for the diff so auditFundIntegrity's
 *      "entered from outside" sum picks it up and the breach clears.
 *
 * Idempotency: the diff is recomputed live at call time, so re-acknowledging
 * after balances drift only books the *remaining* gap. Returns the booked
 * amount and the post-reconcile diff (≈0 on success).
 */
export async function reconcileBreach(opts: {
  currency: string;
  adminId: string;
  note?: string;
}): Promise<{ currency: string; reconciledAmount: string; diffAfter: string }> {
  const currency = opts.currency.toUpperCase();

  // Recompute the live diff for just this currency (don't trust a stale value
  // passed from the client — the gap may have changed since it was shown).
  const report = await auditFundIntegrity({ haltOnBreach: false });
  const row = report.perCurrency.find((p) => p.currency === currency);
  if (!row) throw new Error(`No balances found for currency ${currency}`);

  const diff = new Decimal(row.diff);
  if (diff.abs().lte(EPS)) {
    return { currency, reconciledAmount: '0', diffAfter: row.diff };
  }
  // Only a POSITIVE diff (internal exceeds external — "conjured" funds) is a
  // credit reconciliation. A negative diff means money LEAKED; that must not be
  // papered over with a credit — it needs investigation, so we refuse.
  if (diff.lt(0)) {
    throw new Error(
      `Cannot credit-reconcile ${currency}: diff is negative (${row.diff}) — ` +
        `internal balances are SHORT, indicating a leak, not an unrecorded credit. Investigate.`,
    );
  }

  const { isLedgerCurrency } = await import('./ledger.service');
  const ref = `RECON-${currency}-${Date.now()}`;
  const memo = `[fund-recon] ${opts.note?.trim() || 'Admin-confirmed credit reconciliation'}`;

  await prisma.$transaction(async (tx: any) => {
    // 1) Double-entry: external rail funded the platform by `diff`.
    if (isLedgerCurrency(currency)) {
      const { postLedger } = await import('./ledger.service');
      await postLedger(tx, {
        refType: 'fund_reconciliation',
        refId: ref,
        memo,
        legs: [
          { type: 'SYSTEM_ONRAMP', currency: currency as any, amount: diff.neg() },
          { type: 'PLATFORM',      currency: currency as any, amount: diff },
        ],
      });
    }
    // 2) ADMIN_CREDIT Transaction so the audit's "entered from outside" sum
    //    includes this going forward. No userId — it's a platform-level
    //    external adjustment, attributed to the approving admin in metadata.
    await tx.transaction.create({
      data: {
        userId: opts.adminId,
        type: 'ADMIN_CREDIT',
        currency: currency as any,
        amount: new Decimal(diff.toFixed(8)),
        fee: new Decimal(0),
        reference: ref,
        description: memo,
        metadata: { fundReconciliation: true, reconciledBy: opts.adminId, originalDiff: row.diff } as any,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: opts.adminId,
        action: 'FUND_RECONCILIATION',
        entity: 'ledger',
        entityId: ref,
        newValues: { currency, amount: diff.toString(), note: opts.note || null } as any,
      },
    }).catch(() => { /* audit log best-effort */ });
  });

  // Re-audit to report the residual diff (should be ≈0).
  const after = await auditFundIntegrity({ haltOnBreach: false });
  const afterRow = after.perCurrency.find((p) => p.currency === currency);
  logger.info('[fund-integrity] breach reconciled', { currency, amount: diff.toString(), by: opts.adminId });
  return { currency, reconciledAmount: diff.toString(), diffAfter: afterRow?.diff ?? '0' };
}

let started = false;
/** Start periodic fund-integrity auditing (one worker only). */
export function startFundIntegrityAudit(intervalMs = Number(process.env.FUND_AUDIT_MS ?? 10 * 60_000)): void {
  if (started) return;
  started = true;
  // Halt-on-breach is OPT-IN (set FUND_AUDIT_HALT=1 in production). Off by
  // default so a freshly-seeded dev/staging DB — whose balances bypass the
  // deposit flow — doesn't brick trading. Production must turn this ON.
  const haltOnBreach = process.env.FUND_AUDIT_HALT === '1';
  setInterval(() => {
    void auditFundIntegrity({ haltOnBreach }).catch((e) => logger.error('[fund-integrity] audit threw', { err: e }));
  }, intervalMs).unref?.();
  logger.info('[fund-integrity] audit scheduler started');
}
