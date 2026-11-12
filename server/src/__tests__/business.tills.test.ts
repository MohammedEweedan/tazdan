/**
 * Business tills: per-till QR codes, payments tagged with the till, the
 * kiosk feed and per-till metrics.
 *
 *   - only OWNER/ADMIN create or close tills; KYB must be approved
 *   - the till code carries the till (and an optional amount)
 *   - a payment with a till id is attributed to it; another business's till
 *     or a closed till is refused before any money moves
 *   - the kiosk feed returns payments since a time, payer as first name + initial
 *   - metrics count and total per currency
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a
 * disposable database.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn() }));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn(),
  verifyStepUp: jest.fn(),
}));
jest.mock('../services/push.service', () => ({
  ...jest.requireActual('../services/push.service'),
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
  pushTxEvent: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `tills_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser(first = 'Till', last = 'Test') {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: first, lastName: last, role: 'USER', status: 'ACTIVE',
      kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, referralCode: `${marker.slice(-10)}_${emails.length}`,
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function business(kyb: 'APPROVED' | 'PENDING' = 'APPROVED') {
  const owner = await createUser('Shop', 'Owner');
  await prisma.businessProfile.create({ data: { userId: owner.id, companyName: `${marker} shop`, country: 'LY', kybStatus: kyb } as any });
  return owner;
}

async function fund(userId: string, amount: string) {
  await prisma.$transaction(async (tx) => {
    await postLedger(tx, {
      refType: 'test_opening', refId: `${marker}_${userId}_USD`,
      legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal(amount).neg() },
        { type: 'USER', userId, currency: 'USD', amount: new Decimal(amount) },
      ],
    });
  });
}

describeDb('business tills', () => {
  beforeAll(async () => {
    const [{ default: businessRouter }, transactions, { errorHandler }] = await Promise.all([
      import('../routes/business').then((m: any) => ({ default: m.businessRouter ?? m.default })),
      import('../routes/transactions'),
      import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/business', businessRouter);
    app.use('/api/transactions', transactions.default);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('creates a till, attributes a payment to it and reports per-till metrics', async () => {
    const owner = await business();
    const customer = await createUser('Layla', 'Mansour');
    await fund(customer.id, '100');

    const created = await request(app).post('/api/business/tills').set('Authorization', auth(owner)).send({ name: 'Front counter' });
    expect(created.status).toBe(201);
    const tillId = created.body.till.id;

    const code = await request(app).get(`/api/business/tills/${tillId}/code`).query({ amount: '12.5', currency: 'usd' }).set('Authorization', auth(owner));
    expect(code.status).toBe(200);
    expect(code.body.url).toContain(`/pay/${owner.id}?`);
    expect(code.body.url).toContain(`till=${tillId}`);
    expect(code.body.url).toContain('amount=12.5');
    expect(code.body.url).toContain('currency=USD');

    const since = new Date(Date.now() - 1000).toISOString();
    const paid = await request(app).post('/api/transactions/transfer').set('Authorization', auth(customer))
      .send({ receiverId: owner.id, currency: 'USD', amount: 12.5, tillId, idempotencyKey: `${marker}_pay1` });
    expect(paid.status).toBeLessThan(300);
    const transfer = await prisma.transfer.findFirst({ where: { senderId: customer.id, receiverId: owner.id } });
    expect(transfer?.tillId).toBe(tillId);

    const feed = await request(app).get(`/api/business/tills/${tillId}/payments`).query({ since }).set('Authorization', auth(owner));
    expect(feed.status).toBe(200);
    expect(feed.body.payments).toHaveLength(1);
    expect(feed.body.payments[0]).toMatchObject({ amount: expect.stringMatching(/^12\.5/), currency: 'USD', payer: 'Layla M.' });

    const list = await request(app).get('/api/business/tills').set('Authorization', auth(owner));
    const till = list.body.tills.find((t: any) => t.id === tillId);
    expect(till.today.USD).toEqual({ count: 1, total: '12.500', average: '12.500' });
    expect(till.month.USD.count).toBe(1);
    expect(till.lastPaymentAt).toBeTruthy();
  });

  it('refuses another business\'s till and a closed till before any money moves', async () => {
    const shopA = await business();
    const shopB = await business();
    const customer = await createUser();
    await fund(customer.id, '50');
    const tillB = (await request(app).post('/api/business/tills').set('Authorization', auth(shopB)).send({ name: 'B1' })).body.till.id;

    const wrong = await request(app).post('/api/transactions/transfer').set('Authorization', auth(customer))
      .send({ receiverId: shopA.id, currency: 'USD', amount: 5, tillId: tillB, idempotencyKey: `${marker}_wrong` });
    expect(wrong.status).toBe(400);

    const closed = await request(app).patch(`/api/business/tills/${tillB}`).set('Authorization', auth(shopB)).send({ active: false });
    expect(closed.body.till.active).toBe(false);
    const toClosed = await request(app).post('/api/transactions/transfer').set('Authorization', auth(customer))
      .send({ receiverId: shopB.id, currency: 'USD', amount: 5, tillId: tillB, idempotencyKey: `${marker}_closed` });
    expect(toClosed.status).toBe(409);

    expect(await prisma.transfer.count({ where: { senderId: customer.id } })).toBe(0);
    const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId: customer.id, currency: 'USD' } } });
    expect(w?.balance.toString()).toBe('50');
  });

  it('needs KYB approval to open a till and a till of your own business to read', async () => {
    const pending = await business('PENDING');
    expect((await request(app).post('/api/business/tills').set('Authorization', auth(pending)).send({ name: 'X' })).status).toBe(403);
    const shop = await business();
    const other = await business();
    const till = (await request(app).post('/api/business/tills').set('Authorization', auth(shop)).send({ name: 'Mine' })).body.till.id;
    expect((await request(app).get(`/api/business/tills/${till}/payments`).set('Authorization', auth(other))).status).toBe(404);
  });
});
