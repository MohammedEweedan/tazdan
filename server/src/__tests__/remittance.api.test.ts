/**
 * Customer remittance HTTP API — the contract the mobile "Send abroad" screens use:
 * corridors → add recipient → quote → send → track → cancel (refund), step-up on
 * an unknown device, and customer-safe wording. RUN_DB_TESTS=1 locally; always in CI.
 */
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { bootstrapPlatform } from '../services/platform/bootstrap';
import { deviceFingerprint, rememberDevice } from '../services/security/stepUp.service';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));
// LYD pricing deliberately ignores manual overrides; supply a deterministic
// Fulus feed while exercising the real quote, transfer and ledger paths.
jest.mock('../services/exchange/fulus.service', () => ({
  ...jest.requireActual('../services/exchange/fulus.service'),
  getFulusLydRate: jest.fn(async (currency: string) => {
    const rates: Record<string, number> = { GBP: 6.9, USD: 1 / 0.146 };
    return rates[currency] ?? null;
  }),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `ra${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DEVICE = { 'user-agent': 'TazdanMobile/1.0 test', 'x-device-id': `${marker}-device` };

async function pin(base: string, quote: string, mid: number) {
  await prisma.exchangeRate.upsert({
    where: { baseCurrency_quoteCurrency: { baseCurrency: base as any, quoteCurrency: quote as any } },
    create: { baseCurrency: base as any, quoteCurrency: quote as any, buyPrice: mid * 1.001, sellPrice: mid * 0.999, isActive: true, setBy: 'test', overrideReason: 'api test', overrideExpiresAt: new Date(Date.now() + 3600_000) },
    update: { buyPrice: mid * 1.001, sellPrice: mid * 0.999, isActive: true, setBy: 'test', overrideReason: 'api test', overrideExpiresAt: new Date(Date.now() + 3600_000) },
  });
}

describeDb('customer remittance API', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await bootstrapPlatform({ workers: false });
    await pin('GBP', 'USD', 1.27);
    const u = await prisma.user.create({
      data: { email: `${marker}@example.com`, passwordHash: 'x', firstName: 'Salem', lastName: 'Api', country: 'LY', status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, username: marker, referralCode: `${marker}r` },
    });
    userId = u.id;
    token = `Bearer ${generateTokens(u as any).accessToken}`;
    await prisma.$transaction(async (tx) => {
      await tx.wallet.create({ data: { userId: u.id, currency: 'LYD', balance: '5000' } });
      await postLedger(tx, { refType: 'test_fund', refId: `${u.id}:LYD`, legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'LYD', amount: new Decimal('-5000') },
        { type: 'USER', userId: u.id, currency: 'LYD', amount: new Decimal('5000') },
      ] });
    });
    // The test device is already trusted, as a phone would be after its first verified login.
    await rememberDevice(u.id, deviceFingerprint({ headers: DEVICE }));
    // The sandbox UK rail needs prefunded liquidity to route.
    const pool = await prisma.treasuryPool.findUniqueOrThrow({ where: { code: 'SANDBOX_GB_FPS-GBP' } });
    const { moveTreasury } = await import('../services/treasury/pools.service');
    await moveTreasury({ poolId: pool.id, direction: 'PREFUND', amount: '5000', reference: `${marker}-prefund`, note: 'api test prefund', actorId: u.id });
  });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  const call = (method: 'get' | 'post' | 'delete', path: string) => (request(app) as any)[method](`/api/remittance${path}`).set('Authorization', token).set(DEVICE);

  it('runs the mobile flow end to end and never exposes internal states or screening', async () => {
    const corridors = await call('get', '/corridors');
    expect(corridors.status).toBe(200);
    const lyGb = corridors.body.corridors.find((c: any) => c.code === 'LY-GB');
    expect(lyGb).toMatchObject({ available: true, sandbox: true, sourceCurrency: 'LYD', destCurrency: 'GBP' });

    const bad = await call('post', '/beneficiaries').send({ fullName: 'Leila Api', country: 'GB', currency: 'GBP', payoutMethod: 'BANK_ACCOUNT', sortCode: '12', accountNumber: '1' });
    expect(bad.status).toBe(400);
    const ben = await call('post', '/beneficiaries').send({ fullName: 'Leila Api', relationship: 'Sister', country: 'GB', currency: 'GBP', payoutMethod: 'BANK_ACCOUNT', sortCode: '04-00-04', accountNumber: '12345678' });
    expect(ben.status).toBe(201);
    expect(ben.body.beneficiary).not.toHaveProperty('screeningStatus');

    const quote = await call('post', '/quotes').send({ corridorCode: 'LY-GB', sendAmount: 300, beneficiaryId: ben.body.beneficiary.id });
    expect(quote.status).toBe(201);
    expect(quote.body.quote).toMatchObject({ payoutAvailable: true, sandbox: true });
    expect(Number(quote.body.quote.totalDebit)).toBeCloseTo(300 + Number(quote.body.quote.feeAmount), 6);

    const key = `${marker}-k1`;
    const sent = await call('post', '/transfers').send({ quoteId: quote.body.quote.id, beneficiaryId: ben.body.beneficiary.id, purpose: 'FAMILY_SUPPORT', idempotencyKey: key });
    expect(sent.status).toBe(201);
    const id = sent.body.transfer.id;
    // Retrying the same request returns the same transfer, not a second debit.
    const again = await call('post', '/transfers').send({ quoteId: quote.body.quote.id, beneficiaryId: ben.body.beneficiary.id, purpose: 'FAMILY_SUPPORT', idempotencyKey: key });
    expect(again.body.transfer.id).toBe(id);
    expect(again.body.duplicate).toBe(true);
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId, currency: 'LYD' } } });
    expect(new Decimal(w.balance.toString()).toString()).toBe(new Decimal('5000').minus(quote.body.quote.totalDebit).toString());

    const detail = await call('get', `/transfers/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.timeline.length).toBeGreaterThan(0);
    expect(detail.body.transfer).not.toHaveProperty('riskScore');
    expect(detail.body.transfer).not.toHaveProperty('providerRef');

    const list = await call('get', '/transfers');
    expect(list.body.transfers.map((t: any) => t.id)).toContain(id);
  });

  it('asks an unknown device for a security code before sending', async () => {
    const ben = (await call('get', '/beneficiaries')).body.beneficiaries[0];
    const quote = await call('post', '/quotes').send({ corridorCode: 'LY-GB', sendAmount: 150, beneficiaryId: ben.id });
    const res = await request(app).post('/api/remittance/transfers').set('Authorization', token)
      .set({ 'user-agent': 'SomeOtherPhone/2.0', 'x-device-id': `${marker}-new-device` })
      .send({ quoteId: quote.body.quote.id, beneficiaryId: ben.id, purpose: 'GIFT', idempotencyKey: `${marker}-k2` });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', requiresStepUp: true });
  });

  it('cancels a transfer before payout and refunds it in full', async () => {
    const ben = (await call('get', '/beneficiaries')).body.beneficiaries[0];
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId, currency: 'LYD' } } });
    // A whole-pound payout avoids the sandbox's .13 failure / .31 return
    // amounts, so this specifically exercises cancellation of a pending payout.
    const quote = await call('post', '/quotes').send({ corridorCode: 'LY-GB', receiveAmount: 20, beneficiaryId: ben.id });
    const sent = await call('post', '/transfers').send({ quoteId: quote.body.quote.id, beneficiaryId: ben.id, purpose: 'GIFT', idempotencyKey: `${marker}-k3` });
    expect(sent.status).toBe(201);
    const pending = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: sent.body.transfer.id } });
    expect(pending.state).toBe('PAYOUT_PENDING');
    const cancelled = await call('post', `/transfers/${sent.body.transfer.id}/cancel`);
    expect(cancelled.status).toBe(200);
    // Still with the payout partner (sandbox SLA not elapsed): cancelled there, then refunded in full.
    expect(cancelled.body.transfer.state).toBe('REFUNDED');
    expect(cancelled.body.transfer.failureReason).toBe('The full amount, including the fee, was returned to your wallet.');
    const after = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId, currency: 'LYD' } } });
    expect(after.balance.toString()).toBe(before.balance.toString());
  });
});
