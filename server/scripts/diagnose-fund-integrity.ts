/**
 * Fund-integrity diagnostic — decomposes the audit's "internalHeld vs
 * enteredOutside" discrepancy (e.g. the persistent ~2,444 USDT delta) into
 * attributable sources so it stops being an unexplained number.
 *
 * The audit (fundIntegrity.service) computes, per currency:
 *   internalHeld   = Σ Wallet.balance
 *   enteredOutside = Σ confirmed Deposits − Σ completed/processing Withdrawals
 *                    + Σ ADMIN_CREDIT/ADMIN_DEBIT transactions
 *   diff           = internalHeld − enteredOutside
 *
 * A positive diff = balances exist that no external inflow explains. This
 * script hunts the usual suspects, oldest-first:
 *   1. Seed/simulation users (emails matching seed patterns) holding balance
 *   2. Wallet rows whose balance ≠ Σ of their Transaction history
 *      (balance was set directly, bypassing the transaction trail)
 *   3. Transaction types that mint balance without an external counterpart
 *   4. On-chain settlements credited to UserWallet (different table!) that
 *      the audit's Wallet-table sums never see
 *
 * Read-only. Run: npx ts-node --transpile-only scripts/diagnose-fund-integrity.ts [CURRENCY]
 */
import dotenv from 'dotenv';
dotenv.config();

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';

const CURRENCY = (process.argv[2] ?? 'USDT').toUpperCase();
const D = (v: unknown) => new Decimal(String(v ?? 0));

