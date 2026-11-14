/**
 * Golden remittance flows, end to end against Postgres (RUN_DB_TESTS=1 / CI).
 *
 *  1. Tripoli → London: Mohammed sends £1,000 to his daughter. Beneficiary,
 *     quote, screening, risk review, funding, routing, settlement, sandbox
 *     payout, provider status, reconciliation, receipt — with the exact
 *     ledger journals checked at each step.
 *  2. London → Tripoli: £500 paid into a Tazdan wallet (internal rail).
 *  3. Payout failure → automatic full refund.
 *  4. Idempotency and a double-spend race on one quote.
 *  5. Ledger and clearing invariants after everything.
 *
 * Fulus rates are fixed at the provider boundary; other fiat pairs use treasury
 * overrides. The remittance flow runs against Postgres without a network feed.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { postLedger } from '../services/ledger/ledger.service';
import { bootstrapPlatform } from '../services/platform/bootstrap';
import { moveTreasury } from '../services/treasury/pools.service';
import { createQuote } from '../services/remittance/pricing';
import { createBeneficiary, createTransfer, decideReview, pollPendingPayouts } from '../services/remittance/remittance.service';
import { runIntegrityReconciliation, runProviderReconciliation, completeInternalPayouts } from '../services/reconciliation/recon.service';
import { importWatchlist } from '../services/compliance/screening.service';

jest.mock('../services/exchange/fulus.service', () => ({
  ...jest.requireActual('../services/exchange/fulus.service'),
  getFulusLydRate: jest.fn(async (currency: string) => {
    const rates: Record<string, number> = { GBP: 6.9, USD: 1 / 0.146 };
    return rates[currency] ?? null;
  }),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `rm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
const D = (v: unknown) => new Decimal(String(v ?? 0));

async function user(first: string, last: string, country: string, opts: { username?: string; kyc?: boolean } = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: first, lastName: last, country, status: 'ACTIVE',
      kycStatus: opts.kyc === false ? 'PENDING' : 'APPROVED', kycTier: 'TIER_2', emailVerified: true,
      username: opts.username ?? `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(0, 30),
    },
  });
}

async function fund(userId: string, currency: 'LYD' | 'GBP', amount: string) {
  await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({ where: { userId_currency: { userId, currency } }, create: { userId, currency, balance: amount }, update: { balance: { increment: amount } } });
    await postLedger(tx, { refType: 'test_fund', refId: `${userId}:${currency}`, legs: [
      { type: 'SYSTEM_ONRAMP', currency, amount: D(amount).neg() },
      { type: 'USER', userId, currency, amount: D(amount) },
    ] });
  });
}

async function pinRate(base: string, quote: string, mid: number) {
  const buy = mid * 1.001; const sell = mid * 0.999;
  await prisma.exchangeRate.upsert({
    where: { baseCurrency_quoteCurrency: { baseCurrency: base as any, quoteCurrency: quote as any } },
    create: { baseCurrency: base as any, quoteCurrency: quote as any, buyPrice: buy, sellPrice: sell, isActive: true, setBy: 'test', overrideReason: 'golden test', overrideExpiresAt: new Date(Date.now() + 3600_000) },
    update: { buyPrice: buy, sellPrice: sell, isActive: true, setBy: 'test', overrideReason: 'golden test', overrideExpiresAt: new Date(Date.now() + 3600_000) },
  });
}

async function wallet(userId: string, currency: string) {
  return prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: currency as any } } });
}

async function journal(refType: string, refId: string) {
  return prisma.ledgerEntry.findMany({ where: { refType, refId }, include: { account: true } });
}

describeDb('golden remittance flows', () => {
  let staffId: string;

  beforeAll(async () => {
    process.env.SANDBOX_TIME_SCALE = '1000000'; // sandbox SLA elapses almost instantly
    await bootstrapPlatform({ workers: false });
    // LYD pairs use the fixed Fulus feed above; pin the non-Fulus USD reference.
    await pinRate('GBP', 'USD', 1.27);
    const staff = await user('Compliance', 'Officer', 'LY');
    await prisma.user.update({ where: { id: staff.id }, data: { role: 'ADMIN', staffRoles: ['COMPLIANCE', 'TREASURY'] } });
    staffId = staff.id;
    // An internal watchlist entry so screening runs with coverage (it must not match our people).
    await importWatchlist([{ listName: 'INTERNAL', entityType: 'PERSON', name: 'Zzyzx Qwerty Placeholder', country: 'XX' }], 'golden-test', staffId);
    // Treasury prefunds the sandbox UK rail and the internal LYD wallet pool.
    const gbPool = await prisma.treasuryPool.findUniqueOrThrow({ where: { code: 'SANDBOX_GB_FPS-GBP' } });
    const lyPool = await prisma.treasuryPool.findUniqueOrThrow({ where: { code: 'TAZDAN_WALLET-LYD' } });
    await moveTreasury({ poolId: gbPool.id, direction: 'PREFUND', amount: '50000', reference: `${marker}-gb`, note: 'golden test prefund', actorId: staffId });
    await moveTreasury({ poolId: lyPool.id, direction: 'PREFUND', amount: '200000', reference: `${marker}-ly`, note: 'golden test prefund', actorId: staffId });
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('Tripoli → London: Mohammed sends £1,000 to his daughter', async () => {
    const mohammed = await user('Mohammed', 'Al-Tarhuni', 'LY');
    await fund(mohammed.id, 'LYD', '10000');

    // Beneficiary with UK bank details is created and screened.
    const daughter = await createBeneficiary(mohammed.id, {
      fullName: 'Amira Al-Tarhuni', relationship: 'Daughter', country: 'GB', currency: 'GBP',
      payoutMethod: 'BANK_ACCOUNT', bankName: 'Sandbox Bank UK', sortCode: '040004', accountNumber: '12345678', city: 'London',
    });
    expect(daughter.screeningStatus).toBe('CLEAR');

    // Quote: recipient gets exactly £1,000.
    const q = await createQuote({ userId: mohammed.id, corridorCode: 'LY-GB', receiveAmount: 1000, payoutMethod: 'BANK_ACCOUNT', beneficiaryCountry: 'GB' });
    expect(q.quote.rateSource).toContain('fulus');
    expect(q.quote.receiveAmount.toString()).toBe('1000');
    expect(Number(q.quote.customerRate)).toBeLessThan(Number(q.quote.baseRate));
    expect(D(q.quote.totalDebit).equals(D(q.quote.sendAmount).plus(q.quote.feeAmount))).toBe(true);
    expect(q.routes.find((r) => r.eligible)?.providerCode).toBe('SANDBOX_GB_FPS');
    expect(q.sandbox).toBe(true);

    // New beneficiary + high value → compliance review; funds are held in clearing.
    const created = await createTransfer({ userId: mohammed.id, quoteId: q.quote.id, beneficiaryId: daughter.id, purpose: 'FAMILY_SUPPORT', knownDevice: true });
    expect(created.outcome).toBe('MANUAL_REVIEW');
    const transferId = created.transfer.id;
    const funding = await journal('remittance_funding', transferId);
    expect(funding.map((e) => e.account.type).sort()).toEqual(['REMITTANCE_CLEARING', 'USER']);
    expect((await wallet(mohammed.id, 'LYD'))!.balance.toString()).toBe(D('10000').minus(q.quote.totalDebit).toString());
    const decision = await prisma.riskDecision.findFirstOrThrow({ where: { subjectId: transferId } });
    expect(decision.triggeredRules).toContain('NEW_BENEFICIARY_HIGH_VALUE');
    expect(await prisma.complianceCase.count({ where: { subjectId: transferId } })).toBe(1);

    // Compliance approves → routed, settled from the prefunded pool, submitted to the sandbox rail.
    const approved = await decideReview(transferId, true, staffId, 'Daughter studying in London; documents on file');
    expect(approved.state).toBe('PAYOUT_PENDING');
    expect(approved.providerCode).toBe('SANDBOX_GB_FPS');
    // The review decision closes the case that was opened for it.
    const reviewCase = await prisma.complianceCase.findFirstOrThrow({ where: { subjectId: transferId } });
    expect(reviewCase.status).toBe('CLOSED');
    expect(reviewCase.resolution).toContain('approved');

    // Provider reports PAID (status poll) → payout journal posted.
    await new Promise((r) => setTimeout(r, 20));
    await pollPendingPayouts();
    const paid = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: transferId } });
    expect(paid.state).toBe('RECONCILIATION_PENDING');
    const payout = await journal('remittance_payout', transferId);
    const leg = (type: string, ccy: string) => payout.filter((e) => e.account.type === type && e.currency === ccy).reduce((n, e) => n.plus(e.amount), new Decimal(0));
    expect(leg('REMITTANCE_CLEARING', 'LYD').toString()).toBe(D(paid.totalDebit).neg().toString());
    expect(leg('TREASURY', 'GBP').toString()).toBe('-1000');
    expect(leg('SYSTEM_OFFRAMP', 'GBP').toString()).toBe('1000');
    expect(leg('PLATFORM', 'LYD').gt(paid.feeAmount.toString())).toBe(true); // fee + FX margin
    expect(leg('TREASURY', 'LYD').plus(leg('PLATFORM', 'LYD')).toString()).toBe(D(paid.totalDebit).toString());

    // Reconciliation against the provider statement completes it.
    const run = await runProviderReconciliation('SANDBOX_GB_FPS', new Date(Date.now() - 3600_000), new Date(Date.now() + 60_000));
    expect((run.totals as any).MATCHED).toBeGreaterThanOrEqual(1);
    const done = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: transferId } });
    expect(done.state).toBe('COMPLETED');

    // Full, ordered lifecycle is recorded.
    const states = (await prisma.stateTransition.findMany({ where: { entityType: 'REMITTANCE', entityId: transferId }, orderBy: { createdAt: 'asc' } })).map((s) => s.toState);
    for (const s of ['QUOTED', 'COMPLIANCE_PENDING', 'MANUAL_REVIEW', 'FUNDED', 'APPROVED', 'ROUTED', 'SETTLED', 'PAYOUT_PENDING', 'PAID', 'RECONCILED', 'COMPLETED']) {
      expect(states).toContain(s);
    }
    expect(await prisma.auditLog.count({ where: { action: 'REMITTANCE_REVIEW_APPROVE', entityId: transferId } })).toBe(1);
  });

  it('London → Tripoli: £500 into a Tazdan wallet', async () => {
    const sender = await user('Sara', 'Haddad', 'GB');
    const recipient = await user('Khaled', 'Haddad', 'LY', { username: `${marker}khaled`.slice(0, 30) });
    await fund(sender.id, 'GBP', '2000');
    const b = await createBeneficiary(sender.id, { fullName: 'Khaled Haddad', country: 'LY', currency: 'LYD', payoutMethod: 'TAZDAN_WALLET', tazdanHandle: recipient.username! });
    const q = await createQuote({ userId: sender.id, corridorCode: 'GB-LY', sendAmount: 500, payoutMethod: 'TAZDAN_WALLET' });
    // Pre-age the beneficiary so this flow is not held for review.
    await prisma.remittanceBeneficiary.update({ where: { id: b.id }, data: { createdAt: new Date(Date.now() - 3 * 86400_000) } });
    const r = await createTransfer({ userId: sender.id, quoteId: q.quote.id, beneficiaryId: b.id, purpose: 'FAMILY_SUPPORT', knownDevice: true });
    expect(['ROUTED', 'MANUAL_REVIEW']).toContain(r.outcome);
    if (r.outcome === 'MANUAL_REVIEW') await decideReview(r.transfer.id, true, staffId, 'Reviewed');
    const t = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: r.transfer.id } });
    expect(t.state).toBe('RECONCILIATION_PENDING');
    expect((await wallet(recipient.id, 'LYD'))!.balance.toString()).toBe(t.receiveAmount.toString());
    await completeInternalPayouts();
    expect((await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } })).state).toBe('COMPLETED');
  });

  it('a failed payout is refunded in full, fee included', async () => {
    const s = await user('Omar', 'Benali', 'LY');
    await fund(s.id, 'LYD', '5000');
    const b = await createBeneficiary(s.id, { fullName: 'Lina Benali', country: 'GB', currency: 'GBP', payoutMethod: 'BANK_ACCOUNT', sortCode: '040004', accountNumber: '87654321' });
    await prisma.remittanceBeneficiary.update({ where: { id: b.id }, data: { createdAt: new Date(Date.now() - 3 * 86400_000) } });
    // Sandbox magic amount .13 → beneficiary account closed.
    const q = await createQuote({ userId: s.id, corridorCode: 'LY-GB', receiveAmount: '100.13', payoutMethod: 'BANK_ACCOUNT', beneficiaryCountry: 'GB' });
    const r = await createTransfer({ userId: s.id, quoteId: q.quote.id, beneficiaryId: b.id, purpose: 'GIFT', knownDevice: true });
    if (r.outcome === 'MANUAL_REVIEW') await decideReview(r.transfer.id, true, staffId, 'ok');
    const t = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: r.transfer.id } });
    expect(t.state).toBe('REFUNDED');
    expect((await wallet(s.id, 'LYD'))!.balance.toString()).toBe('5000');
    const refund = await journal('remittance_refund', t.id);
    expect(refund.length).toBe(2);
    expect(await prisma.remittanceRefund.count({ where: { transferId: t.id } })).toBe(1);
  });

  it('is idempotent and spends a quote only once under concurrency', async () => {
    const s = await user('Huda', 'Mansour', 'LY');
    await fund(s.id, 'LYD', '20000');
    const b = await createBeneficiary(s.id, { fullName: 'Yusuf Mansour', country: 'GB', currency: 'GBP', payoutMethod: 'BANK_ACCOUNT', sortCode: '040004', accountNumber: '11112222' });
    await prisma.remittanceBeneficiary.update({ where: { id: b.id }, data: { createdAt: new Date(Date.now() - 3 * 86400_000) } });

    const q1 = await createQuote({ userId: s.id, corridorCode: 'LY-GB', receiveAmount: 50, payoutMethod: 'BANK_ACCOUNT', beneficiaryCountry: 'GB' });
    const key = `${marker}-idem`;
    const a = await createTransfer({ userId: s.id, quoteId: q1.quote.id, beneficiaryId: b.id, purpose: 'GIFT', idempotencyKey: key, knownDevice: true });
    const again = await createTransfer({ userId: s.id, quoteId: q1.quote.id, beneficiaryId: b.id, purpose: 'GIFT', idempotencyKey: key, knownDevice: true });
    expect(again.duplicate).toBe(true);
    expect(again.transfer.id).toBe(a.transfer.id);

    const q2 = await createQuote({ userId: s.id, corridorCode: 'LY-GB', receiveAmount: 60, payoutMethod: 'BANK_ACCOUNT', beneficiaryCountry: 'GB' });
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => createTransfer({ userId: s.id, quoteId: q2.quote.id, beneficiaryId: b.id, purpose: 'GIFT', knownDevice: true })));
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.remittanceTransfer.count({ where: { quoteId: q2.quote.id } })).toBe(1);
  });

  it('leaves the ledger balanced and clearing equal to transfers in flight', async () => {
    const conservation = await prisma.ledgerEntry.groupBy({ by: ['currency'], _sum: { amount: true } });
    for (const c of conservation) expect(Math.abs(Number(c._sum.amount))).toBeLessThan(1e-9);
    await runIntegrityReconciliation();
    // Open exceptions are de-duplicated across runs, so check every open one, not just this run's.
    const items = await prisma.reconciliationItem.findMany({ where: { run: { source: 'LEDGER_INTEGRITY' }, resolution: 'OPEN', internalType: { in: ['REMITTANCE_CLEARING', 'TREASURY_POOLS', 'LEDGER_ACCOUNT_CACHE', 'LEDGER_CONSERVATION'] } } });
    expect(items).toEqual([]);
  });

  it('opens one exception per integrity break and clears it when the break is fixed', async () => {
    const u = await user('Recon', 'Probe', 'LY');
    await fund(u.id, 'LYD', '100');
    const key = { internalType: 'WALLET_READ_MODEL', internalId: `${u.id}:LYD`, run: { source: 'LEDGER_INTEGRITY' } };
    // Break the read model on purpose (wallet says 150, ledger says 100).
    await prisma.wallet.update({ where: { userId_currency: { userId: u.id, currency: 'LYD' } }, data: { balance: '150' } });
    await runIntegrityReconciliation();
    const second = await runIntegrityReconciliation();
    const open = await prisma.reconciliationItem.findMany({ where: { ...key, resolution: 'OPEN' } });
    expect(open).toHaveLength(1);
    expect((second.totals as any).stillOpen).toBeGreaterThanOrEqual(1);
    // Repair it → the next run closes the exception with an explanation.
    await prisma.wallet.update({ where: { userId_currency: { userId: u.id, currency: 'LYD' } }, data: { balance: '100' } });
    await runIntegrityReconciliation();
    const after = await prisma.reconciliationItem.findFirstOrThrow({ where: key });
    expect(after.resolution).toBe('RESOLVED');
    expect(after.resolutionNote).toContain('Cleared automatically');
  });
});
