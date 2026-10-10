/**
 * Fund-integrity diagnostic — explains a currency's position line by line.
 *
 * Prints, for one currency:
 *   1. The current audit (fundIntegrity.service): customer wallets, value
 *      Tazdan holds on the ledger, every boundary flow by journal type and
 *      class (EVIDENCED / TRADE / UNBACKED), read-model drift, rail exceptions.
 *   2. A bridge from the OLD audit's number (Σ Wallet − deposits + withdrawals
 *      − admin credits, the source of the "~2,444 USDT" warning) to the
 *      ledger, so the historical discrepancy is attributed exactly.
 *   3. The wallets that differ most from their ledger account.
 *
 * Read-only. Run on the production host:
 *   docker compose exec api npx ts-node --transpile-only scripts/diagnose-fund-integrity.ts USDT
 * (or `node dist/scripts/...` if ts-node is not in the image).
 */
import dotenv from 'dotenv';
dotenv.config();

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { auditFundIntegrity } from '../src/services/ledger/fundIntegrity.service';

const CURRENCY = (process.argv[2] ?? 'USDT').toUpperCase();
const D = (v: unknown) => new Decimal(String(v ?? 0));
const f = (v: Decimal | string) => D(v).toFixed(8).padStart(22);

async function main() {
  console.log(`\n══ Fund-integrity diagnosis · ${CURRENCY} ═══════════════════════\n`);

  const report = await auditFundIntegrity({ haltOnBreach: false });
  const row = report.perCurrency.find((p) => p.currency === CURRENCY);
  if (!row) { console.log(`No wallets or ledger activity for ${CURRENCY}.`); return; }

  console.log('1) Current audit');
  console.log(`   customer wallets        ${f(row.customerWallets)}`);
  console.log(`   held by Tazdan (ledger) ${f(row.tazdanHeld)}   escrow, clearing, revenue, FX, treasury, partners, suspense`);
  console.log(`   = internal              ${f(row.internalHeld)}`);
  console.log(`   entered from outside    ${f(row.enteredOutside)}`);
  console.log(`   read-model drift        ${f(row.diff)}   ${D(row.diff).abs().lt('0.0001') ? 'none' : '⚠ wallets differ from the ledger'}`);
  console.log('\n   Boundary flows (net inflow; negative = net outflow):');
  for (const l of row.flows) console.log(`     ${l.class.padEnd(9)} ${l.refType.padEnd(28)} ${f(l.amount)}  (${l.postings} postings)`);
  console.log(`\n   unbacked, all time      ${f(row.unbacked)}`);
  console.log(`   unbacked since baseline ${f(row.unbackedSinceBaseline)}   ${row.baseline ? `baseline ${row.baseline.at} by ${row.baseline.by}: "${row.baseline.note}"` : 'no baseline acknowledged yet'}`);
  console.log(`   trading position        ${f(row.tradingPosition)}   net bought from the venue / Tazdan as principal`);
  const rail = report.railExceptions.filter((r) => r.currency === CURRENCY);
  console.log(`\n   Rail exceptions: ${rail.length}`);
  for (const r of rail.slice(0, 20)) console.log(`     ${r.rail.padEnd(10)} ${r.refType.padEnd(20)} ${String(r.refId).padEnd(38)} posted ${r.posted ?? '—'} recorded ${r.recorded ?? '—'} · ${r.problem}`);

  // 2) Bridge from the old audit.
  const [allWallets, houseWallets, dep, wd, admin] = await Promise.all([
    prisma.wallet.aggregate({ where: { currency: CURRENCY as any }, _sum: { balance: true } }),
    prisma.wallet.aggregate({ where: { currency: CURRENCY as any, user: { username: { in: ['platform', 'support'] } } }, _sum: { balance: true } }),
    prisma.deposit.aggregate({ where: { currency: CURRENCY as any, status: 'CONFIRMED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { currency: CURRENCY as any, status: { in: ['COMPLETED', 'PROCESSING'] } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { currency: CURRENCY as any, type: { in: ['ADMIN_CREDIT', 'ADMIN_DEBIT'] as any } }, _sum: { amount: true } }),
  ]);
  const oldEntered = D(dep._sum.amount).minus(D(wd._sum.amount)).plus(D(admin._sum.amount));
  const oldDiff = D(allWallets._sum.balance).minus(oldEntered);
  console.log('\n2) Bridge from the old audit');
  console.log(`   old audit difference    ${f(oldDiff)}   Σ all wallets − (deposits − withdrawals + admin credits/debits)`);
  console.log('   is exactly the sum of:');
  for (const l of row.flows) console.log(`     + ${l.refType.padEnd(26)} ${f(l.amount)}`);
  console.log(`     − held by Tazdan        ${f(D(row.tazdanHeld).neg())}`);
  console.log(`     + house wallets         ${f(D(houseWallets._sum.balance))}   platform/support Wallet rows (fees credited as USDT-equivalent)`);
  console.log(`     − confirmed deposits    ${f(D(dep._sum.amount).neg())}`);
  console.log(`     + withdrawals           ${f(D(wd._sum.amount))}`);
  console.log(`     − admin credit/debit    ${f(D(admin._sum.amount).neg())}`);
  console.log(`     + read-model drift      ${f(row.diff)}`);
  const check = row.flows.reduce((s, l) => s.plus(D(l.amount)), new Decimal(0))
    .minus(D(row.tazdanHeld)).plus(D(houseWallets._sum.balance)).minus(oldEntered).plus(D(row.diff));
  console.log(`   = ${f(check)}   ${check.minus(oldDiff).abs().lt('0.000001') ? '✔ bridge closes' : `✘ bridge off by ${check.minus(oldDiff)}`}`);

  // 3) Worst read-model mismatches.
  const worst = await prisma.$queryRaw<Array<{ email: string | null; wallet: string; ledger: string; gap: string }>>`
    SELECT u."email", w."balance"::text AS wallet, COALESCE(a."balance", 0)::text AS ledger, (w."balance" - COALESCE(a."balance", 0))::text AS gap
    FROM "Wallet" w JOIN "User" u ON u."id" = w."userId"
    LEFT JOIN "LedgerAccount" a ON a."type" = 'USER' AND a."userId" = w."userId" AND a."currency" = w."currency"
    WHERE w."currency"::text = ${CURRENCY} AND COALESCE(u."username", '') NOT IN ('platform', 'support')
      AND ABS(w."balance" - COALESCE(a."balance", 0)) > 0.00000001
    ORDER BY ABS(w."balance" - COALESCE(a."balance", 0)) DESC
    LIMIT 10
  `;
  console.log(`\n3) Wallets that differ from their ledger account: ${worst.length ? '' : 'none'}`);
  for (const w of worst) console.log(`     ${String(w.email).padEnd(40)} wallet ${w.wallet} ledger ${w.ledger} gap ${w.gap}`);

  console.log('\n── What to do ────────────────────────────────────────────────');
  console.log('• Read-model drift: find the flow that changed a wallet without a journal (section 3), fix it, then correct the wallet with a maker-checked adjustment.');
  console.log('• Rail exceptions: resolve each in the cockpit reconciliation queue.');
  console.log('• Unbacked history (opening_balance, sim_seed_credit, admin_onboard_credit, fund_reconciliation, …): confirm it, then acknowledge the baseline with a note');
  console.log('  (cockpit → Reconciliation → Fund integrity). After that, any new unbacked value is a breach.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
