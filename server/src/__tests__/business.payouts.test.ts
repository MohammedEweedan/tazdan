/**
 * Business platform: bulk payouts (reservation, execution, ledger), maker-checker,
 * idempotency, compliance hold, API keys and signed webhooks — against Postgres.
 * RUN_DB_TESTS=1 locally; always in CI.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { bootstrapPlatform } from '../services/platform/bootstrap';
import { resolveBusiness } from '../services/business/access';
import { approveBatch, cancelPayout, complianceDecideBatch, createBatch, previewBulkPay, rejectBatch } from '../services/business/payouts.service';
import { authenticateKey, createKey, revokeKey } from '../services/business/apiKeys.service';
import { createEndpoint, deliverDue, verifySignature } from '../services/business/webhooks.service';
import { importWatchlist } from '../services/compliance/screening.service';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `bz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const emails: string[] = [];
const D = (v: unknown) => new Decimal(String(v ?? 0));

async function user(first: string, last: string, extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: first, lastName: last, country: 'LY', status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2',
      emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(0, 30), ...extra,
    },
  });
}

async function business(kyb: 'APPROVED' | 'PENDING' = 'APPROVED') {
  const owner = await user('Owner', 'Biz', { accountType: 'BUSINESS' });
  const b = await prisma.businessProfile.create({ data: { userId: owner.id, companyName: `${marker} Trading`, country: 'LY', kybStatus: kyb } });
  await prisma.$transaction(async (tx) => {
    await tx.wallet.create({ data: { userId: owner.id, currency: 'USD', balance: '50000' } });
    await postLedger(tx, { refType: 'test_fund', refId: `${owner.id}:USD`, legs: [
      { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: D('50000').neg() },
      { type: 'USER', userId: owner.id, currency: 'USD', amount: D('50000') },
    ] });
  });
  return { owner, business: b };
}

const wallet = (userId: string) => prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });

describeDb('business payouts', () => {
  let r1: { id: string; username: string | null; email: string };
  let r2: { id: string; username: string | null; email: string };

  beforeAll(async () => {
    await bootstrapPlatform({ workers: false });
    await prisma.platformSettings.upsert({ where: { key: 'business_payout_fee_usd' }, create: { key: 'business_payout_fee_usd', value: '1' }, update: { value: '1' } });
    r1 = await user('Amal', 'Recipient');
    r2 = await user('Basim', 'Recipient');
  });

  afterAll(async () => {
    await prisma.platformSettings.deleteMany({ where: { key: 'business_payout_fee_usd' } }).catch(() => {});
    await prisma.watchlistEntry.updateMany({ where: { source: marker }, data: { active: false } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('refuses payouts until KYB is approved', async () => {
    const { owner } = await business('PENDING');
    const ctx = await resolveBusiness(owner.id);
    await expect(createBatch(ctx, { recipients: [{ handle: r1.username!, amount: 10 }], currency: 'USD' })).rejects.toMatchObject({ code: 'COMPLIANCE_HOLD' });
  });

  it('previews, then pays a batch: reservation, balanced journal, idempotent retry', async () => {
    const { owner } = await business();
    const ctx = await resolveBusiness(owner.id);
    const preview = await previewBulkPay(ctx, { currency: 'USD', recipients: [
      { handle: `@${r1.username}`, amount: 100 }, { email: r2.email, amount: 50 },
      { handle: 'nobody-here-xyz', amount: 5 }, { handle: owner.username!, amount: 5 }, { handle: r1.username!, amount: 0 },
    ] });
    expect(preview.recipients).toBe(2);
    expect(preview.invalid.map((i) => i.row)).toEqual([3, 4, 5]);
    expect(preview.totalFee).toBe('2');

    const input = { currency: 'USD', idempotencyKey: `${marker}-k1`, recipients: [{ handle: r1.username!, amount: 100 }, { email: r2.email, amount: 50 }] };
    const r1Before = D((await wallet(r1.id))?.balance);
    const { batch } = await createBatch(ctx, input);
    expect(batch.status).toBe('EXECUTED');
    expect(batch.payouts.every((p) => p.status === 'COMPLETED')).toBe(true);
    const ow = (await wallet(owner.id))!;
    expect(ow.balance.toString()).toBe('49848'); // 150 + 2 fee
    expect(ow.frozen.toString()).toBe('0');
    expect(D((await wallet(r1.id))!.balance).minus(r1Before).toString()).toBe('100');
    for (const p of batch.payouts) {
      const legs = await prisma.ledgerEntry.findMany({ where: { refType: 'business_payout', refId: p.reference }, include: { account: true } });
      expect(legs.reduce((n, e) => n.plus(e.amount), D(0)).toString()).toBe('0');
      expect(legs.find((e) => e.account.type === 'PLATFORM')?.amount.toString()).toBe('1');
    }

    const again = await createBatch(ctx, input);
    expect(again.replayed).toBe(true);
    expect(again.batch.id).toBe(batch.id);
    expect((await wallet(owner.id))!.balance.toString()).toBe('49848');
  });

  it('needs a second approver above the threshold; maker cannot approve; reject releases funds', async () => {
    const { owner, business: b } = await business();
    const admin = await user('Second', 'Approver');
    await prisma.businessTeamMember.create({ data: { businessId: b.id, userId: admin.id, email: admin.email, role: 'ADMIN', status: 'ACTIVE', joinedAt: new Date() } });
    const ownerCtx = await resolveBusiness(owner.id);
    const adminCtx = await resolveBusiness(admin.id);
    expect(adminCtx.role).toBe('ADMIN');

    const { batch } = await createBatch(ownerCtx, { currency: 'USD', recipients: [{ handle: r1.username!, amount: 12000 }] });
    expect(batch.status).toBe('PENDING_APPROVAL');
    expect((await wallet(owner.id))!.frozen.toString()).toBe('12001');
    await expect(approveBatch(ownerCtx, batch.id)).rejects.toMatchObject({ statusCode: 403 });
    // Business approval done; the single 12,000 USD line also trips HIGH_VALUE, so compliance decides next.
    const approved = await approveBatch(adminCtx, batch.id);
    expect(approved.status).toBe('COMPLIANCE_REVIEW');
    expect(approved.approvedById).toBe(admin.id);
    const staff = await user('Comp', 'Reviewer', { role: 'ADMIN' });
    const released = await complianceDecideBatch(batch.id, true, staff.id, 'Supplier invoice on file');
    expect(released.status).toBe('EXECUTED');
    expect((await wallet(owner.id))!.frozen.toString()).toBe('0');

    const second = await createBatch(ownerCtx, { currency: 'USD', recipients: [{ handle: r1.username!, amount: 11000 }, { handle: r2.username!, amount: 500 }] });
    expect(second.batch.status).toBe('PENDING_APPROVAL');
    const cancelled = await cancelPayout(ownerCtx, second.batch.payouts[1].id);
    expect(cancelled.status).toBe('CANCELLED');
    expect((await wallet(owner.id))!.frozen.toString()).toBe('11001');
    const rejected = await rejectBatch(adminCtx, second.batch.id, 'Wrong amounts');
    expect(rejected.status).toBe('REJECTED');
    // Its review case (HIGH_VALUE) has nothing left to decide once the business rejected it.
    expect((await prisma.complianceCase.findUniqueOrThrow({ where: { id: second.batch.complianceCaseId! } })).status).toBe('CLOSED');
    expect((await wallet(owner.id))!.frozen.toString()).toBe('0');
    expect((await wallet(owner.id))!.balance.toString()).toBe(D('50000').minus('12001').toString());
  });

  it('single-signatory businesses must step up for large batches', async () => {
    const { owner } = await business();
    const ctx = await resolveBusiness(owner.id);
    await expect(createBatch(ctx, { currency: 'USD', recipients: [{ handle: r1.username!, amount: 15000 }] })).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
    expect((await wallet(owner.id))!.frozen.toString()).toBe('0');
  });

  it('holds a batch for compliance on a screening hit, then releases it from the cockpit', async () => {
    const watched = await user('Qorvath', `Zemblanski${marker}`);
    await importWatchlist([{ listName: 'INTERNAL', entityType: 'PERSON', name: `Qorvath Zemblanski${marker}` }], marker, watched.id);
    const { owner } = await business();
    const ctx = await resolveBusiness(owner.id);
    const { batch } = await createBatch(ctx, { currency: 'USD', recipients: [{ handle: watched.username!, amount: 40 }] });
    expect(batch.status).toBe('COMPLIANCE_REVIEW');
    expect(batch.complianceCaseId).toBeTruthy();
    expect(batch.payouts[0].riskOutcome).toBe('REVIEW');
    const staff = await user('Comp', 'Officer', { role: 'ADMIN' });
    const released = await complianceDecideBatch(batch.id, true, staff.id, 'False positive — different person, DOB mismatch');
    expect(released.status).toBe('EXECUTED');
    expect((await prisma.complianceCase.findUniqueOrThrow({ where: { id: batch.complianceCaseId! } })).status).toBe('CLOSED');
  });

  it('API keys: scoped, bound to the creator role, revocable; v1 payouts need an Idempotency-Key', async () => {
    const { owner, business: b } = await business();
    const ownerCtx = await resolveBusiness(owner.id);
    const dev = await user('Dev', 'Member');
    await prisma.businessTeamMember.create({ data: { businessId: b.id, userId: dev.id, email: dev.email, role: 'DEVELOPER', status: 'ACTIVE', joinedAt: new Date() } });
    await expect(createKey(await resolveBusiness(dev.id), { name: 'dev key', permissions: ['PAYOUTS'] })).rejects.toMatchObject({ statusCode: 403 });

    const key = await createKey(ownerCtx, { name: 'payroll', permissions: ['PAYOUTS', 'BALANCES'] });
    expect(key.rawKey.startsWith('tzk_test_')).toBe(true);
    expect(await authenticateKey(key.rawKey)).not.toBeNull();

    const bal = await request(app).get('/api/v1/balances').set('Authorization', `Bearer ${key.rawKey}`);
    expect(bal.status).toBe(200);
    expect(bal.body.data.find((w: any) => w.currency === 'USD').available).toBe('50000');
    expect((await request(app).get('/api/v1/rates?base=USD&quote=LYD').set('X-Api-Key', key.rawKey)).status).toBe(403); // no RATES scope

    const body = { recipient: { handle: r2.username }, amount: 25, currency: 'USD' };
    expect((await request(app).post('/api/v1/payouts').set('Authorization', `Bearer ${key.rawKey}`).send(body)).status).toBe(400);
    const paid = await request(app).post('/api/v1/payouts').set('Authorization', `Bearer ${key.rawKey}`).set('Idempotency-Key', `${marker}-api-1`).send(body);
    expect(paid.status).toBe(201);
    expect(paid.body.data.status).toBe('EXECUTED');
    expect(paid.body.data.payouts[0]).not.toHaveProperty('riskOutcome');
    const replay = await request(app).post('/api/v1/payouts').set('Authorization', `Bearer ${key.rawKey}`).set('Idempotency-Key', `${marker}-api-1`).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.data.batchId).toBe(paid.body.data.batchId);

    await revokeKey(ownerCtx, key.id);
    expect((await request(app).get('/api/v1/balances').set('Authorization', `Bearer ${key.rawKey}`)).status).toBe(401);
  });

  it('delivers signed webhooks for payout events', async () => {
    const received: Array<{ headers: http.IncomingHttpHeaders; body: string }> = [];
    const server = http.createServer((req, res) => {
      let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => { received.push({ headers: req.headers, body }); res.writeHead(200).end('ok'); });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    try {
      const { owner, business: b } = await business();
      const endpoint = await createEndpoint(b.id, { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, events: ['payout.completed'] });
      await createBatch(await resolveBusiness(owner.id), { currency: 'USD', recipients: [{ handle: r1.username!, amount: 5 }] });
      const queued = await prisma.businessWebhookDelivery.findMany({ where: { endpointId: endpoint.id } });
      expect(queued).toHaveLength(1);
      await deliverDue();
      const got = received.find((r) => r.headers['tazdan-delivery'] === queued[0].id);
      expect(got).toBeDefined();
      expect(verifySignature(endpoint.secret, got!.body, String(got!.headers['tazdan-signature']))).toBe(true);
      expect(verifySignature('whsec_wrong', got!.body, String(got!.headers['tazdan-signature']))).toBe(false);
      expect((await prisma.businessWebhookDelivery.findUniqueOrThrow({ where: { id: queued[0].id } })).status).toBe('DELIVERED');
    } finally {
      server.close();
    }
  });

  it('business HTTP API: role-gated and shaped for the mobile app', async () => {
    const { owner } = await business();
    const token = `Bearer ${generateTokens(owner as any).accessToken}`;
    const profile = await request(app).get('/api/business/profile').set('Authorization', token);
    expect(profile.status).toBe(200);
    expect(profile.body.profile).toMatchObject({ kybStatus: 'APPROVED', role: 'OWNER' });
    const stats = await request(app).get('/api/business/stats').set('Authorization', token);
    expect(stats.body.stats).toHaveProperty('successRate');
    const stranger = await user('Not', 'Member');
    const denied = await request(app).get('/api/business/profile').set('Authorization', `Bearer ${generateTokens(stranger as any).accessToken}`);
    expect(denied.status).toBe(403);
  });
});
