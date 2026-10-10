/**
 * Control Cockpit API: RBAC, maker-checker, controls, customer actions,
 * search and overview, against the real app and Postgres.
 * RUN_DB_TESTS=1 locally; always in CI.
 */
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { invalidateControlCache } from '../services/platform/controls.service';
import { invalidateStaffCache } from '../services/platform/rbac';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `ck${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];

async function user(opts: { role?: 'USER' | 'ADMIN'; staffRoles?: any[] } = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: 'Cock', lastName: `Pit${emails.length}`, status: 'ACTIVE',
      role: opts.role ?? 'USER', staffRoles: opts.staffRoles ?? [], kycStatus: 'APPROVED', kycTier: 'TIER_2',
      emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker}r${emails.length}`.slice(0, 30),
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

describeDb('control cockpit', () => {
  afterAll(async () => {
    await prisma.controlSwitch.deleteMany({ where: { key: { contains: marker } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('refuses customers and enforces per-permission access for staff roles', async () => {
    const customer = await user();
    const support = await user({ role: 'ADMIN', staffRoles: ['SUPPORT'] });
    invalidateStaffCache();

    expect((await request(app).get('/api/cockpit/overview').set('Authorization', auth(customer))).status).toBe(403);
    const me = await request(app).get('/api/cockpit/me').set('Authorization', auth(support));
    expect(me.status).toBe(200);
    expect(me.body.roles).toEqual(['SUPPORT']);
    expect(me.body.permissions).toContain('customers.read');
    expect(me.body.permissions).not.toContain('treasury.operate');

    // Support may read customers but not change kill switches or staff roles.
    expect((await request(app).get('/api/cockpit/customers').set('Authorization', auth(support))).status).toBe(200);
    const ctl = await request(app).post('/api/cockpit/controls').set('Authorization', auth(support))
      .send({ scope: 'FEATURE', key: 'withdrawals', blocked: true, reason: 'should be refused' });
    expect(ctl.status).toBe(403);
    expect((await request(app).get('/api/cockpit/staff').set('Authorization', auth(support))).status).toBe(403);
    // …and the legacy admin API applies the same least privilege.
    expect((await request(app).post('/api/admin/manual-credit').set('Authorization', auth(support)).send({})).status).toBe(403);
  });

  it('records the actor, reason and previous state for every kill-switch change', async () => {
    const ops = await user({ role: 'ADMIN', staffRoles: ['OPERATIONS'] });
    invalidateStaffCache();
    const key = `${marker}-corridor`;
    const res = await request(app).post('/api/cockpit/controls').set('Authorization', auth(ops))
      .send({ scope: 'CORRIDOR', key, blocked: true, reason: 'Partner outage drill' });
    expect(res.status).toBe(200);
    const events = await prisma.controlSwitchEvent.findMany({ where: { key } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: ops.id, newBlocked: true, previousBlocked: null, reason: 'Partner outage drill' });
    const audit = await prisma.auditLog.findFirst({ where: { action: 'CONTROL_BLOCK', userId: ops.id } });
    expect(audit).toBeTruthy();
    invalidateControlCache();
  });

  it('runs maker-checker: the requester cannot approve, a second approver executes exactly once', async () => {
    const maker = await user({ role: 'ADMIN', staffRoles: ['FINANCE'] });
    const checker = await user({ role: 'ADMIN', staffRoles: ['FINANCE'] });
    const customer = await user();
    invalidateStaffCache();

    const req1 = await request(app).post('/api/cockpit/approvals').set('Authorization', auth(maker)).send({
      type: 'LEDGER_ADJUSTMENT',
      payload: { userId: customer.id, currency: 'USD', amount: '250', direction: 'CREDIT' },
      reason: 'Goodwill credit for delayed payout (ticket 123)',
      subjectType: 'USER', subjectId: customer.id,
    });
    expect(req1.status).toBe(201);
    const id = req1.body.approval.id;

    const self = await request(app).post(`/api/cockpit/approvals/${id}/decide`).set('Authorization', auth(maker)).send({ approve: true });
    expect(self.status).toBe(403);

    const results = await Promise.all([1, 2, 3].map(() =>
      request(app).post(`/api/cockpit/approvals/${id}/decide`).set('Authorization', auth(checker)).send({ approve: true, note: 'checked' }),
    ));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);

    const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: customer.id, currency: 'USD' } } });
    expect(wallet?.balance.toString()).toBe('250');
    const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id } });
    expect(approval.status).toBe('EXECUTED');
    expect(approval.decidedById).toBe(checker.id);
  });

  it('freezes a customer without touching wallet reservations and blocks their money movement', async () => {
    const compliance = await user({ role: 'ADMIN', staffRoles: ['COMPLIANCE'] });
    const customer = await user();
    invalidateStaffCache();
    await prisma.wallet.create({ data: { userId: customer.id, currency: 'USDT', balance: 100, frozen: 30 } });

    const res = await request(app).post(`/api/cockpit/customers/${customer.id}/freeze`).set('Authorization', auth(compliance)).send({ reason: 'Sanctions screening hit under review' });
    expect(res.status).toBe(200);
    invalidateControlCache();
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: customer.id, currency: 'USDT' } } });
    expect(w.frozen.toString()).toBe('30');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe('SUSPENDED');

    const detail = await request(app).get(`/api/cockpit/customers/${customer.id}`).set('Authorization', auth(compliance));
    expect(detail.status).toBe(200);
    expect(detail.body.controls.some((c: any) => c.key === customer.id && c.blocked)).toBe(true);
  });

  it('masks contact details for roles without customers.pii', async () => {
    const fraud = await user({ role: 'ADMIN', staffRoles: ['FRAUD_ANALYST'] });
    const customer = await user();
    invalidateStaffCache();
    const detail = await request(app).get(`/api/cockpit/customers/${customer.id}`).set('Authorization', auth(fraud));
    expect(detail.status).toBe(200);
    expect(detail.body.piiVisible).toBe(false);
    expect(detail.body.identity.email).toContain('***');
  });

  it('finds a customer by handle and returns a live overview', async () => {
    const exec = await user({ role: 'ADMIN', staffRoles: ['EXECUTIVE'] });
    const customer = await user();
    invalidateStaffCache();
    const search = await request(app).get('/api/cockpit/search').query({ q: customer.username }).set('Authorization', auth(exec));
    expect(search.status).toBe(200);
    expect(search.body.results.some((r: any) => r.id === customer.id)).toBe(true);

    const overview = await request(app).get('/api/cockpit/overview?period=7d').set('Authorization', auth(exec));
    expect(overview.status).toBe(200);
    expect(overview.body.customers.total).toBeGreaterThan(0);
    expect(overview.body.funds.byClass).toHaveProperty('CUSTOMER');
  });
});
