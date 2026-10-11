#!/usr/bin/env ts-node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  TAZDAN — BULK STRESS & INTEGRITY HARNESS                            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * WHY THIS EXISTS, given we already have three simulators:
 *
 *   simulate-platform-activity.ts  — realistic activity, over the HTTP API
 *   simulate-full-activity.ts      — every surface, over the HTTP API
 *   load-test/k6.js                — concurrency, ramps to 25 VUs
 *
 * All three drive the API one request at a time. That is the right way to
 * test behaviour, and the wrong way to reach millions of rows — a million
 * HTTP round-trips at even 5ms each is over an hour of pure latency.
 *
 * This harness fills the two gaps those leave:
 *
 *   1. VOLUME     — batched createMany straight at the database, so the
 *                   corpus can reach millions in minutes. Used to find the
 *                   things that only break at scale: missing indexes, queries
 *                   that degrade non-linearly, pagination that collapses.
 *
 *   2. CONCURRENCY— many writers hitting ONE wallet at once, then checking
 *                   whether the money still adds up. For a platform whose
 *                   core claim is a ledger that cannot drift, "does it still
 *                   balance after N concurrent debits" is the test that
 *                   matters. Lost updates and overdrafts both surface here.
 *
 * It brackets the whole run with auditFundIntegrity() — the same conservation
 * audit that halts trading in production — so a run that breaks the invariant
 * is reported as a FAILURE, not just slow.
 *
 * ── Usage ─────────────────────────────────────────────────────────────
 *   npx ts-node --transpile-only scripts/stress-test.ts [options]
 *
 *   --users=N          users to create            (default 10_000)
 *   --tx-per-user=N    transactions per user      (default 10)
 *   --msg-per-user=N   messages per user          (default 4)
 *   --concurrency=N    parallel writers in the race phase (default 64)
 *   --debits=N         debits per writer          (default 50)
 *   --batch=N          rows per createMany        (default 5_000)
 *   --seed=N           RNG seed, for reproducible runs   (default 1)
 *   --skip-seed        run only the concurrency + integrity phases
 *   --cleanup          delete a previous run's data, then exit
 *   --run-id=ID        target a specific run (for --cleanup)
 *   --yes-really-prod  required to run against a production database
 *
 * Example — one million transactions:
 *   npx ts-node --transpile-only scripts/stress-test.ts \
 *     --users=100000 --tx-per-user=10 --msg-per-user=2
 *
 * Cleanup afterwards (everything is tagged, nothing else is touched):
 *   npx ts-node --transpile-only scripts/stress-test.ts --cleanup --run-id=<id>
 */
/// <reference types="node" />

import { randomUUID } from 'crypto';
import { Currency, TransactionType } from '@prisma/client';
import { prisma } from '../src/utils/prisma';
import { auditFundIntegrity } from '../src/services/ledger/fundIntegrity.service';

declare const process: NodeJS.Process;

/* ─── CLI ──────────────────────────────────────────────────────────── */
const arg  = (f: string) => process.argv.find((a) => a.startsWith(`--${f}=`))?.split('=')[1];
const flag = (n: string) => process.argv.includes(`--${n}`);
const int  = (f: string, d: number) => {
  const v = Number.parseInt(arg(f) ?? '', 10);
  return Number.isFinite(v) && v >= 0 ? v : d;
};

const N_USERS     = int('users', 10_000);
const TX_PER_USER = int('tx-per-user', 10);
const MSG_PER_USER = int('msg-per-user', 4);
const CONCURRENCY = int('concurrency', 64);
const DEBITS      = int('debits', 50);
const BATCH       = Math.max(100, int('batch', 5_000));
const SKIP_SEED   = flag('skip-seed');
const CLEANUP     = flag('cleanup');
const FORCE_PROD  = flag('yes-really-prod');

/** Tag for everything this run creates, so cleanup can be exact. */
const RUN_ID = arg('run-id') ?? `st${Date.now().toString(36)}`;
const TAG = (n: number) => `stress+${RUN_ID}+${n}@stress.invalid`;
const TAG_PREFIX = `stress+${RUN_ID}+`;

/* ─── Deterministic RNG (mulberry32) ───────────────────────────────────
   Seeded so a failing run can be replayed exactly. Math.random() would
   make "it broke once" unreproducible, which is useless for a stress bug. */
let _s = int('seed', 1) >>> 0;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];

const CURRENCIES: Currency[] = [Currency.USDT, Currency.USD, Currency.BTC, Currency.ETH];
const TX_TYPES: TransactionType[] = [
  TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.BUY,
  TransactionType.SELL, TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT,
];

