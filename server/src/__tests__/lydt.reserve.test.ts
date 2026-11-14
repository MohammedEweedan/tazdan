/**
 * LYDT (services/lydt): the dinar token's guarantees.
 *
 *   - supply = Σ holder balances = dinars in TOKEN_RESERVE, after every mix
 *   - issuance never exceeds the reserve the CBL last attested — not even
 *     under concurrent requests — and stops when the statement is stale
 *   - redemption returns dinars and is never paused by the kill switch
 *   - frozen holders can't send, receive or redeem; holding cap enforced
 *   - retried requests with one idempotency key move money once
 *   - the reserve report is public
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

const marker = `lydt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;
let Lydt: typeof import('../services/lydt/lydt.service');

async function createUser(extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'test-hash', firstName: 'Lydt', lastName: `Holder${emails.length}`, role: 'USER', status: 'ACTIVE',
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

async function invariant() {
  const [supply, reserve, holders] = await Promise.all([
    Lydt.supply(), Lydt.reserveLedger(),
    prisma.$queryRaw<Array<{ s: unknown }>>`SELECT COALESCE(SUM("balance"),0) AS s FROM "AssetLedgerAccount" WHERE "type"='USER' AND "asset"='LYDT'`,
  ]);
  expect(supply.toFixed(3)).toBe(reserve.toFixed(3));
  expect(supply.toFixed(3)).toBe(new Decimal(String(holders[0].s)).toFixed(3));
  return supply;
}

let staffId: string;
let base: Decimal;
/** Attest `extra` dinars above the supply outstanding when the suite began. */
const attest = (extra: string, ageHours = 1) => Lydt.recordAttestation(staffId, {
  balance: base.plus(extra).toFixed(3), statementDate: new Date(Date.now() - ageHours * 3_600_000), reference: `${marker}-${extra}-${ageHours}`,
});
const rel = (v: Decimal) => v.minus(base).toFixed(3);

