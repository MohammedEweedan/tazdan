/**
 * Wallet, withdrawal and emergency-control integration tests against the
 * real app and Postgres (RUN_DB_TESTS=1 locally; always in CI).
 */
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { invalidateControlCache } from '../services/platform/controls.service';
import { importWatchlist } from '../services/compliance/screening.service';
import { ensureDefaultRules } from '../services/risk/engine';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `wal${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];

async function createUser(kyc = true) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: 'Wallet', lastName: 'Test', status: 'ACTIVE',
      kycStatus: kyc ? 'APPROVED' : 'NOT_SUBMITTED', kycTier: kyc ? 'TIER_2' : 'TIER_0',
      emailVerified: true, referralCode: `${marker}${emails.length}`.slice(0, 30),
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function fund(userId: string, currency: 'USDT' | 'USD', amount: string) {
  await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, balance: new Decimal(amount) },
      update: { balance: { increment: new Decimal(amount) } },
    });
    await postLedger(tx, {
      refType: 'test_fund', refId: `${userId}:${currency}`,
      legs: [
        { type: 'SYSTEM_ONRAMP', currency, amount: new Decimal(amount).neg() },
        { type: 'USER', userId, currency, amount: new Decimal(amount) },
      ],
    });
  });
}

describeDb('wallets, withdrawals and controls', () => {
  afterAll(async () => {
    await prisma.controlSwitch.deleteMany({ where: { key: 'withdrawals' } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('lists the caller\'s wallets and requires authentication', async () => {
    const u = await createUser();
    await fund(u.id, 'USD', '10');
    const res = await request(app).get('/api/wallets').set('Authorization', auth(u));
    expect(res.status).toBe(200);
    const usd = res.body.wallets.find((w: any) => w.currency === 'USD');
    expect(usd.balance).toBe('10');
    expect((await request(app).get('/api/wallets')).status).toBe(401);
  });

  it('rejects invalid withdrawal amounts and unsupported currencies', async () => {
    const u = await createUser();
    const zero = await request(app).post('/api/withdrawals').set('Authorization', auth(u))
      .send({ currency: 'USDT', amount: 0, network: 'TRC20', walletAddress: 'Tabc' });
    expect(zero.status).toBe(400);
    const unknown = await request(app).post('/api/withdrawals').set('Authorization', auth(u))
      .send({ currency: 'PEPE', amount: 5 });
    expect(unknown.status).toBe(400);
  });

  it('screens the destination address: a watchlisted wallet is flagged for the approver and opens a case', async () => {
    await ensureDefaultRules();
    const u = await createUser();
    await fund(u.id, 'USDT', '50');
    const flagged = `TWatchlisted${marker}`.padEnd(34, 'x').slice(0, 34);
    await importWatchlist([{ listName: 'INTERNAL', entityType: 'WALLET', walletAddress: flagged }], `${marker}-wl`, u.id);
    try {
      const res = await request(app).post('/api/withdrawals').set('Authorization', auth(u))
        .send({ currency: 'USDT', amount: 10, network: 'TRC20', walletAddress: flagged });
      expect(res.status).toBe(201);
      const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id: res.body.withdrawal.id } });
      expect(w.status).toBe('PENDING');
      expect(w.adminNotes).toMatch(/^Risk review/);
      const c = await prisma.complianceCase.findFirst({ where: { subjectType: 'WITHDRAWAL', subjectId: w.reference } });
      expect(c?.type).toBe('SANCTIONS');
    } finally {
      await prisma.watchlistEntry.updateMany({ where: { source: `${marker}-wl` }, data: { active: false } });
    }
  });

  it('reserves funds once, records one history row, and releases them on cancel', async () => {
    const u = await createUser();
    await fund(u.id, 'USDT', '50');
    const created = await request(app).post('/api/withdrawals').set('Authorization', auth(u))
      .send({ currency: 'USDT', amount: 20, network: 'TRC20', walletAddress: 'TXYZabcdefghijklmnopqrstuvwxyz1234' });
    expect(created.status).toBe(201);
    let w = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: u.id, currency: 'USDT' } } });
    expect(w.frozen.toString()).toBe('20');

    const cancel = await request(app).put(`/api/withdrawals/${created.body.withdrawal.id}/cancel`).set('Authorization', auth(u));
    expect(cancel.status).toBe(200);
    w = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: u.id, currency: 'USDT' } } });
    expect(w.frozen.toString()).toBe('0');
    expect(w.balance.toString()).toBe('50');

    const rows = await prisma.transaction.findMany({ where: { reference: created.body.withdrawal.reference } });
    expect(rows).toHaveLength(1);
    expect((rows[0].metadata as any).status).toBe('CANCELLED');
    const transitions = await prisma.stateTransition.findMany({ where: { entityType: 'WITHDRAWAL', entityId: created.body.withdrawal.id } });
    expect(transitions.map((t) => t.toState)).toEqual(['PENDING', 'CANCELLED']);
  });

  it('refuses new withdrawals while the withdrawals kill switch is on', async () => {
    const u = await createUser();
    await fund(u.id, 'USDT', '50');
    await prisma.controlSwitch.upsert({
      where: { scope_key: { scope: 'FEATURE', key: 'withdrawals' } },
      create: { scope: 'FEATURE', key: 'withdrawals', blocked: true, reason: 'integration test', setById: u.id },
      update: { blocked: true },
    });
    invalidateControlCache();
    try {
      const res = await request(app).post('/api/withdrawals').set('Authorization', auth(u))
        .send({ currency: 'USDT', amount: 5, network: 'TRC20', walletAddress: 'TXYZabcdefghijklmnopqrstuvwxyz1234' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('FEATURE_DISABLED');
    } finally {
      await prisma.controlSwitch.update({ where: { scope_key: { scope: 'FEATURE', key: 'withdrawals' } }, data: { blocked: false } });
      invalidateControlCache();
    }
  });
});