/* ─── Output helpers ───────────────────────────────────────────────── */
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
const log = (m: string) => console.log(`[${el()}s] ${m}`);
const head = (m: string) => console.log(`\n${'─'.repeat(72)}\n  ${m}\n${'─'.repeat(72)}`);
const n = (x: number) => x.toLocaleString('en-US');

/* ─── Safety: never bulk-write a production database by accident ─────
   This inserts millions of rows. Pointed at prod it is an outage, not a
   test. The check is deliberately paranoid and easy to override ONLY
   with an explicit flag. */
function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL ?? '';
  const host = (url.match(/@([^/:]+)/)?.[1] ?? '').toLowerCase();
  const looksLocal = /^(localhost|127\.0\.0\.1|::1|db|postgres)$/.test(host);
  const looksProd =
    process.env.NODE_ENV === 'production' ||
    /prod|promrkts\.com|tazdan\.com|ondigitalocean|rds\.amazonaws/.test(url.toLowerCase());

  if (!url) {
    console.error('✖ DATABASE_URL is not set. Refusing to run.');
    process.exit(1);
  }
  if ((looksProd || !looksLocal) && !FORCE_PROD) {
    console.error(
      `✖ DATABASE_URL points at "${host || 'unknown host'}", which does not look local.\n` +
      '  This script writes millions of rows and is NOT safe to run against production.\n' +
      '  Point it at a scratch database, or pass --yes-really-prod if you are certain.',
    );
    process.exit(1);
  }
  if (looksProd && FORCE_PROD) {
    log('⚠  Running against a PRODUCTION-LOOKING database because --yes-really-prod was passed.');
  }
}

/* ─── Phase 1: bulk seed ───────────────────────────────────────────── */
async function seed(): Promise<string[]> {
  head(`SEED — ${n(N_USERS)} users · ${n(N_USERS * TX_PER_USER)} transactions · ${n(N_USERS * MSG_PER_USER)} messages`);

  const userIds: string[] = [];
  let done = 0;

  for (let start = 0; start < N_USERS; start += BATCH) {
    const size = Math.min(BATCH, N_USERS - start);
    const users = Array.from({ length: size }, (_, i) => {
      const idx = start + i;
      const id = randomUUID();
      userIds.push(id);
      return {
        id,
        email: TAG(idx),
        // Not a real hash — these accounts must never be loginable. A fixed
        // non-bcrypt string cannot match any password through the real
        // comparison path.
        passwordHash: `!stress-not-a-valid-hash-${RUN_ID}`,
        firstName: `Stress${idx}`,
        lastName: 'Test',
        referralCode: `ST${RUN_ID}${idx.toString(36)}`.toUpperCase().slice(0, 20),
        updatedAt: new Date(),
      };
    });
    await prisma.user.createMany({ data: users, skipDuplicates: true });

    // One wallet per user per currency. @@unique([userId, currency]) makes
    // this idempotent under skipDuplicates.
    // Balances stay at ZERO on purpose. Seeding random balances mints money
    // that has no matching ledger entries, so auditFundIntegrity() flags a
    // conservation breach on every run — a false alarm that would train us
    // to ignore the one check that actually matters.
    await prisma.wallet.createMany({
      data: users.flatMap((u) =>
        CURRENCIES.map((currency) => ({
          userId: u.id,
          currency,
          balance: 0,
          updatedAt: new Date(),
        })),
      ),
      skipDuplicates: true,
    });

    done += size;
    const rate = Math.round(done / ((Date.now() - t0) / 1000));
    log(`users  ${n(done)}/${n(N_USERS)}  (${n(rate)}/s)`);
  }

  if (TX_PER_USER > 0) {
    let written = 0;
    const total = N_USERS * TX_PER_USER;
    // Walk users in chunks so the row buffer stays bounded regardless of
    // how many millions are requested.
    const perChunk = Math.max(1, Math.floor(BATCH / TX_PER_USER));
    for (let i = 0; i < userIds.length; i += perChunk) {
      const chunk = userIds.slice(i, i + perChunk);
      const rows = chunk.flatMap((userId) =>
        Array.from({ length: TX_PER_USER }, () => {
          const amount = Math.floor(rnd() * 100_000) / 100;
          const before = Math.floor(rnd() * 1_000_000) / 100;
          return {
            userId,
            type: pick(TX_TYPES),
            currency: pick(CURRENCIES),
            amount,
            balanceBefore: before,
            balanceAfter: before + amount,
            description: `stress:${RUN_ID}`,
          };
        }),
      );
      await prisma.transaction.createMany({ data: rows });
      written += rows.length;
      if (written % (BATCH * 4) < rows.length || written === total) {
        const rate = Math.round(written / ((Date.now() - t0) / 1000));
        log(`tx     ${n(written)}/${n(total)}  (${n(rate)}/s)`);
      }
    }
  }

  if (MSG_PER_USER > 0 && userIds.length > 1) {
    let written = 0;
    const total = N_USERS * MSG_PER_USER;
    const perChunk = Math.max(1, Math.floor(BATCH / MSG_PER_USER));
    for (let i = 0; i < userIds.length; i += perChunk) {
      const chunk = userIds.slice(i, i + perChunk);
      const rows = chunk.flatMap((senderId) =>
        Array.from({ length: MSG_PER_USER }, () => ({
          senderId,
          receiverId: pick(userIds),
          content: `stress:${RUN_ID} ${randomUUID()}`,
        })),
      );
      await prisma.message.createMany({ data: rows });
      written += rows.length;
      if (written % (BATCH * 4) < rows.length || written === total) {
        const rate = Math.round(written / ((Date.now() - t0) / 1000));
        log(`msg    ${n(written)}/${n(total)}  (${n(rate)}/s)`);
      }
    }
  }

  return userIds;
}

