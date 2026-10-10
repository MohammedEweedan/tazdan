/**
 * Auth and session integration tests against the real app and a real
 * Postgres. Opt in locally with RUN_DB_TESTS=1 (point DATABASE_URL at a
 * disposable database); CI runs them.
 *
 * Covers: registration, login, refresh rotation, refresh reuse detection,
 * concurrent-refresh forking, the session list and "sign out other devices".
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/email', () => {
  const actual = jest.requireActual('../services/email');
  const noop = jest.fn().mockResolvedValue(undefined);
  return new Proxy(actual, { get: (t, k) => (typeof t[k] === 'function' && String(k).startsWith('send') ? noop : t[k]) });
});

// The suite registers and logs in many times from one address; the
// non-production simulator header keeps the in-memory rate limiter out of it.
const api = {
  post: (path: string) => request(app).post(path).set('x-simulator', 'true'),
  get: (path: string) => request(app).get(path).set('x-simulator', 'true'),
  delete: (path: string) => request(app).delete(path).set('x-simulator', 'true'),
};

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `auth${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
let seq = 0;

function payload() {
  seq += 1;
  const email = `${marker}_${seq}@example.com`;
  emails.push(email);
  return {
    email,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    username: `${marker}_${seq}`.slice(0, 30),
    country: 'LY',
    phoneCountryCode: '218',
    phone: `91${String(Date.now()).slice(-6)}${seq}`,
    dateOfBirth: '1990-01-01',
  };
}

describeDb('auth and sessions', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('registers a user, returns tokens, and binds the access token to a session', async () => {
    const res = await api.post('/api/auth/register').send(payload());
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    const claims = jwt.decode(res.body.accessToken) as { sid?: string };
    expect(claims.sid).toBeTruthy();
    const row = await prisma.refreshToken.findUnique({ where: { id: claims.sid! } });
    expect(row?.revokedAt).toBeNull();
  });

  it('rejects a duplicate registration without revealing which field collided', async () => {
    const p = payload();
    expect((await api.post('/api/auth/register').send(p)).status).toBe(201);
    const dup = await api.post('/api/auth/register').send(p);
    expect(dup.status).toBe(400);
    expect(dup.body.error).toMatch(/already in use/);
  });

  it('logs in and returns the current user', async () => {
    const p = payload();
    await api.post('/api/auth/register').send(p);
    const login = await api.post('/api/auth/login').send({ email: p.email, password: p.password });
    expect(login.status).toBe(200);
    const me = await api.get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user?.email ?? me.body.email).toBe(p.email);
  });

  it('rotates refresh tokens and treats reuse of an old one as theft', async () => {
    const p = payload();
    const reg = await api.post('/api/auth/register').send(p);
    const first = reg.body.refreshToken as string;

    const rotated = await api.post('/api/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    // Replaying the rotated-out token revokes every session of the user.
    const replay = await api.post('/api/auth/refresh').send({ refreshToken: first });
    expect(replay.status).toBe(401);
    const again = await api.post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(again.status).toBe(401);
  });

  it('lets only one of several concurrent refreshes with the same token succeed', async () => {
    const reg = await api.post('/api/auth/register').send(payload());
    const token = reg.body.refreshToken as string;
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      api.post('/api/auth/refresh').send({ refreshToken: token }),
    ));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('lists real sessions and signs out every other device', async () => {
    const p = payload();
    await api.post('/api/auth/register').send(p);
    const a = await api.post('/api/auth/login').send({ email: p.email, password: p.password });
    const b = await api.post('/api/auth/login').send({ email: p.email, password: p.password });

    const list = await api.get('/api/security/sessions').set('Authorization', `Bearer ${a.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions.length).toBeGreaterThanOrEqual(2);
    expect(list.body.sessions.filter((s: any) => s.current)).toHaveLength(1);

    const revoke = await api.delete('/api/security/sessions').set('Authorization', `Bearer ${a.body.accessToken}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBeGreaterThanOrEqual(1);

    // Device B can no longer refresh; device A still can.
    expect((await api.post('/api/auth/refresh').send({ refreshToken: b.body.refreshToken })).status).toBe(401);
    expect((await api.post('/api/auth/refresh').send({ refreshToken: a.body.refreshToken })).status).toBe(200);
  });
});
