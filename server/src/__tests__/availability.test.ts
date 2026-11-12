/**
 * Product availability: hide or lock a feature, currency or pair for
 * everyone or chosen customers.
 *
 *   - resolution: deny beats allow, allow and staff beat the default, expired rules stop applying
 *   - money paths refuse locked/hidden features, currencies and pairs (either direction)
 *   - a parent feature closes its children (transfers → chat payments)
 *   - /api/features answers per viewer
 *   - cockpit: availability.manage only, reason required, audited, reset removes the rule
 *
 * Rules on shared items (fx, transfers, LYD…) only ever deny this file's own
 * customers, so suites running in parallel are unaffected. Rules for
 * everyone use a pair nothing else trades (DOT/AVAX).
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a
 * disposable database.
 */
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { invalidateStaffCache } from '../services/platform/rbac';
import { assertMovementAllowed } from '../services/platform/controls.service';
import {
  assertFeatureAvailable, invalidateAvailabilityCache, resolveRule, setAvailabilityRule,
} from '../services/platform/availability.service';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `av${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
const touched: Array<{ kind: 'FEATURE' | 'CURRENCY' | 'PAIR'; key: string }> = [];

async function user(opts: { role?: 'USER' | 'ADMIN'; staffRoles?: any[] } = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: 'Avail', lastName: `Test${emails.length}`, status: 'ACTIVE',
      role: opts.role ?? 'USER', staffRoles: opts.staffRoles ?? [], kycStatus: 'APPROVED', kycTier: 'TIER_2',
      emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(0, 30),
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function rule(input: Parameters<typeof setAvailabilityRule>[0]) {
  const out = await setAvailabilityRule(input);
  touched.push({ kind: input.kind, key: out.key });
  return out;
}

describe('availability resolution', () => {
  const base = {
    state: 'HIDDEN' as const, allow: new Set(['a']), deny: new Set(['d', 'both']), denyState: 'LOCKED' as const,
    includeStaff: true, message: 'Coming soon', expiresAt: null,
  };
  it('deny beats allow, allow and staff beat the default', () => {
    expect(resolveRule(base, { id: 'x', isStaff: false }).state).toBe('HIDDEN');
    expect(resolveRule(base, { id: 'a', isStaff: false }).state).toBe('AVAILABLE');
    expect(resolveRule(base, { id: 's', isStaff: true }).state).toBe('AVAILABLE');
    expect(resolveRule(base, { id: 'd', isStaff: true })).toEqual({ state: 'LOCKED', message: 'Coming soon' });
    expect(resolveRule({ ...base, allow: new Set(['both']) }, { id: 'both', isStaff: false }).state).toBe('LOCKED');
    expect(resolveRule({ ...base, includeStaff: false }, { id: 's', isStaff: true }).state).toBe('HIDDEN');
    expect(resolveRule(base, { id: null, isStaff: false }).state).toBe('HIDDEN');
  });
  it('an expired rule no longer applies', () => {
    expect(resolveRule({ ...base, expiresAt: new Date(Date.now() - 1000) }, { id: 'x', isStaff: false }).state).toBe('AVAILABLE');
    expect(resolveRule({ ...base, expiresAt: new Date(Date.now() + 60_000) }, { id: 'x', isStaff: false }).state).toBe('HIDDEN');
  });
  it('no rule means available', () => {
    expect(resolveRule(undefined, { id: 'x', isStaff: false })).toEqual({ state: 'AVAILABLE', message: null });
  });
});

describeDb('product availability', () => {
  let admin: Awaited<ReturnType<typeof user>>;

  beforeAll(async () => {
    admin = await user({ role: 'ADMIN', staffRoles: ['SUPER_ADMIN'] });
    invalidateStaffCache();
  });

  afterAll(async () => {
    for (const t of touched) {
      await prisma.availabilityRule.deleteMany({ where: { kind: t.kind, key: t.key } }).catch(() => {});
    }
    invalidateAvailabilityCache();
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('refuses a locked feature on its money path for denied customers only', async () => {
    const denied = await user();
    const other = await user();
    await rule({ kind: 'FEATURE', key: 'fx', state: 'AVAILABLE', denyUserIds: [denied.id], denyState: 'LOCKED', message: 'Conversions open next week', reason: 'Pilot cohort test', actorId: admin.id });

    const err = await assertMovementAllowed({ userId: denied.id, feature: 'fx', currency: 'USD', counterCurrency: 'LYD' }).catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FEATURE_DISABLED');
    expect(err.message).toBe('Conversions open next week');
    expect(err.details).toEqual({ availability: 'FEATURE:fx', state: 'LOCKED' });
    await expect(assertMovementAllowed({ userId: other.id, feature: 'fx', currency: 'USD', counterCurrency: 'LYD' })).resolves.toBeUndefined();
    // Crypto trading is its own feature, even though it runs under the fx kill switch.
    await expect(assertMovementAllowed({ userId: denied.id, feature: 'fx', product: 'crypto_trading', currency: 'BTC', counterCurrency: 'USD' })).resolves.toBeUndefined();
  });

  it('a parent feature closes its children', async () => {
    const denied = await user();
    await rule({ kind: 'FEATURE', key: 'transfers', state: 'AVAILABLE', denyUserIds: [denied.id], denyState: 'HIDDEN', reason: 'Parent closes children', actorId: admin.id });
    const err = await assertMovementAllowed({ userId: denied.id, feature: 'transfers', product: 'chat_payments', currency: 'LYD' }).catch((e) => e);
    expect(err.details).toEqual({ availability: 'FEATURE:chat_payments', state: 'HIDDEN' });
    await expect(assertFeatureAvailable(denied.id, 'pay')).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertFeatureAvailable(denied.id, 'budgets')).resolves.toBeUndefined();
  });

  it('refuses a currency on either side of a conversion', async () => {
    const denied = await user();
    await rule({ kind: 'CURRENCY', key: 'egp', state: 'AVAILABLE', denyUserIds: [denied.id], denyState: 'LOCKED', reason: 'Currency pilot test', actorId: admin.id });
    for (const [currency, counterCurrency] of [['EGP', 'USD'], ['USD', 'EGP']]) {
      const err = await assertMovementAllowed({ userId: denied.id, feature: 'fx', currency, counterCurrency }).catch((e) => e);
      expect(err.details).toEqual({ availability: 'CURRENCY:EGP', state: 'LOCKED' });
    }
    await expect(assertMovementAllowed({ userId: denied.id, feature: 'fx', currency: 'USD', counterCurrency: 'LYD' })).resolves.toBeUndefined();
  });

  it('matches a pair in both directions and keeps one rule per pair', async () => {
    const tester = await user();
    const customer = await user();
    const first = await rule({ kind: 'PAIR', key: 'DOT/AVAX', state: 'LOCKED', allowUserIds: [tester.id], reason: 'Pair not ready', actorId: admin.id });
    expect(first.key).toBe('DOT/AVAX');
    // Saving the reverse direction updates the same rule.
    const second = await rule({ kind: 'PAIR', key: 'avax/dot', state: 'HIDDEN', allowUserIds: [tester.id], reason: 'Pair not ready, hide it', actorId: admin.id });
    expect(second.key).toBe('DOT/AVAX');
    expect(await prisma.availabilityRule.count({ where: { kind: 'PAIR', key: { in: ['DOT/AVAX', 'AVAX/DOT'] } } })).toBe(1);

    for (const [currency, counterCurrency] of [['DOT', 'AVAX'], ['AVAX', 'DOT']]) {
      const err = await assertMovementAllowed({ userId: customer.id, feature: 'fx', currency, counterCurrency }).catch((e) => e);
      expect(err.details).toEqual({ availability: 'PAIR:DOT/AVAX', state: 'HIDDEN' });
    }
    await expect(assertMovementAllowed({ userId: tester.id, feature: 'fx', currency: 'AVAX', counterCurrency: 'DOT' })).resolves.toBeUndefined();
    await expect(assertMovementAllowed({ userId: customer.id, feature: 'fx', currency: 'DOT', counterCurrency: 'USD' })).resolves.toBeUndefined();
  });

  it('serves each viewer their own availability at /api/features', async () => {
    const denied = await user();
    const tester = await user();
    await rule({ kind: 'FEATURE', key: 'p2p', state: 'AVAILABLE', denyUserIds: [denied.id], denyState: 'HIDDEN', message: 'Not on your plan', reason: 'Per-viewer flags', actorId: admin.id });
    await rule({ kind: 'PAIR', key: 'DOT/AVAX', state: 'HIDDEN', allowUserIds: [tester.id], reason: 'Per-viewer pairs', actorId: admin.id });

    const mine = await request(app).get('/api/features').set('Authorization', auth(denied));
    expect(mine.status).toBe(200);
    expect(mine.headers['cache-control']).toContain('private');
    expect(mine.body.features.p2p).toBe(false);
    expect(mine.body.availability.features.p2p).toEqual({ state: 'HIDDEN', message: 'Not on your plan' });
    expect(mine.body.availability.pairs['DOT/AVAX']).toEqual({ state: 'HIDDEN', message: null });

    const theirs = await request(app).get('/api/features').set('Authorization', auth(tester));
    expect(theirs.body.availability.features.p2p.state).toBe('AVAILABLE');
    expect(theirs.body.availability.pairs['DOT/AVAX']).toBeUndefined();

    const anonymous = await request(app).get('/api/features');
    expect(anonymous.body.availability.pairs['DOT/AVAX'].state).toBe('HIDDEN');
    expect(anonymous.body.availability.features.p2p.state).toBe('AVAILABLE');

    const preview = await request(app).get(`/api/cockpit/availability/preview/${denied.id}`).set('Authorization', auth(admin));
    expect(preview.status).toBe(200);
    expect(preview.body.availability.features.p2p.state).toBe('HIDDEN');
  });

  it('cockpit: only availability.manage may change rules, with a reason, and every change is audited', async () => {
    const ops = await user({ role: 'ADMIN', staffRoles: ['OPERATIONS'] });
    const denied = await user();
    invalidateStaffCache();
    const body = { kind: 'CURRENCY', key: 'TND', state: 'AVAILABLE', denyUserIds: [denied.id], denyState: 'HIDDEN', reason: 'Cockpit change test' };

    expect((await request(app).get('/api/cockpit/availability').set('Authorization', auth(ops))).status).toBe(200);
    expect((await request(app).put('/api/cockpit/availability').set('Authorization', auth(ops)).send(body)).status).toBe(403);
    expect((await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin)).send({ ...body, reason: 'no' })).status).toBe(400);
    expect((await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin)).send({ ...body, denyUserIds: ['not-a-user'] })).status).toBe(400);
    expect((await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin)).send({ ...body, allowUserIds: [denied.id] })).status).toBe(400);
    expect((await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin)).send({ ...body, expiresAt: new Date(Date.now() - 60_000).toISOString() })).status).toBe(400);

    const ok = await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin)).send(body);
    expect(ok.status).toBe(200);
    touched.push({ kind: 'CURRENCY', key: 'TND' });
    expect(ok.body.rule).toMatchObject({ kind: 'CURRENCY', key: 'TND', denyUserIds: [denied.id], denyState: 'HIDDEN', setById: admin.id });

    const list = await request(app).get('/api/cockpit/availability').set('Authorization', auth(admin));
    const tnd = list.body.currencies.find((c: any) => c.code === 'TND');
    expect(tnd.rule.denyUserIds).toEqual([denied.id]);
    expect(list.body.people.map((p: any) => p.id)).toContain(denied.id);
    expect(list.body.features.map((f: any) => f.key)).toEqual(expect.arrayContaining(['transfers', 'pay', 'p2p', 'budgets']));

    // Clearing the deny list on an open item removes the rule.
    const reset = await request(app).put('/api/cockpit/availability').set('Authorization', auth(admin))
      .send({ kind: 'CURRENCY', key: 'TND', state: 'AVAILABLE', reason: 'Back to normal' });
    expect(reset.status).toBe(200);
    expect(reset.body.rule).toBeNull();
    expect(await prisma.availabilityRule.count({ where: { kind: 'CURRENCY', key: 'TND' } })).toBe(0);

    const audit = await prisma.auditLog.findMany({ where: { entity: 'AvailabilityRule', entityId: 'CURRENCY:TND', userId: admin.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['AVAILABILITY_SET', 'AVAILABILITY_RESET']);
    expect((audit[0].newValues as any)._reason).toBe('Cockpit change test');
    expect((audit[1].oldValues as any).denyUserIds).toEqual([denied.id]);
  });
});
