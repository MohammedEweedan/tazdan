/**
 * Pay tab lookups: what a payer learns from a scanned code or typed @handle.
 *
 *   - signed-in only
 *   - handle (any case, optional @) or user id
 *   - private profiles: first name + last initial, no photo
 *   - merchant name/logo only after KYB approval
 *   - unknown and unavailable accounts look the same (404)
 *   - recent payees: distinct, newest first, active accounts only
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a
 * disposable database.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { generateTokens } from '../middleware/auth';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn(),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser(extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      firstName: 'Layla',
      lastName: 'Mansour',
      role: 'USER',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycTier: 'TIER_2',
      emailVerified: true,
      referralCode: `${marker.slice(-10)}_${emails.length}`,
      ...extra,
    },
  });
}

const handle = (n: string) => `${n}${marker.slice(-8)}`.toLowerCase();

function auth(user: { id: string; email: string; role: string }) {
  return `Bearer ${generateTokens(user).accessToken}`;
}

let transfers = 0;
async function paid(senderId: string, receiverId: string, at: Date) {
  transfers += 1;
  await prisma.transfer.create({
    data: { senderId, receiverId, currency: 'LYD', amount: 1, reference: `${marker}_${transfers}`, createdAt: at },
  });
}

describeDb('pay payee lookup', () => {
  beforeAll(async () => {
    const [{ payRouter }, { errorHandler }] = await Promise.all([
      import('../routes/pay'),
      import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/pay', payRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('requires a signed-in customer', async () => {
    const res = await request(app).get('/api/pay/payee/anyone');
    expect(res.status).toBe(401);
  });

  it('shows a public profile in full, by handle in any case', async () => {
    const me = await createUser();
    const them = await createUser({ username: handle('pub'), profilePublic: true, avatarUrl: 'https://cdn.example.com/a.png' });
    const res = await request(app).get(`/api/pay/payee/@${handle('pub').toUpperCase()}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee).toEqual({
      id: them.id, username: handle('pub'), kind: 'PERSON', name: 'Layla Mansour',
      avatarUrl: 'https://cdn.example.com/a.png', verified: true, self: false,
    });
  });

  it('shows a private profile as first name and last initial, without a photo', async () => {
    const me = await createUser();
    await createUser({ username: handle('priv'), profilePublic: false, avatarUrl: 'https://cdn.example.com/b.png' });
    const res = await request(app).get(`/api/pay/payee/${handle('priv')}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee.name).toBe('Layla M.');
    expect(res.body.payee.avatarUrl).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('Mansour');
  });

  it('resolves a user id from a receive code without a handle', async () => {
    const me = await createUser();
    const them = await createUser();
    const res = await request(app).get(`/api/pay/payee/${them.id}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee.id).toBe(them.id);
    expect(res.body.payee.username).toBeNull();
  });

  it('brands a KYB-approved merchant with its trading name and logo', async () => {
    const me = await createUser();
    const shop = await createUser({ username: handle('cafe'), accountType: 'BUSINESS' });
    await prisma.businessProfile.create({
      data: { userId: shop.id, companyName: 'Zawia Foods LLC', tradingName: 'Café Zawia', country: 'LY', logoUrl: 'https://cdn.example.com/logo.png', kybStatus: 'APPROVED' },
    });
    const res = await request(app).get(`/api/pay/payee/${handle('cafe')}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee).toMatchObject({ kind: 'MERCHANT', name: 'Café Zawia', avatarUrl: 'https://cdn.example.com/logo.png', verified: true });
  });

  it('never shows a self-declared trading name before KYB approval', async () => {
    const me = await createUser();
    const shop = await createUser({ username: handle('fake'), accountType: 'BUSINESS', kycStatus: 'PENDING' });
    await prisma.businessProfile.create({
      data: { userId: shop.id, companyName: 'Libyana', tradingName: 'Libyana', country: 'LY', kybStatus: 'PENDING' },
    });
    const res = await request(app).get(`/api/pay/payee/${handle('fake')}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee).toMatchObject({ kind: 'PERSON', name: 'Layla M.', verified: false });
    expect(JSON.stringify(res.body)).not.toContain('Libyana');
  });

  it('answers unknown and suspended accounts with the same 404', async () => {
    const me = await createUser();
    await createUser({ username: handle('frozen'), status: 'SUSPENDED' });
    const frozen = await request(app).get(`/api/pay/payee/${handle('frozen')}`).set('Authorization', auth(me));
    const unknown = await request(app).get(`/api/pay/payee/${handle('nobody')}`).set('Authorization', auth(me));
    expect(frozen.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(frozen.body).toEqual(unknown.body);
  });

  it('flags my own code so the app can refuse it before the amount', async () => {
    const me = await createUser({ username: handle('me') });
    const res = await request(app).get(`/api/pay/payee/${handle('me')}`).set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payee.self).toBe(true);
  });

  it('lists recent payees once each, newest first, skipping unavailable accounts', async () => {
    const me = await createUser();
    const a = await createUser({ firstName: 'Amal' });
    const b = await createUser({ firstName: 'Badr' });
    const gone = await createUser({ firstName: 'Gone', status: 'SUSPENDED' });
    const t0 = Date.now() - 60_000;
    await paid(me.id, a.id, new Date(t0));
    await paid(me.id, b.id, new Date(t0 + 1_000));
    await paid(me.id, a.id, new Date(t0 + 2_000));
    await paid(me.id, gone.id, new Date(t0 + 3_000));
    await paid(a.id, me.id, new Date(t0 + 4_000)); // incoming: not a payee

    const res = await request(app).get('/api/pay/recent').set('Authorization', auth(me));
    expect(res.status).toBe(200);
    expect(res.body.payees.map((x: { id: string }) => x.id)).toEqual([a.id, b.id]);
    expect(res.body.payees[0].name).toBe('Amal M.');
  });
});
