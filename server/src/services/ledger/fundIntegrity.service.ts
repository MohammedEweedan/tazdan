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
