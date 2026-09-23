/**
 * Concurrency tests for money-moving endpoints.
 *
 * Each test fires the same request several times in parallel against the
 * real HTTP routes and a real Postgres, then checks that the money moved
 * exactly once and no balance went negative.
 *
 * These run in CI where Postgres is available. Locally, opt in with
 * RUN_DB_TESTS=1 (point DATABASE_URL at a disposable database).
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn(),
}));
// Step-up codes are covered elsewhere; here they would only add noise.
jest.mock('../services/security/stepUp.service', () => ({
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn(),
  verifyStepUp: jest.fn(),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const PARALLEL = 6;
const marker = `conc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser(role: 'USER' | 'ADMIN' = 'USER') {
  const email = `${marker}_${role.toLowerCase()}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      firstName: 'Conc',
      lastName: 'Test',
      role,
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycTier: 'TIER_2',
      emailVerified: true,
      referralCode: `${marker.slice(-10)}_${emails.length}`,
    },
  });
}

function auth(user: { id: string; email: string; role: string }) {
  return `Bearer ${generateTokens(user).accessToken}`;
}

/** Give a user an opening balance through the ledger (which also writes Wallet). */
async function fund(userId: string, currency: 'USDT' | 'USD', amount: string) {
  await prisma.$transaction(async (tx) => {
    await postLedger(tx, {
      refType: 'test_opening',
      refId: `${marker}_${userId}_${currency}`,
      legs: [
        { type: 'SYSTEM_ONRAMP', currency, amount: new Decimal(amount).neg() },
        { type: 'USER', userId, currency, amount: new Decimal(amount) },
      ],
    });
  });
}

async function wallet(userId: string, currency: 'USDT' | 'USD') {
  const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency } } });
  return {
    balance: new Decimal(w?.balance.toString() ?? '0'),
    frozen: new Decimal(w?.frozen.toString() ?? '0'),
  };
}

function statuses(results: request.Response[]) {
  return results.map((r) => r.status);
}

