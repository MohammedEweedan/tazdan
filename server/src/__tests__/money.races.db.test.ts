/**
 * DB-backed exploit tests for money paths (see money.exploits.test.ts for the
 * mocked ones). They run in CI where Postgres is available; locally opt in
 * with RUN_DB_TESTS=1 against a disposable database. Without a database the
 * suite is skipped.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn(async (userId: string) => {
    const { prisma: db } = jest.requireActual('../utils/prisma');
    const n = Math.random().toString(36).slice(2, 12);
    return db.userWallet.create({ data: { userId, ethAddress: `0x${n}e`, btcAddress: `bc1${n}`, solAddress: `So${n}`, tronAddress: `T${n}` } });
  }),
}));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn().mockResolvedValue({ method: 'email' }),
  verifyStepUp: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `mrace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser() {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'test-hash', firstName: 'Race', lastName: 'Test', role: 'USER', status: 'ACTIVE',
      kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, referralCode: `${marker.slice(-10)}_${emails.length}`,
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function fund(userId: string, currency: 'USDT' | 'USD', amount: string) {
  await prisma.$transaction(async (tx) => {
    await postLedger(tx, {
      refType: 'test_opening', refId: `${marker}_${userId}_${currency}`,
      legs: [
        { type: 'SYSTEM_ONRAMP', currency, amount: new Decimal(amount).neg() },
        { type: 'USER', userId, currency, amount: new Decimal(amount) },
      ],
    });
  });
}
async function wallet(userId: string, currency: 'USDT' | 'USD') {
  const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency } } });
  return { balance: new Decimal(w?.balance.toString() ?? '0'), frozen: new Decimal(w?.frozen.toString() ?? '0') };
}

describeDb('money exploits against Postgres', () => {
  beforeAll(async () => {
    const [{ budgetRouter }, { p2pRouter }, { errorHandler }] = await Promise.all([
      import('../routes/budget'), import('../routes/p2p'), import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/budgets', budgetRouter);
    app.use('/api/p2p', p2pRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    const trades = await prisma.p2PTrade.findMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] }, select: { id: true } });
    await prisma.p2PTrade.deleteMany({ where: { id: { in: trades.map((t) => t.id) } } }).catch(() => {});
    await prisma.p2PListing.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('a date-locked budget cannot be unlocked by editing it, and stays frozen', async () => {
    const u = await createUser();
    await fund(u.id, 'USDT', '100');
    const created = await request(app).post('/api/budgets').set('Authorization', auth(u)).send({
      name: 'Hajj', currency: 'USDT', lockType: 'DATE', unlockDate: new Date(Date.now() + 90 * 86400_000).toISOString(),
    });
    expect(created.status).toBe(201);
    const id = created.body.budget.id;
    expect((await request(app).post(`/api/budgets/${id}/contribute`).set('Authorization', auth(u)).send({ amount: 60 })).status).toBe(200);

    const attempts = await Promise.all([
      request(app).patch(`/api/budgets/${id}`).set('Authorization', auth(u)).send({ lockType: 'NONE' }),
      request(app).patch(`/api/budgets/${id}`).set('Authorization', auth(u)).send({ unlockDate: new Date(Date.now() - 86400_000).toISOString() }),
      request(app).post(`/api/budgets/${id}/withdraw`).set('Authorization', auth(u)).send({ amount: 60 }),
      request(app).delete(`/api/budgets/${id}`).set('Authorization', auth(u)).send({}),
    ]);
    expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    const w = await wallet(u.id, 'USDT');
    expect(w.frozen.toString()).toBe('60');
    expect(w.balance.toString()).toBe('100');
  });

  it('a trade cannot spend funds reserved by a budget lock', async () => {
    const u = await createUser();
    await fund(u.id, 'USDT', '100');
    const created = await request(app).post('/api/budgets').set('Authorization', auth(u)).send({
      name: 'Locked', currency: 'USDT', lockType: 'DATE', unlockDate: new Date(Date.now() + 90 * 86400_000).toISOString(),
    });
    await request(app).post(`/api/budgets/${created.body.budget.id}/contribute`).set('Authorization', auth(u)).send({ amount: 100 });

    const { buildQuote } = await import('../services/exchange/priceEngine.service');
    const { executeQuote } = await import('../services/exchange/orderExecution.service');
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', side: 'BUY', fiatAmount: 100, settlementCurrency: 'USDT', userId: u.id });
    await expect(executeQuote({ userId: u.id, quoteId: quote.id })).rejects.toMatchObject({ statusCode: 400 });
    const w = await wallet(u.id, 'USDT');
    expect(w.balance.toString()).toBe('100');
    expect(w.frozen.toString()).toBe('100');
  });

  it('the seller cannot cancel a funded trade inside the payment window; the buyer can', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    await fund(seller.id, 'USDT', '100');
    const listing = await request(app).post('/api/p2p/listings').set('Authorization', auth(seller))
      .send({ currency: 'USDT', fiatCurrency: 'USD', side: 'SELL', price: 1, amount: 40, minLimit: 1, maxLimit: 40, paymentMethods: ['BANK_TRANSFER'] });
    const trade = await request(app).post('/api/p2p/trades').set('Authorization', auth(buyer)).send({ listingId: listing.body.listing.id, amount: 40 });
    expect(trade.status).toBe(201);
    const id = trade.body.trade.id;

    const [bySeller] = await Promise.all([
      request(app).put(`/api/p2p/trades/${id}/cancel`).set('Authorization', auth(seller)).send({}),
    ]);
    expect(bySeller.status).toBe(403);
    expect((await wallet(seller.id, 'USDT')).balance.toString()).toBe('60'); // still in escrow

    const byBuyer = await request(app).put(`/api/p2p/trades/${id}/cancel`).set('Authorization', auth(buyer)).send({});
    expect(byBuyer.status).toBe(200);
    expect((await wallet(seller.id, 'USDT')).balance.toString()).toBe('100');
  });
});
