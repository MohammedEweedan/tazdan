/**
 * LYDT in the wallet: history, trading and the 1:1 dinar peg.
 *
 *   - issues, redeems and transfers show in /transactions next to every other
 *     movement (a conversion as two rows, a transfer as one per side), with
 *     paging and the currency filter working across both sources
 *   - /wallets/swap trades LYD ↔ LYDT at 1:1 (issue / redeem on the token
 *     ledger), and quotes the same
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
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `lydtw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;
let Lydt: typeof import('../services/lydt/lydt.service');

async function createUser(extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'test-hash', firstName: 'Wallet', lastName: `Holder${emails.length}`, role: 'USER', status: 'ACTIVE',
      kycStatus: 'APPROVED', kycTier: 'TIER_3', emailVerified: true, referralCode: `${marker.slice(-10)}_${emails.length}`, ...extra,
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function fundLyd(userId: string, amount: string) {
  await prisma.$transaction((tx) => postLedger(tx, {
    refType: 'test_opening', refId: `${marker}_${userId}_${amount}`,
    legs: [
      { type: 'SYSTEM_ONRAMP', currency: 'LYD', amount: new Decimal(amount).neg() },
      { type: 'USER', userId, currency: 'LYD', amount: new Decimal(amount) },
    ],
  }));
}
async function lyd(userId: string) {
  const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'LYD' } } });
  return new Decimal(w?.balance.toString() ?? '0').toFixed(3);
}

describeDb('LYDT in the wallet', () => {
  beforeAll(async () => {
    process.env.LYDT_HOLDING_CAP = '10000';
    Lydt = await import('../services/lydt/lydt.service');
    const [{ lydtRouter }, { walletRouter }, tx, { errorHandler }] = await Promise.all([
      import('../routes/lydt'), import('../routes/wallet'), import('../routes/transactions'), import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/lydt', lydtRouter);
    app.use('/api/wallets', walletRouter);
    app.use('/api/transactions', tx.default);
    app.use(errorHandler);
    const staff = await createUser({ role: 'ADMIN' });
    // Room above whatever supply earlier runs left outstanding.
    const base = await Lydt.supply();
    await Lydt.recordAttestation(staff.id, { balance: base.plus('100000').toFixed(3), statementDate: new Date(Date.now() - 3_600_000), reference: `${marker}-reserve` });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('trades LYD ↔ LYDT at 1:1 through the exchange', async () => {
    const u = await createUser();
    await fundLyd(u.id, '500');

    const quote = await request(app).get('/api/wallets/swap/quote').set('Authorization', auth(u)).query({ from: 'LYD', to: 'LYDT', amount: 120.5 });
    expect(quote.status).toBe(200);
    expect(quote.body.quote).toMatchObject({ credited: '120.5', rate: '1' });

    const buy = await request(app).post('/api/wallets/swap').set('Authorization', auth(u)).send({ from: 'LYD', to: 'LYDT', amount: 120.5, minCredited: '120.5' });
    expect(buy.status).toBe(201);
    expect(buy.body.swap).toMatchObject({ from: 'LYD', to: 'LYDT', credited: 120.5, rate: 1 });
    expect(await lyd(u.id)).toBe('379.500');
    expect((await Lydt.balanceOf(u.id)).toFixed(3)).toBe('120.500');

    const sell = await request(app).post('/api/wallets/swap').set('Authorization', auth(u)).send({ from: 'LYDT', to: 'LYD', amount: 20.5 });
    expect(sell.status).toBe(201);
    expect(await lyd(u.id)).toBe('400.000');
    expect((await Lydt.balanceOf(u.id)).toFixed(3)).toBe('100.000');

    // Can't sell more than is held.
    expect((await request(app).post('/api/wallets/swap').set('Authorization', auth(u)).send({ from: 'LYDT', to: 'LYD', amount: 1000 })).status).toBe(400);
  });

  it('shows issues, redeems and transfers in the transaction history', async () => {
    const a = await createUser();
    const b = await createUser();
    await fundLyd(a.id, '300');
    await Lydt.issue(a.id, '200', null);
    await Lydt.redeem(a.id, '50', null);
    await Lydt.transfer({ senderId: a.id, receiverId: b.id, amount: '30', note: null, key: null, req: { headers: {} } });

    const hist = await request(app).get('/api/transactions').set('Authorization', auth(a)).query({ limit: 50 });
    expect(hist.status).toBe(200);
    const rows = hist.body.items.filter((r: any) => r.metadata?.kind?.startsWith('lydt'));
    const sig = rows.map((r: any) => `${r.type} ${r.amount} ${r.currency}`);
    expect(sig).toEqual(expect.arrayContaining([
      'BUY 200.000 LYDT', 'SELL -200.000 LYD',
      'BUY 50.000 LYD', 'SELL -50.000 LYDT',
      'TRANSFER_OUT -30.000 LYDT',
    ]));
    expect(rows.find((r: any) => r.type === 'TRANSFER_OUT').description).toBe(`Sent to Wallet ${b.lastName}`);
    // Newest first across both sources.
    const times = hist.body.items.map((r: any) => new Date(r.createdAt).getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);

    // Receiver sees the incoming side only.
    const theirs = await request(app).get('/api/transactions').set('Authorization', auth(b)).query({ currency: 'LYDT' });
    expect(theirs.body.items.map((r: any) => `${r.type} ${r.amount}`)).toEqual(['TRANSFER_IN 30.000']);
    expect(theirs.body.total).toBe(1);

    // Filters and totals cover the merged rows; paging doesn't repeat rows.
    const onlyLydt = await request(app).get('/api/transactions').set('Authorization', auth(a)).query({ currency: 'LYDT' });
    expect(onlyLydt.body.total).toBe(3);
    const p1 = await request(app).get('/api/transactions').set('Authorization', auth(a)).query({ limit: 2, page: 1 });
    const p2 = await request(app).get('/api/transactions').set('Authorization', auth(a)).query({ limit: 2, page: 2 });
    const ids = [...p1.body.items, ...p2.body.items].map((r: any) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p1.body.total).toBe(hist.body.total);
  });
});
