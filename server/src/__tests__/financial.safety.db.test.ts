import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const SCHEMA = `fs_${Date.now().toString(36)}`;
if (RUN_DB) {
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('schema', SCHEMA); process.env.DATABASE_URL = url.toString();
}

(RUN_DB ? describe : describe.skip)('exact accounting and treasury controls in PostgreSQL', () => {
  let prisma: any;
  let ledger: typeof import('../services/ledger/ledger.service');
  let pools: typeof import('../services/treasury/pools.service');
  let staffId: string;
  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { env: process.env, stdio: 'pipe' });
    ({ prisma } = await import('../utils/prisma'));
    expect((await prisma.$queryRawUnsafe('SELECT current_schema() AS schema'))[0].schema).toBe(SCHEMA);
    ledger = await import('../services/ledger/ledger.service');
    pools = await import('../services/treasury/pools.service');
    staffId = (await prisma.user.create({ data: { email: `${SCHEMA}@example.com`, passwordHash: 'x', firstName: 'Finance', lastName: 'Test', referralCode: SCHEMA } })).id;
  }, 120_000);
  afterAll(async () => { if (prisma) { await prisma.$executeRawUnsafe(`DROP SCHEMA "${SCHEMA}" CASCADE`); await prisma.$disconnect(); } });

  it('serialises simultaneous first postings into one system account', async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => prisma.$transaction((tx: any) => ledger.postLedger(tx, {
      refType: 'parallel', refId: String(i), legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: '-1' }, { type: 'USER', userId: staffId, currency: 'USD', amount: '1' },
      ],
    }), { timeout: 20_000 })));
    expect(await prisma.ledgerAccount.count({ where: { type: 'SYSTEM_ONRAMP', currency: 'USD', userId: null } })).toBe(1);
    expect((await prisma.wallet.findUnique({ where: { userId_currency: { userId: staffId, currency: 'USD' } } })).balance.toString()).toBe('8');
  });

  it('rejects atomic-unit imbalance and wrong account currency at the database boundary', async () => {
    const account = await prisma.ledgerAccount.findFirst({ where: { type: 'SYSTEM_ONRAMP', currency: 'USD' } });
    await expect(prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.create({ data: { groupId: randomUUID(), accountId: account.id, currency: 'USD', amount: '0.000000000000000001', refType: 'dust' } });
    })).rejects.toThrow(/Unbalanced/);
    await expect(prisma.ledgerEntry.create({ data: { groupId: randomUUID(), accountId: account.id, currency: 'EUR', amount: '1', refType: 'wrong_currency' } })).rejects.toThrow(/currency differs/);
  });

  it('applies exact deferred conservation to dynamic assets too', async () => {
    const id = randomUUID();
    await prisma.assetLedgerAccount.create({ data: { id, type: 'SYSTEM_CHAIN', asset: 'TESTCOIN' } });
    await expect(prisma.$transaction(async (tx: any) => {
      await tx.assetLedgerEntry.create({ data: { id: randomUUID(), groupId: randomUUID(), accountId: id, asset: 'TESTCOIN', amount: '0.000000000000000001', refType: 'dust' } });
    })).rejects.toThrow(/Unbalanced asset/);
    expect(await prisma.assetLedgerEntry.count({ where: { accountId: id } })).toBe(0);
  });

  it('surfaces deferred failures for batch transactions and preserves successful batch results', async () => {
    const account = await prisma.ledgerAccount.findFirst({ where: { type: 'SYSTEM_ONRAMP', currency: 'USD' } });
    await expect(prisma.$transaction([
      prisma.ledgerEntry.create({ data: { groupId: randomUUID(), accountId: account.id, currency: 'USD', amount: '0.000000000000000001', refType: 'batch_dust' } }),
    ])).rejects.toThrow(/Unbalanced/);
    expect(await prisma.$transaction([prisma.user.count({ where: { id: staffId } })])).toEqual([1]);
  });

  it('books a repeated treasury bank reference once and rejects changed amounts or unrepresentable precision', async () => {
    const p = await prisma.treasuryPool.create({ data: { code: SCHEMA, name: 'Test pool', currency: 'USD', entity: 'TEST', location: 'BANK', providerCode: 'TEST', target: 100, minimum: 0, maxExposure: 1000 } });
    const input = { poolId: p.id, direction: 'PREFUND' as const, amount: '100', reference: 'BANK-1', note: 'Verified test bank transfer', actorId: staffId };
    const result = await Promise.all([pools.moveTreasury(input), pools.moveTreasury(input)]);
    expect(result[0].id).toBe(result[1].id);
    expect(await prisma.treasuryMovement.count({ where: { poolId: p.id, type: 'PREFUND' } })).toBe(1);
    await expect(pools.moveTreasury({ ...input, amount: '101' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(pools.moveTreasury({ ...input, amount: '0.000000001', reference: 'BANK-2' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('serialises cumulative customer limits across parallel committing payments', async () => {
    const { enforceKycLimit, limitStatus } = await import('../utils/kycLimits');
    await prisma.user.update({ where: { id: staffId }, data: { kycStatus: 'APPROVED', kycTier: 'TIER_1' } });
    // Four requests each fit the per-transfer cap and all pass preflight.
    // Together they exceed the $2,000/day allowance; only two may commit.
    await Promise.all(Array.from({ length: 4 }, () => enforceKycLimit(staffId, 'SEND', '750', 'USD')));
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => prisma.$transaction(async (tx: any) => {
      await enforceKycLimit(staffId, 'SEND', '750', 'USD', tx);
      await tx.transaction.create({ data: { userId: staffId, type: 'TRANSFER_OUT', currency: 'USD', amount: '-750', fee: 0, balanceBefore: 0, balanceAfter: 0 } });
    }, { timeout: 20_000 })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
    expect((await limitStatus(staffId, 'SEND')).daily.usedUsd).toBe(1500);
  });
});
