/**
 * Retried money requests (a reply lost to a timeout, a double tap) carrying
 * the same Idempotency-Key move money once: swaps, withdrawal requests, P2P
 * trades and the legacy /transfers/send. A key reused for a different request
 * is refused. Concurrent retries settle once.
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a disposable database.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn().mockResolvedValue({ method: 'email' }),
  verifyStepUp: jest.fn().mockResolvedValue(undefined),
}));
// Fixed swap pricing: no live price feeds in tests.
jest.mock('../services/exchange/conversion.service', () => {
  const actual = jest.requireActual('../services/exchange/conversion.service');
  const { Decimal: Dec } = jest.requireActual('@prisma/client/runtime/library');
  return {
    ...actual,
    quoteConversion: jest.fn(async (from: string, to: string, amount: any) => {
      const credited = new Dec(amount.toString()).mul('0.98').toDecimalPlaces(8, Dec.ROUND_DOWN);
      const leg = { usdPerUnit: new Dec(1), source: 'test', live: true };
      return { from, to, amount, credited, rate: credited.div(amount), fromLeg: leg, toLeg: leg };
    }),
  };
});

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
let app: Express;

async function user() {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: 'Idem', lastName: `Test${emails.length}`, role: 'USER', status: 'ACTIVE',
      kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(-20),
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;
async function fund(userId: string, currency: 'USDT' | 'USD', amount: string) {
  await prisma.$transaction(async (tx) => {
    await postLedger(tx, {
      refType: 'test_opening', refId: `${marker}_${userId}_${currency}`,
      legs: [{ type: 'SYSTEM_ONRAMP', currency, amount: new Decimal(amount).neg() }, { type: 'USER', userId, currency, amount: new Decimal(amount) }],
    });
  });
}
const wallet = async (userId: string, currency: 'USDT' | 'USD') => {
  const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency } } });
  return { balance: w?.balance.toString() ?? '0', frozen: w?.frozen.toString() ?? '0' };
};

describeDb('idempotent money requests', () => {
  beforeAll(async () => {
    const [{ walletRouter }, { withdrawalRouter }, { p2pRouter }, { transferRouter }, { errorHandler }] = await Promise.all([
      import('../routes/wallet'), import('../routes/withdrawal'), import('../routes/p2p'), import('../routes/transfer'), import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/wallets', walletRouter);
    app.use('/api/withdrawals', withdrawalRouter);
    app.use('/api/p2p', p2pRouter);
    app.use('/api/transfers', transferRouter);
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

  it('a retried swap converts once; the same key for another amount is refused', async () => {
    const u = await user();
    await fund(u.id, 'USD', '500');
    const send = () => request(app).post('/api/wallets/swap').set('Authorization', auth(u)).set('Idempotency-Key', 'swap-1').send({ from: 'USD', to: 'USDT', amount: 100 });
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ replayed: true, swap: { from: 'USD', to: 'USDT', amount: 100, credited: 98, reference: a.body.swap?.reference ?? b.body.swap.reference } });
    expect((await wallet(u.id, 'USD')).balance).toBe('400');
    expect((await wallet(u.id, 'USDT')).balance).toBe('98');
    const reused = await request(app).post('/api/wallets/swap').set('Authorization', auth(u)).send({ from: 'USD', to: 'USDT', amount: 50, idempotencyKey: 'swap-1' });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('DUPLICATE_REQUEST');
  });

  it('a retried withdrawal request reserves once, even when the first reply was lost', async () => {
    const u = await user();
    await fund(u.id, 'USDT', '150');
    const body = { currency: 'USDT', amount: 100, network: 'TRC20', walletAddress: 'TXYZabcdefghijklmnopqrstuvwxyz1234', idempotencyKey: 'wd-1' };
    const first = await request(app).post('/api/withdrawals').set('Authorization', auth(u)).send(body);
    expect(first.status).toBe(201);
    // Only 50 is spendable now; without the key this retry would fail or reserve again.
    const retry = await request(app).post('/api/withdrawals').set('Authorization', auth(u)).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ replayed: true, withdrawal: { id: first.body.withdrawal.id } });
    expect(await prisma.withdrawal.count({ where: { userId: u.id } })).toBe(1);
    expect((await wallet(u.id, 'USDT')).frozen).toBe('100');
    const other = await request(app).post('/api/withdrawals').set('Authorization', auth(u)).send({ ...body, amount: 20 });
    expect(other.status).toBe(409);
  });

  it('a retried P2P trade claims the listing and locks escrow once', async () => {
    const seller = await user();
    const buyer = await user();
    await fund(seller.id, 'USDT', '100');
    const listing = await request(app).post('/api/p2p/listings').set('Authorization', auth(seller))
      .send({ currency: 'USDT', fiatCurrency: 'USD', side: 'SELL', price: 1, amount: 60, minLimit: 1, maxLimit: 60, paymentMethods: ['BANK_TRANSFER'] });
    expect(listing.status).toBe(201);
    const take = () => request(app).post('/api/p2p/trades').set('Authorization', auth(buyer)).set('Idempotency-Key', 'trade-1').send({ listingId: listing.body.listing.id, amount: 40 });
    const [a, b] = await Promise.all([take(), take()]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const ids = new Set([a.body.trade.id, b.body.trade.id]);
    expect(ids.size).toBe(1);
    expect(await prisma.p2PTrade.count({ where: { listingId: listing.body.listing.id } })).toBe(1);
    expect((await prisma.p2PListing.findUniqueOrThrow({ where: { id: listing.body.listing.id } })).filled.toString()).toBe('40');
    // Another buyer's key with the same text is a different request.
    const other = await user();
    const theirs = await request(app).post('/api/p2p/trades').set('Authorization', auth(other)).set('Idempotency-Key', 'trade-1').send({ listingId: listing.body.listing.id, amount: 10 });
    expect(theirs.status).toBe(201);
  });

  it('a retried legacy transfer sends once', async () => {
    const from = await user();
    const to = await user();
    await fund(from.id, 'USD', '200');
    const body = { recipientEmail: to.email, currency: 'USD', amount: 25, idempotencyKey: 'trf-1' };
    const first = await request(app).post('/api/transfers/send').set('Authorization', auth(from)).send(body);
    expect(first.status).toBe(201);
    const retry = await request(app).post('/api/transfers/send').set('Authorization', auth(from)).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ replayed: true, transfer: { reference: first.body.transfer.reference } });
    expect(await prisma.transfer.count({ where: { senderId: from.id } })).toBe(1);
    expect((await wallet(to.id, 'USD')).balance).toBe('25');
  });
});
