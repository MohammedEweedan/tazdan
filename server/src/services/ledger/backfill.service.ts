/**
 * One-time ledger backfill — seed the double-entry ledger with opening
 * balances that match the live Wallet / UserWallet tables, so the ledger
 * becomes a faithful authoritative copy. AFTER this runs, the trade/transfer/
 * withdrawal paths can flip to `allowNegativeUser: false` and let the LEDGER
 * gate spending (true source of truth), because its balances now equal reality.
 *
 * Each opening balance is posted as a balanced pair:
 *   USER(+balance)  ⟷  SYSTEM_ONRAMP(-balance)
 * i.e. "this money entered the system at backfill time" — which conserves and
 * keeps the global reconciliation green.
 *
 * Idempotent: it only posts the DIFFERENCE between the current ledger balance
 * and the live Wallet balance, so re-running it is safe and self-correcting.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { postLedger, isLedgerCurrency, getUserBalance } from './ledger.service';

// Map a UserWallet native column / alt key to a ledger Currency.
const NATIVE_TO_CCY: Record<string, string> = {
  btcBalance: 'BTC', ethBalance: 'ETH', solBalance: 'SOL',
  usdtErc20Bal: 'USDT', usdtTrc20Bal: 'USDT',
};

export interface BackfillReport {
  ran: number;        // number of opening adjustments posted
  skipped: number;    // already-matching accounts
  perCurrency: Record<string, string>;
}

export async function backfillLedgerOpeningBalances(): Promise<BackfillReport> {
  const report: BackfillReport = { ran: 0, skipped: 0, perCurrency: {} };

  // 1) Fiat-style Wallet rows.
  const wallets = await prisma.wallet.findMany();
  // 2) Crypto UserWallet rows (native cols + altBalances).
  const userWallets = await prisma.userWallet.findMany();

  // Aggregate desired USER balances per (userId, currency).
  const desired = new Map<string, Decimal>(); // key `${userId}:${ccy}`
  const add = (userId: string, ccy: string, amt: Decimal) => {
    if (!isLedgerCurrency(ccy) || amt.isZero()) return;
    const k = `${userId}:${ccy.toUpperCase()}`;
    desired.set(k, (desired.get(k) ?? new Decimal(0)).plus(amt));
  };

  for (const w of wallets) add(w.userId, w.currency, new Decimal(w.balance.toString()));
  for (const uw of userWallets) {
    for (const [col, ccy] of Object.entries(NATIVE_TO_CCY)) {
      const v = (uw as any)[col];
      if (v != null) add(uw.userId, ccy, new Decimal(v.toString()));
    }
    const alts = (uw.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, unknown>;
    for (const [sym, v] of Object.entries(alts)) add(uw.userId, sym, new Decimal(String(v ?? '0')));
  }

  // Post the difference (desired − current ledger) for each account.
  for (const [key, want] of desired) {
    const [userId, ccy] = key.split(':');
    const current = await getUserBalance(prisma, userId, ccy as any);
    const diff = want.minus(current);
    if (diff.abs().lte(new Decimal('0.000000001'))) { report.skipped++; continue; }

    await prisma.$transaction(async (tx) => {
      await postLedger(tx, {
        refType: 'opening_balance', refId: `${userId}:${ccy}`, memo: 'Ledger backfill opening balance',
        legs: [
          { type: 'USER', userId, currency: ccy as any, amount: diff },
          { type: 'SYSTEM_ONRAMP', currency: ccy as any, amount: diff.neg() },
        ],
      }, { allowNegativeUser: true });
    });
    report.ran++;
    report.perCurrency[ccy] = (new Decimal(report.perCurrency[ccy] ?? 0).plus(diff)).toString();
  }

  logger.info('[ledger] backfill complete', report);
  return report;
}
