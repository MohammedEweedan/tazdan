/**
 * Ledger reconciliation must not report drift (and halt trading) just because
 * postings are committing while it runs. RUN_DB_TESTS=1 locally; always in CI.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { postLedger } from '../services/ledger/ledger.service';
import { isTradingHalted, reconcileLedger, setTradingHalt } from '../services/ledger/reconcile.service';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `rc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

describeDb('ledger reconciliation under concurrent postings', () => {
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it('sees one consistent snapshot', async () => {
    const haltedBefore = await isTradingHalted();
    const u = await prisma.user.create({
      data: { email: `${marker}@example.com`, passwordHash: 'x', firstName: 'Recon', lastName: 'Race', status: 'ACTIVE', username: marker.slice(0, 30), referralCode: `${marker}r`.slice(0, 30) },
    });
    const post = (i: number) => prisma.$transaction((tx) => postLedger(tx, {
      refType: 'test_race', refId: `${marker}:${i}`,
      legs: [{ type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal(-1) }, { type: 'USER', userId: u.id, currency: 'USD', amount: new Decimal(1) }],
    }));
    const results = await Promise.all([
      ...Array.from({ length: 40 }, (_, i) => post(i)),
      ...Array.from({ length: 12 }, () => reconcileLedger()),
    ]);
    const mine = await prisma.ledgerAccount.findMany({ where: { userId: u.id }, select: { id: true } });
    const ids = new Set(mine.map((a) => a.id));
    for (const r of results.slice(40) as Awaited<ReturnType<typeof reconcileLedger>>[]) {
      expect(r.cacheDrift.filter((d) => ids.has(d.accountId))).toEqual([]);
    }
    if (!haltedBefore) await setTradingHalt(false, 'reset after reconciliation race test');
  });
});
