/**
 * Business storefront: brand colours, kiosk manager PIN, public posts and
 * plaque orders.
 *
 *   - brand colours are #RRGGBB, stored upper-case, and reach the pay code
 *   - the kiosk PIN refuses weak PINs; five wrong tries lock it for 15 minutes
 *   - posts are public only for KYB-approved business accounts, while live
 *     and not taken down by staff
 *   - plaque orders: created by the business, cancelled before production,
 *     moved through production by staff
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a
 * disposable database.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { generateTokens } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { moderatePost, setPlaqueStatus } from '../services/business/storefront.service';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn() }));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `sf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function user(extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'x', firstName: 'Store', lastName: 'Front', role: 'USER', status: 'ACTIVE', kycStatus: 'APPROVED',
      kycTier: 'TIER_2', emailVerified: true, username: `${marker}${emails.length}`.slice(0, 30), referralCode: `${marker.slice(-10)}_${emails.length}`, ...extra,
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function shop(kyb: 'APPROVED' | 'PENDING' = 'APPROVED') {
  const owner = await user({ accountType: 'BUSINESS' });
  const business = await prisma.businessProfile.create({ data: { userId: owner.id, companyName: `${marker} shop`, tradingName: 'Corner Café', country: 'LY', kybStatus: kyb } as any });
  return { owner, business };
}

describeDb('business storefront', () => {
  beforeAll(async () => {
    const [biz, pay, { errorHandler }] = await Promise.all([import('../routes/business'), import('../routes/pay'), import('../middleware/errorHandler')]);
    app = express();
    app.use(express.json());
    app.use('/api/business', (biz as any).businessRouter);
    app.use('/api/pay', (pay as any).payRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('stores brand colours and hands them to the pay code', async () => {
    const { owner } = await shop();
    expect((await request(app).patch('/api/business/profile').set('Authorization', auth(owner)).send({ brandPrimary: 'red' })).status).toBe(400);
    const ok = await request(app).patch('/api/business/profile').set('Authorization', auth(owner)).send({ brandPrimary: '#0f7b4a', brandSecondary: '#ffcc00' });
    expect(ok.status).toBe(200);
    expect(ok.body.profile).toMatchObject({ brandPrimary: '#0F7B4A', brandSecondary: '#FFCC00' });
    const code = await request(app).get('/api/business/pay-code').set('Authorization', auth(owner));
    expect(code.body.payCode.brand).toMatchObject({ primary: '#0F7B4A', secondary: '#FFCC00' });
  });

  it('kiosk PIN: weak PINs refused, five wrong tries lock it', async () => {
    const { owner } = await shop();
    const put = (pin: string) => request(app).put('/api/business/kiosk-pin').set('Authorization', auth(owner)).send({ pin });
    const verify = (pin: string) => request(app).post('/api/business/kiosk-pin/verify').set('Authorization', auth(owner)).send({ pin });

    expect((await verify('482913')).status).toBe(409); // none set yet
    expect((await put('111111')).status).toBe(400);
    expect((await put('123456')).status).toBe(400);
    expect((await put('482913')).status).toBe(200);
    expect((await verify('482913')).body).toEqual({ ok: true });

    for (let i = 1; i <= 4; i += 1) {
      const r = await verify('000001');
      expect(r.status).toBe(403);
      expect(r.body.error ?? r.body.message).toMatch(new RegExp(`${5 - i} tries left`));
    }
    expect((await verify('000001')).status).toBe(423);
    // Locked even for the right PIN until the window passes.
    expect((await verify('482913')).status).toBe(423);
    const status = await request(app).get('/api/business/kiosk-pin').set('Authorization', auth(owner));
    expect(status.body.set).toBe(true);
    expect(status.body.lockedUntil).toBeTruthy();
  });

  it('posts are public only while live, approved and not taken down', async () => {
    const { owner } = await shop();
    const pending = await shop('PENDING');
    expect((await request(app).post('/api/business/posts').set('Authorization', auth(pending.owner)).send({ kind: 'OFFER', title: 'Two for one', body: 'All week' })).status).toBe(403);

    const create = (body: Record<string, unknown>) => request(app).post('/api/business/posts').set('Authorization', auth(owner)).send(body);
    const live = await create({ kind: 'OFFER', title: '2 coffees for 5 LYD', body: 'Every morning until 11.' });
    expect(live.status).toBe(201);
    await create({ kind: 'NEWS', title: 'Opening soon', body: 'Second branch', startsAt: new Date(Date.now() + 86_400_000).toISOString() });
    await create({ kind: 'DEAL', title: 'Old deal', body: 'Gone', startsAt: new Date(Date.now() - 172_800_000).toISOString(), endsAt: new Date(Date.now() - 86_400_000).toISOString() });
    const draft = await create({ kind: 'NEWS', title: 'Draft post', body: 'Not yet', published: false });
    expect(draft.status).toBe(201);
    expect((await create({ kind: 'DEAL', title: 'Bad dates', body: 'x', startsAt: '2027-01-02', endsAt: '2027-01-01' })).status).toBe(400);

    const viewer = await user();
    const publicList = await request(app).get(`/api/pay/payee/${owner.username}/posts`).set('Authorization', auth(viewer));
    expect(publicList.status).toBe(200);
    expect(publicList.body.posts.map((p: any) => p.title)).toEqual(['2 coffees for 5 LYD']);

    await moderatePost(viewer.id, live.body.post.id, true, 'Misleading price claim');
    expect((await request(app).get(`/api/pay/payee/${owner.id}/posts`).set('Authorization', auth(viewer))).body.posts).toHaveLength(0);

    // A person (not a business account) has no public posts.
    expect((await request(app).get(`/api/pay/payee/${viewer.username}/posts`).set('Authorization', auth(viewer))).body.posts).toEqual([]);
  });

  it('plaque orders: business orders, cancels before production, staff ship', async () => {
    const { owner } = await shop();
    const order = (extra: Record<string, unknown> = {}) => request(app).post('/api/business/plaques').set('Authorization', auth(owner)).send({
      quantity: 2, size: 'A6', locale: 'ar', shippingName: 'Corner Café', shippingPhone: '+218910000099',
      shippingAddress: 'Omar Mukhtar St 12', shippingCity: 'Tripoli', ...extra,
    });
    expect((await order({ locale: 'xx' })).status).toBe(400);
    const a = await order();
    expect(a.status).toBe(201);
    expect(a.body.order).toMatchObject({ status: 'REQUESTED', quantity: 2, locale: 'ar' });
    expect((await request(app).post(`/api/business/plaques/${a.body.order.id}/cancel`).set('Authorization', auth(owner))).status).toBe(200);

    const b = await order({ quantity: 1, size: 'STAND', locale: 'en' });
    await setPlaqueStatus(owner.id, b.body.order.id, 'IN_PRODUCTION', 'Sent to the printer');
    expect((await request(app).post(`/api/business/plaques/${b.body.order.id}/cancel`).set('Authorization', auth(owner))).status).toBe(409);
    const list = await request(app).get('/api/business/plaques').set('Authorization', auth(owner));
    expect(list.body.orders.map((o: any) => o.status).sort()).toEqual(['CANCELLED', 'IN_PRODUCTION']);
  });
});