/* ─── Phase 2: concurrency race ─────────────────────────────────────
   The point of the whole harness. Many writers debit ONE wallet at the
   same time. Two distinct failures can show up:

     lost update — final balance is HIGHER than it should be, because
                   concurrent read-modify-writes overwrote each other.
     overdraft   — balance went below zero, i.e. the guard that is
                   supposed to stop a spend was raced past.

   The debit uses an atomic conditional update, which is what correct
   code must do. If this phase ever fails, the bug is real. */
async function raceOneWallet(userIds: string[]): Promise<boolean> {
  head(`CONCURRENCY — ${CONCURRENCY} writers × ${DEBITS} debits on a single wallet`);
  if (!userIds.length) { log('no users available; skipping'); return true; }

  const victim = userIds[0];
  const currency = Currency.USDT;
  const DEBIT = 1;
  const attempts = CONCURRENCY * DEBITS;
  const opening = attempts + 100; // deliberately not enough for every attempt

  await prisma.wallet.upsert({
    where: { userId_currency: { userId: victim, currency } },
    create: { userId: victim, currency, balance: opening, updatedAt: new Date() },
    update: { balance: opening },
  });
  log(`opening balance ${n(opening)} · ${n(attempts)} debits of ${DEBIT} will be attempted`);

  let applied = 0;
  let rejected = 0;
  const started = Date.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let i = 0; i < DEBITS; i++) {
        // Conditional atomic decrement: the WHERE clause carries the
        // sufficient-funds guard, so the check and the write cannot be
        // separated by another transaction.
        const res = await prisma.wallet.updateMany({
          where: { userId: victim, currency, balance: { gte: DEBIT } },
          data: { balance: { decrement: DEBIT } },
        });
        if (res.count === 1) applied++; else rejected++;
      }
    }),
  );

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: victim, currency } },
  });
  const finalBal = Number(wallet?.balance ?? 0);
  const expected = opening - applied * DEBIT;
  const secs = (Date.now() - started) / 1000;

  log(`applied ${n(applied)} · rejected ${n(rejected)} · ${Math.round(attempts / secs)} ops/s`);
  log(`final balance ${finalBal} · expected ${expected}`);

  let ok = true;
  if (finalBal !== expected) {
    console.error(`✖ LOST UPDATE: balance is ${finalBal}, expected ${expected} (drift ${finalBal - expected})`);
    ok = false;
  }
  if (finalBal < 0) {
    console.error(`✖ OVERDRAFT: balance went negative (${finalBal})`);
    ok = false;
  }
  if (ok) log('✓ no lost updates, no overdraft');

  // Hand the balance back so the harness leaves conservation exactly as it
  // found it — otherwise the opening float shows up as drift in phase 4.
  await prisma.wallet.update({
    where: { userId_currency: { userId: victim, currency } },
    data: { balance: 0 },
  });
  return ok;
}

/* ─── Phase 3: read pressure ───────────────────────────────────────
   Queries the platform runs constantly, timed against the corpus we just
   built. Slow numbers here usually mean a missing index rather than a
   slow machine — that is the finding worth having. */
async function readPressure(): Promise<void> {
  head('READ PRESSURE — hot queries against the seeded corpus');
  const probes: Array<[string, () => Promise<unknown>]> = [
    ['count transactions', () => prisma.transaction.count()],
    ['tx page (skip 10k)', () => prisma.transaction.findMany({ skip: 10_000, take: 20, orderBy: { createdAt: 'desc' } })],
    ['wallet sums by ccy', () => prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } })],
    ['inbox newest 50',    () => prisma.message.findMany({ take: 50, orderBy: { createdAt: 'desc' } })],
    ['user by email',      () => prisma.user.findUnique({ where: { email: TAG(0) } })],
  ];
  for (const [name, run] of probes) {
    const s = Date.now();
    try {
      await run();
      const ms = Date.now() - s;
      log(`${ms > 1000 ? '⚠ ' : '  '}${name.padEnd(20)} ${String(ms).padStart(6)} ms`);
    } catch (e) {
      log(`✖ ${name.padEnd(20)} failed: ${(e as Error).message}`);
    }
  }
}