describeDb('LYDT dinar token', () => {
  beforeAll(async () => {
    process.env.LYDT_HOLDING_CAP = '10000';
    Lydt = await import('../services/lydt/lydt.service');
    const [{ lydtRouter }, { errorHandler }] = await Promise.all([import('../routes/lydt'), import('../middleware/errorHandler')]);
    app = express();
    app.use(express.json());
    app.use('/api/lydt', lydtRouter);
    app.use(errorHandler);
    staffId = (await createUser({ role: 'ADMIN' })).id;
    // The ledgers are append-only, so a rerun on the same database starts from
    // whatever supply is already outstanding: every figure is relative to it.
    base = await Lydt.supply();
  });

  afterAll(async () => {
    await prisma.controlSwitch.deleteMany({ where: { scope: 'FEATURE', key: 'lydt' } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('refuses to issue before the CBL has attested a reserve', async () => {
    if (await Lydt.latestAttestation()) return; // a rerun: the first statement already exists
    const u = await createUser();
    await fundLyd(u.id, '500');
    const res = await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: 100 });
    expect(res.status).toBe(503);
    expect(await lyd(u.id)).toBe('500.000');
  });

  it('issues one LYDT per dinar, inside the attested reserve, and reports it publicly', async () => {
    await attest('1000.000');
    const u = await createUser();
    await fundLyd(u.id, '800');
    const res = await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: '300.250' });
    expect(res.status).toBe(200);
    expect(res.body.operation).toMatchObject({ kind: 'ISSUE', amount: '300.250' });
    expect(await lyd(u.id)).toBe('499.750');
    expect((await Lydt.balanceOf(u.id)).toFixed(3)).toBe('300.250');
    expect(rel(await invariant())).toBe('300.250');

    const pub = await request(app).get('/api/lydt/reserves');
    expect(pub.status).toBe(200);
    expect(pub.body.reserves).toMatchObject({ fullyBacked: true, headroom: '699.750', issuanceOpen: true });
    expect(pub.body.reserves.supply).toBe(pub.body.reserves.reserveLedger);
  });

  it('never issues past the attested reserve, even under concurrent requests', async () => {
    const headroom = base.plus(1000).minus(await Lydt.supply()); // 699.750
    const users = await Promise.all([0, 1, 2, 3, 4, 5].map(() => createUser()));
    for (const u of users) await fundLyd(u.id, '200');
    const results = await Promise.all(users.map((u) => request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: 150 })));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(Math.floor(headroom.div(150).toNumber())); // 4 fit, the rest are refused
    expect(results.filter((r) => r.status === 409).length).toBe(users.length - ok);
    const after = await invariant();
    expect(after.lte(base.plus(1000))).toBe(true);
  });

  it('stops issuing when the reserve statement is stale', async () => {
    await attest('5000.000', 72);
    const u = await createUser();
    await fundLyd(u.id, '100');
    const res = await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: 10 });
    expect(res.status).toBe(503);
    await attest('5000.000');
  });

  it('moves money once for a retried request with the same key', async () => {
    const u = await createUser();
    await fundLyd(u.id, '100');
    const body = { amount: 40, idempotencyKey: `${marker}_once` };
    const [a, b] = await Promise.all([
      request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send(body),
      request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send(body),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.operation.reference).toBe(b.body.operation.reference);
    expect((await Lydt.balanceOf(u.id)).toFixed(3)).toBe('40.000');
    expect(await lyd(u.id)).toBe('60.000');
    const reused = await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ ...body, amount: 41 });
    expect(reused.status).toBe(409);
  });

  it('sends LYDT between customers and enforces the holding cap', async () => {
    const a = await createUser();
    const b = await createUser();
    await fundLyd(a.id, '1000');
    await request(app).post('/api/lydt/issue').set('Authorization', auth(a)).send({ amount: 900 }).expect(200);
    const sent = await request(app).post('/api/lydt/transfer').set('Authorization', auth(a)).send({ receiverId: b.id, amount: '250.5', note: 'Rent' });
    expect(sent.status).toBe(200);
    expect((await Lydt.balanceOf(a.id)).toFixed(3)).toBe('649.500');
    expect((await Lydt.balanceOf(b.id)).toFixed(3)).toBe('250.500');

    process.env.LYDT_HOLDING_CAP = '300';
    try {
      const over = await request(app).post('/api/lydt/transfer').set('Authorization', auth(a)).send({ receiverId: b.id, amount: 100 });
      expect(over.status).toBe(400);
      expect((await Lydt.balanceOf(b.id)).toFixed(3)).toBe('250.500');
    } finally { process.env.LYDT_HOLDING_CAP = '10000'; }
    await invariant();
  });

  it('redeems to dinars even while the LYDT switch is paused', async () => {
    const u = await createUser();
    await fundLyd(u.id, '100');
    await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: 100 }).expect(200);
    const { invalidateControlCache } = await import('../services/platform/controls.service');
    await prisma.controlSwitch.upsert({
      where: { scope_key: { scope: 'FEATURE', key: 'lydt' } },
      create: { scope: 'FEATURE', key: 'lydt', blocked: true, reason: 'test pause', setById: staffId },
      update: { blocked: true, reason: 'test pause' },
    });
    invalidateControlCache();
    try {
      const blocked = await request(app).post('/api/lydt/issue').set('Authorization', auth(u)).send({ amount: 1 });
      expect(blocked.status).toBe(503);
      const out = await request(app).post('/api/lydt/redeem').set('Authorization', auth(u)).send({ amount: '60.125' });
      expect(out.status).toBe(200);
      expect(await lyd(u.id)).toBe('60.125');
      expect((await Lydt.balanceOf(u.id)).toFixed(3)).toBe('39.875');
    } finally {
      await prisma.controlSwitch.update({ where: { scope_key: { scope: 'FEATURE', key: 'lydt' } }, data: { blocked: false } });
      invalidateControlCache();
    }
    await invariant();
  });

  it('a frozen holder cannot send, receive or redeem', async () => {
    const a = await createUser();
    const b = await createUser();
    await fundLyd(a.id, '100');
    await request(app).post('/api/lydt/issue').set('Authorization', auth(a)).send({ amount: 50 }).expect(200);
    await Lydt.freeze(staffId, a.id, 'test');
    expect((await request(app).post('/api/lydt/transfer').set('Authorization', auth(a)).send({ receiverId: b.id, amount: 1 })).status).toBe(403);
    expect((await request(app).post('/api/lydt/redeem').set('Authorization', auth(a)).send({ amount: 1 })).status).toBe(403);
    expect((await request(app).post('/api/lydt/transfer').set('Authorization', auth(b)).send({ receiverId: a.id, amount: 1 })).status).toBeGreaterThanOrEqual(400);
    await Lydt.unfreeze(staffId, a.id, 'cleared');
    expect((await request(app).post('/api/lydt/redeem').set('Authorization', auth(a)).send({ amount: 50 })).status).toBe(200);
    await invariant();
    const audit = await prisma.auditLog.count({ where: { userId: staffId, action: { in: ['LYDT_HOLDER_FROZEN', 'LYDT_HOLDER_UNFROZEN'] } } });
    expect(audit).toBe(2);
  });
});