async function main() {
  console.log(`\n══ Fund-integrity diagnosis · ${CURRENCY} ═══════════════════════\n`);

  // ── The audit's own numbers, reproduced ─────────────────────────────
  const [walletSum, depSum, wdSum, adminSum] = await Promise.all([
    prisma.wallet.aggregate({ where: { currency: CURRENCY as any }, _sum: { balance: true } }),
    prisma.deposit.aggregate({ where: { currency: CURRENCY as any, status: 'CONFIRMED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { currency: CURRENCY as any, status: { in: ['COMPLETED', 'PROCESSING'] } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { currency: CURRENCY as any, type: { in: ['ADMIN_CREDIT', 'ADMIN_DEBIT'] as any } }, _sum: { amount: true } }),
  ]);
  const internalHeld = D(walletSum._sum.balance);
  const entered = D(depSum._sum.amount).minus(D(wdSum._sum.amount)).plus(D(adminSum._sum.amount));
  const diff = internalHeld.minus(entered);
  console.log(`internalHeld    ${internalHeld.toFixed(8)}`);
  console.log(`enteredOutside  ${entered.toFixed(8)}  (deposits ${D(depSum._sum.amount)} − withdrawals ${D(wdSum._sum.amount)} + admin ${D(adminSum._sum.amount)})`);
  console.log(`DIFF            ${diff.toFixed(8)}  ${diff.abs().lt('0.01') ? '✅ balanced' : '⚠️ unexplained'}\n`);
  if (diff.abs().lt('0.01')) return;

  // ── Suspect 1: seed/simulation accounts holding balance ─────────────
  const seedPatterns = ['%simulat%', '%sim.local%', '%seed%', '%test%', '%demo%', '%example.com'];
  const seedUsers = await prisma.user.findMany({
    where: { OR: seedPatterns.map((p) => ({ email: { contains: p.replace(/%/g, '') } })) },
    select: { id: true, email: true },
  });
  if (seedUsers.length) {
    const seedBal = await prisma.wallet.aggregate({
      where: { currency: CURRENCY as any, userId: { in: seedUsers.map((u) => u.id) } },
      _sum: { balance: true },
    });
    const total = D(seedBal._sum.balance);
    console.log(`[1] Seed-pattern accounts: ${seedUsers.length} users hold ${total.toFixed(8)} ${CURRENCY}`);
    if (total.gt(0)) {
      console.log(`    → ${total.div(diff).mul(100).toFixed(1)}% of the diff. These balances were`);
      console.log(`      likely created by simulation scripts without Deposit rows.`);
      console.log(`      Fix: zero them, or book one ADMIN_CREDIT covering them (audit clears).`);
    }
  } else {
    console.log('[1] No seed-pattern accounts found.');
  }

  // ── Suspect 2: wallets whose balance ≠ their transaction trail ──────
  const wallets = await prisma.wallet.findMany({
    where: { currency: CURRENCY as any, balance: { gt: 0 } },
    select: { userId: true, balance: true },
  });
  const txSums = await prisma.transaction.groupBy({
    by: ['userId'],
    where: { currency: CURRENCY as any },
    _sum: { amount: true },
  });
  const txByUser = new Map(txSums.map((t) => [t.userId, D(t._sum.amount)]));
  let orphaned = new Decimal(0);
  const offenders: Array<{ userId: string; balance: Decimal; trail: Decimal }> = [];
  for (const w of wallets) {
    const trail = txByUser.get(w.userId) ?? new Decimal(0);
    const gap = D(w.balance).minus(trail);
    if (gap.abs().gte('0.01')) {
      orphaned = orphaned.plus(gap);
      offenders.push({ userId: w.userId, balance: D(w.balance), trail });
    }
  }
  console.log(`\n[2] Wallets where balance ≠ Σ(transactions): ${offenders.length} wallets, net gap ${orphaned.toFixed(8)} ${CURRENCY}`);
  for (const o of offenders.slice(0, 10)) {
    const u = await prisma.user.findUnique({ where: { id: o.userId }, select: { email: true } });
    console.log(`    ${u?.email ?? o.userId}: balance ${o.balance.toFixed(4)} vs trail ${o.trail.toFixed(4)}`);
  }
  if (offenders.length > 10) console.log(`    … and ${offenders.length - 10} more`);

  // ── Suspect 3: balance-minting transaction types w/o external rows ──
  const byType = await prisma.transaction.groupBy({
    by: ['type'],
    where: { currency: CURRENCY as any, amount: { gt: 0 } },
    _sum: { amount: true },
    _count: true,
  });
  console.log(`\n[3] Positive-amount transactions by type (what credited balances):`);
  for (const t of byType.sort((a, b) => D(b._sum.amount).comparedTo(D(a._sum.amount)))) {
    console.log(`    ${String(t.type).padEnd(18)} ${D(t._sum.amount).toFixed(4).padStart(16)}  (${t._count} txs)`);
  }
  console.log(`    ↑ DEPOSIT-type should ≈ the Deposit table sum; TRANSFER_IN nets out`);
  console.log(`      against TRANSFER_OUT; anything else crediting large sums without an`);
  console.log(`      external counterpart is the leak.`);

  // ── Suspect 4: on-chain (UserWallet) vs audit scope ──────────────────
  if (CURRENCY === 'USDT') {
    const uw = await prisma.userWallet.aggregate({ _sum: { usdtErc20Bal: true, usdtTrc20Bal: true } });
    console.log(`\n[4] On-chain USDT (UserWallet, OUTSIDE the audit's Wallet sums):`);
    console.log(`    ERC20 ${D(uw._sum.usdtErc20Bal).toFixed(4)} · TRC20 ${D(uw._sum.usdtTrc20Bal).toFixed(4)}`);
    console.log(`    If internal transfers ever moved value between Wallet and UserWallet`);
    console.log(`    without a mirroring row, it shows up as an audit diff.`);
  }

  console.log(`\n── Next step ─────────────────────────────────────────────────`);
  console.log(`Whichever bucket above ≈ ${diff.toFixed(2)} is your answer. If it's seed/`);
  console.log(`simulation data (most likely on a platform pre-launch), either zero those`);
  console.log(`wallets or book the admin-credit reconciliation from the dashboard so the`);
  console.log(`audit goes green and STAYS green — any future drift is then a real signal.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