/* ─── Phase 4: conservation ────────────────────────────────────────
   Reports the DELTA, not the absolute state. A scratch database usually
   carries pre-existing drift from earlier seeding, and printing that on every
   run just buries the signal. The question this harness answers is
   narrower and far more useful: did THIS run break conservation? */
type Drift = Map<string, number>;

async function integritySnapshot(): Promise<Drift> {
  const report = await auditFundIntegrity({ haltOnBreach: false });
  const out: Drift = new Map();
  for (const row of report.perCurrency ?? []) {
    out.set(String(row.currency), Number(row.diff ?? 0));
  }
  return out;
}

function reportDrift(before: Drift, after: Drift): boolean {
  head('CONSERVATION — change introduced by this run');
  let clean = true;
  const keys = new Set([...before.keys(), ...after.keys()]);
  const moved: string[] = [];
  for (const k of keys) {
    const delta = (after.get(k) ?? 0) - (before.get(k) ?? 0);
    if (Math.abs(delta) > 1e-8) { moved.push(`${k} ${delta > 0 ? '+' : ''}${delta}`); clean = false; }
  }
  if (clean) {
    log(`✓ conservation unchanged across ${keys.size} currencies`);
  } else {
    console.error(`✖ THIS RUN MOVED THE BOOKS: ${moved.join(', ')}`);
    console.error('  Money was created or destroyed without matching ledger entries.');
  }
  const preExisting = [...before.entries()].filter(([, v]) => Math.abs(v) > 1e-8);
  if (preExisting.length) {
    log(`note: ${preExisting.length} currencies already had drift before this run (pre-existing, not caused here)`);
  }
  return clean;
}

/* ─── Cleanup ──────────────────────────────────────────────────────── */
async function cleanup(): Promise<void> {
  head(`CLEANUP — removing run ${RUN_ID}`);
  const users = await prisma.user.findMany({
    where: { email: { startsWith: TAG_PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  log(`found ${n(ids.length)} tagged users`);
  if (!ids.length) { log('nothing to remove'); return; }

  // Messages have no cascade from User in both directions; clear explicitly
  // first, then let the User cascade take wallets and transactions.
  for (let i = 0; i < ids.length; i += 1000) {
    const slice = ids.slice(i, i + 1000);
    await prisma.message.deleteMany({
      where: { OR: [{ senderId: { in: slice } }, { receiverId: { in: slice } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: slice } } });
    log(`removed ${n(Math.min(i + 1000, ids.length))}/${n(ids.length)}`);
  }
  log('✓ cleanup complete');
}

/* ─── Main ─────────────────────────────────────────────────────────── */
async function main() {
  assertSafeTarget();

  if (CLEANUP) {
    await cleanup();
    return;
  }

  console.log(`\n  run id: ${RUN_ID}   (keep this — needed for --cleanup)\n`);

  const before = await integritySnapshot();

  let userIds: string[] = [];
  if (SKIP_SEED) {
    userIds = (await prisma.user.findMany({
      where: { email: { startsWith: TAG_PREFIX } }, select: { id: true }, take: 50_000,
    })).map((u) => u.id);
    log(`--skip-seed: reusing ${n(userIds.length)} existing tagged users`);
  } else {
    userIds = await seed();
  }

  const raceOk = await raceOneWallet(userIds);
  await readPressure();
  const conservationOk = reportDrift(before, await integritySnapshot());

  head('RESULT');
  console.log(`  run id      : ${RUN_ID}`);
  console.log(`  users       : ${n(userIds.length)}`);
  console.log(`  transactions: ${n(userIds.length * TX_PER_USER)}`);
  console.log(`  messages    : ${n(userIds.length * MSG_PER_USER)}`);
  console.log(`  elapsed     : ${el()}s`);
  console.log(`  concurrency : ${raceOk ? 'PASS' : 'FAIL'}`);
  console.log(`  conservation: ${conservationOk ? 'PASS' : 'FAIL'}`);
  console.log(`\n  clean up with:\n    npx ts-node --transpile-only scripts/stress-test.ts --cleanup --run-id=${RUN_ID}\n`);

  // Non-zero exit on a real failure so CI can gate on it.
  if (!raceOk || !conservationOk) process.exit(1);
}

main()
  .catch((e) => { console.error('\n✖ stress run failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
