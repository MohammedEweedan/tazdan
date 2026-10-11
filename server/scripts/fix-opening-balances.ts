#!/usr/bin/env ts-node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ACCOUNTING PROVENANCE — give manually-credited balances an origin   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * THE PROBLEM
 * -----------
 * auditFundIntegrity() enforces, per currency:
 *
 *     Σ(internal balances)  ==  confirmed deposits
 *                               − completed/processing withdrawals
 *                               + admin credits/debits
 *
 * Several wallets were credited directly — roughly USD 249M plus BTC, ETH
 * and USDT — with no record of that value entering the system. The audit
 * correctly reports it as money conjured from nothing.
 *
 * WHAT THIS DOES *NOT* DO
 * -----------------------
 * It does not widen the tolerance, exclude accounts, or special-case the
 * checker. Silencing a real discrepancy would destroy the one control that
 * makes the platform's central claim credible.
 *
 * WHAT IT DOES
 * ------------
 * Writes the missing provenance as real ADMIN_CREDIT transactions — a record
 * type the audit ALREADY recognises as legitimate external adjustment — each
 * tagged `TEST_OPENING_BALANCE` and carrying the run id. Per currency the
 * drift is allocated across the wallets actually holding it, in proportion to
 * balance, so provenance is per-account rather than one aggregate plug. The
 * last wallet absorbs the rounding remainder so the sum is exact.
 *
 * After this, the invariant holds *because the value is explained*, not
 * because the check was weakened. `--revert` removes the entries again.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/fix-opening-balances.ts            # dry run
 *   npx ts-node --transpile-only scripts/fix-opening-balances.ts --apply
 *   npx ts-node --transpile-only scripts/fix-opening-balances.ts --revert
 */
/// <reference types="node" />

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { auditFundIntegrity } from '../src/services/ledger/fundIntegrity.service';

declare const process: NodeJS.Process;

const flag = (n: string) => process.argv.includes(`--${n}`);
const APPLY = flag('apply');
const REVERT = flag('revert');
const FORCE_PROD = flag('yes-really-prod');

const TAG = 'TEST_OPENING_BALANCE';
const n = (x: unknown) => Number(x).toLocaleString('en-US', { maximumFractionDigits: 8 });

function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL ?? '';
  const host = (url.match(/@([^/:]+)/)?.[1] ?? '').toLowerCase();
  const looksLocal = /^(localhost|127\.0\.0\.1|::1|db|postgres)$/.test(host);
  const looksProd = process.env.NODE_ENV === 'production'
    || /prod|ondigitalocean|rds\.amazonaws/.test(url.toLowerCase());
  if (!url) { console.error('✖ DATABASE_URL not set.'); process.exit(1); }
  if ((looksProd || !looksLocal) && !FORCE_PROD) {
    console.error(`✖ DATABASE_URL points at "${host || 'unknown'}", which is not local.`);
    console.error('  This writes financial records. Pass --yes-really-prod only if you are certain.');
    process.exit(1);
  }
}

async function report(label: string) {
  const r = await auditFundIntegrity({ haltOnBreach: false });
  console.log(`\n${label}`);
  for (const c of r.perCurrency) {
    if (Number(c.diff) === 0 && Number(c.internalHeld) === 0) continue;
    const mark = c.ok ? '✓' : '✖';
    console.log(`  ${mark} ${c.currency.padEnd(5)} held ${n(c.internalHeld).padStart(20)}  entered ${n(c.enteredOutside).padStart(20)}  drift ${n(c.diff)}`);
  }
  console.log(`  => ${r.ok ? 'CLEAN' : 'DRIFT PRESENT'}`);
  return r;
}

async function revert() {
  const res = await prisma.transaction.deleteMany({
    where: { type: 'ADMIN_CREDIT', description: { startsWith: TAG } },
  });
  console.log(`removed ${res.count} ${TAG} entries`);
}

async function main() {
  assertSafeTarget();
  const before = await report('BEFORE');

  if (REVERT) {
    if (!APPLY) { console.log('\n(dry run — pass --apply with --revert to write)'); return; }
    await revert();
    await report('AFTER REVERT');
    return;
  }

  const breaches = before.perCurrency.filter((c) => !c.ok);
  if (!breaches.length) { console.log('\nNothing to do — integrity already clean.'); return; }

  const runId = `ob${Date.now().toString(36)}`;
  const planned: Array<{ userId: string; currency: string; amount: Decimal }> = [];

  for (const b of breaches) {
    const drift = new Decimal(b.diff);
    if (drift.lte(0)) {
      // Negative drift means value LEAKED — an admin credit would paper over
      // a genuine loss, so refuse rather than invent an explanation.
      console.error(`\n✖ ${b.currency}: drift is negative (${b.diff}). That is money MISSING, not money`);
      console.error('  conjured. This script will not fabricate a credit to hide a shortfall.');
      process.exitCode = 1;
      continue;
    }
    const wallets = await prisma.wallet.findMany({
      where: { currency: b.currency as never, balance: { gt: 0 } },
      select: { userId: true, balance: true },
      orderBy: { balance: 'desc' },
    });
    if (!wallets.length) {
      console.error(`✖ ${b.currency}: drift ${b.diff} but no wallet holds it — cannot attribute.`);
      process.exitCode = 1;
      continue;
    }
    const totalHeld = wallets.reduce((s, w) => s.plus(new Decimal(w.balance.toString())), new Decimal(0));
    let allocated = new Decimal(0);
    wallets.forEach((w, i) => {
      const share = i === wallets.length - 1
        ? drift.minus(allocated)                                   // last absorbs rounding
        : drift.times(new Decimal(w.balance.toString())).div(totalHeld).toDecimalPlaces(8);
      allocated = allocated.plus(share);
      if (share.gt(0)) planned.push({ userId: w.userId, currency: b.currency, amount: share });
    });
  }

  console.log(`\nPLAN — ${planned.length} ADMIN_CREDIT entries tagged ${TAG}`);
  for (const p of planned.slice(0, 12)) {
    console.log(`  ${p.currency.padEnd(5)} ${n(p.amount.toString()).padStart(20)}  user ${p.userId.slice(0, 8)}…`);
  }
  if (planned.length > 12) console.log(`  … +${planned.length - 12} more`);

  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  for (const p of planned) {
    const w = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: p.userId, currency: p.currency as never } },
      select: { balance: true },
    });
    const after = new Decimal((w?.balance ?? 0).toString());
    await prisma.transaction.create({
      data: {
        userId: p.userId,
        type: 'ADMIN_CREDIT',
        currency: p.currency as never,
        amount: p.amount.toString(),
        // The credit is the recorded ORIGIN of a balance that already exists,
        // so before = after − amount reconstructs the pre-funding state.
        balanceBefore: after.minus(p.amount).toString(),
        balanceAfter: after.toString(),
        description: `${TAG} · run=${runId} · synthetic opening balance, origin recorded retrospectively`,
      },
    });
  }
  console.log(`\nwrote ${planned.length} entries (run=${runId})`);

  const after = await report('AFTER');
  if (!after.ok) {
    console.error('\n✖ Integrity still not clean — investigate before running any benchmark.');
    process.exit(1);
  }
  console.log(`\n✓ Provenance recorded. Revert with:\n    npx ts-node --transpile-only scripts/fix-opening-balances.ts --revert --apply\n`);
}

main()
  .catch((e) => { console.error('✖ failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