describeDb('money endpoints under concurrent requests', () => {
  beforeAll(async () => {
    const routes = await Promise.all([
      import('../routes/admin'),
      import('../routes/claimLink'),
      import('../routes/p2p'),
      import('../routes/withdrawal'),
      import('../routes/messages'),
      import('../middleware/errorHandler'),
    ]);
    const [{ adminRouter }, { claimLinkRouter }, { p2pRouter }, { withdrawalRouter }, { messageRouter }, { errorHandler }] = routes;
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api/claim-links', claimLinkRouter);
    app.use('/api/p2p', p2pRouter);
    app.use('/api/withdrawals', withdrawalRouter);
    app.use('/api/messages', messageRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    // P2P rows reference users without cascade, so remove them first.
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    const trades = await prisma.p2PTrade.findMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] }, select: { id: true } });
    await prisma.p2PDispute.deleteMany({ where: { tradeId: { in: trades.map((t) => t.id) } } }).catch(() => {});
    await prisma.p2PTrade.deleteMany({ where: { id: { in: trades.map((t) => t.id) } } }).catch(() => {});
    await prisma.p2PListing.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('a claim link pays out once, however many times it is claimed at once', async () => {
    const sender = await createUser();
    const claimer = await createUser();
    await fund(sender.id, 'USDT', '100');

    const created = await request(app)
      .post('/api/claim-links')
      .set('Authorization', auth(sender))
      .send({ asset: 'USDT', amount: 40, recipientEmail: claimer.email });
    expect(created.status).toBe(201);
    const token = created.body.link.claimToken;

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app).post(`/api/claim-links/by-token/${token}/claim`).set('Authorization', auth(claimer)).send({}),
    ));
    expect(statuses(results).filter((s) => s === 200)).toHaveLength(1);

    const s = await wallet(sender.id, 'USDT');
    const c = await wallet(claimer.id, 'USDT');
    expect(s.balance.toString()).toBe('60');
    expect(s.frozen.toString()).toBe('0');
    expect(c.balance.toString()).toBe('40');
  });

  it('a claim link cannot be both claimed and cancelled', async () => {
    const sender = await createUser();
    const claimer = await createUser();
    await fund(sender.id, 'USDT', '50');

    const created = await request(app)
      .post('/api/claim-links')
      .set('Authorization', auth(sender))
      .send({ asset: 'USDT', amount: 50, recipientEmail: claimer.email });
    expect(created.status).toBe(201);
    const { id, claimToken } = created.body.link;

    const [claim, cancel] = await Promise.all([
      request(app).post(`/api/claim-links/by-token/${claimToken}/claim`).set('Authorization', auth(claimer)).send({}),
      request(app).post(`/api/claim-links/${id}/cancel`).set('Authorization', auth(sender)).send({}),
    ]);
    expect([claim.status, cancel.status].filter((st) => st === 200)).toHaveLength(1);

    const s = await wallet(sender.id, 'USDT');
    const c = await wallet(claimer.id, 'USDT');
    expect(s.frozen.toString()).toBe('0');
    // Either the claimer got the 50, or the sender kept it — never both.
    expect(s.balance.plus(c.balance).toString()).toBe('50');
  });

  it('a P2P trade is refunded once when cancelled concurrently', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    await fund(seller.id, 'USDT', '100');

    const listing = await request(app)
      .post('/api/p2p/listings')
      .set('Authorization', auth(seller))
      .send({ currency: 'USDT', fiatCurrency: 'USD', side: 'SELL', price: 1, amount: 30, minLimit: 1, maxLimit: 30, paymentMethods: ['BANK_TRANSFER'] });
    expect(listing.status).toBe(201);
    const listingId = listing.body.listing.id;

    const trade = await request(app)
      .post('/api/p2p/trades')
      .set('Authorization', auth(buyer))
      .send({ listingId, amount: 30 });
    expect(trade.status).toBe(201);
    const tradeId = trade.body.trade.id;
    const afterLock = await wallet(seller.id, 'USDT');

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app).put(`/api/p2p/trades/${tradeId}/cancel`).set('Authorization', auth(buyer)).send({}),
    ));
    expect(statuses(results).filter((s) => s === 200)).toHaveLength(1);

    const after = await wallet(seller.id, 'USDT');
    // One refund: the reservation is released once and the balance is back
    // to its pre-trade level exactly once.
    expect(after.frozen.toString()).toBe(afterLock.frozen.minus(30).toString());
    expect(after.balance.toString()).toBe('100');
  });

  it('a deposit is credited once when confirmed concurrently', async () => {
    const admin = await createUser('ADMIN');
    const user = await createUser();
    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        currency: 'USD',
        amount: new Decimal('75'),
        paymentMethod: 'BANK_TRANSFER',
        status: 'WAITING_CONFIRMATION',
        reference: `${marker}_dep`,
      },
    });

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app).put(`/api/admin/deposits/${deposit.id}/confirm`).set('Authorization', auth(admin)).send({}),
    ));
    expect(statuses(results).filter((s) => s === 200)).toHaveLength(1);
    expect((await wallet(user.id, 'USD')).balance.toString()).toBe('75');
  });

  it('parallel withdrawal requests never reserve more than the balance', async () => {
    const user = await createUser();
    await fund(user.id, 'USDT', '100');

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app)
        .post('/api/withdrawals')
        .set('Authorization', auth(user))
        .send({ currency: 'USDT', amount: 30, network: 'TRC20', walletAddress: 'TXYZabcdefghijklmnopqrstuvwxyz1234' }),
    ));
    const accepted = statuses(results).filter((s) => s === 201).length;
    expect(accepted).toBe(3); // 3 × 30 fits in 100; a 4th would not

    const w = await wallet(user.id, 'USDT');
    expect(w.frozen.toString()).toBe('90');
    expect(w.frozen.lte(w.balance)).toBe(true);
  });

  it('a chat payment with a non-positive amount moves nothing', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    await fund(receiver.id, 'USD', '20');

    for (const amount of [-5, 0]) {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', auth(sender))
        .send({ receiverId: receiver.id, content: 'pay', type: 'PAYMENT', metadata: { amount, currency: 'USD' } });
      expect(res.status).toBe(400);
    }
    expect((await wallet(receiver.id, 'USD')).balance.toString()).toBe('20');
  });

  it('parallel chat payments never spend more than the balance', async () => {
    const sender = await createUser();
    const receivers = await Promise.all(Array.from({ length: PARALLEL }, () => createUser()));
    await fund(sender.id, 'USD', '50');

    const results = await Promise.all(receivers.map((r) =>
      request(app)
        .post('/api/messages')
        .set('Authorization', auth(sender))
        .send({ receiverId: r.id, content: 'pay', type: 'PAYMENT', metadata: { amount: 20, currency: 'USD' } }),
    ));
    expect(statuses(results).filter((s) => s === 201)).toHaveLength(2); // 2 × 20 fits in 50

    const s = await wallet(sender.id, 'USD');
    expect(s.balance.toString()).toBe('10');
    let received = new Decimal(0);
    for (const r of receivers) received = received.plus((await wallet(r.id, 'USD')).balance);
    expect(received.toString()).toBe('40');
  });
});
