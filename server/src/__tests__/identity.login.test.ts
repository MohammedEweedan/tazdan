/**
 * Identity: login and registration exploits (Prisma faked in memory).
 *
 *  - unknown accounts must cost a real bcrypt comparison (timing oracle),
 *  - closed/banned/locked states must not be revealed without the password,
 *  - unknown identifiers lock out on the same schedule as real accounts,
 *  - parallel guesses cannot outrun the account lockout,
 *  - an authenticator code works once,
 *  - emails and handles are unique regardless of case; staff-like handles
 *    and markup in names are refused.
 */
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';

jest.mock('../utils/prisma', () => ({ prisma: require('./helpers/fakePrisma').fakePrisma }));
jest.mock('../services/email', () => ({
  sendWelcomeEmail: jest.fn(async () => undefined), sendVerificationEmail: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async () => undefined), send2FARecoveryEmail: jest.fn(async () => undefined),
  sendEmail: jest.fn(async () => undefined), emailErrorSummary: () => 'x',
}));
jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn(async () => undefined) }));
jest.mock('../services/whatsapp', () => ({ startVerification: jest.fn(), checkVerification: jest.fn() }));
jest.mock('../services/platform/securityEvents', () => ({ recordSecurityEvent: jest.fn(async () => undefined) }));
jest.mock('../services/risk/engine', () => ({ recordRiskEvent: jest.fn(async () => undefined) }));
jest.mock('../utils/deviceInfo', () => ({ parseUserAgent: () => ({ name: 'Phone', type: 'mobile', os: 'iOS' }), geoLocate: async () => null }));
jest.mock('../services/security/notify', () => ({ sendSecurityNotice: jest.fn() }), { virtual: true });

import { fakePrisma, harness } from './helpers/fakePrisma';
import { AuthController } from '../controllers/auth.controller';

let n = 0;
const uniq = (p: string) => `${p}${Date.now().toString(36)}${++n}`;

async function makeUser(over: Record<string, any> = {}, password = 'Correct-Horse-9') {
  const email = `${uniq('u')}@example.com`;
  return fakePrisma.user.create({ data: { email, username: uniq('h'), passwordHash: await bcrypt.hash(password, 4), ...over } });
}

async function login(body: Record<string, any>) {
  const h = harness({ body });
  await AuthController.login(h.req, h.res, h.next);
  return { status: h.error ? h.error.statusCode ?? 400 : h.res.statusCode, error: h.error, body: h.res.body };
}

afterEach(() => jest.restoreAllMocks());

describe('login does not reveal whether an account exists', () => {
  it('spends a real bcrypt comparison at the production cost for an unknown identifier', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    const r = await login({ email: `${uniq('nobody')}@example.com`, password: 'whatever-123' });
    expect(r.status).toBe(401);
    expect(spy).toHaveBeenCalled();
    const hash = spy.mock.calls[0][1] as string;
    // The old "dummy" was 63 characters: bcryptjs rejects it instantly, so an
    // unknown email answered in ~0 ms and a registered one in ~250 ms.
    expect(hash).toHaveLength(60);
    expect(bcrypt.getRounds(hash)).toBe(12);
  });

  it('does not reveal a closed or banned account to someone without the password', async () => {
    const closed = await makeUser({ status: 'CLOSED' });
    const banned = await makeUser({ status: 'BANNED' });
    for (const u of [closed, banned]) {
      const r = await login({ email: u.email, password: 'wrong-password-1' });
      expect(r.status).toBe(401);
      expect(r.error.message).toBe('Invalid credentials');
    }
    // The owner, who knows the password, is told.
    const ok = await login({ email: closed.email, password: 'Correct-Horse-9' });
    expect(ok.status).toBe(403);
  });

  it('locks unknown identifiers out on the same schedule as real accounts', async () => {
    const real = await makeUser();
    const ghost = `${uniq('ghost')}@example.com`;
    const realStatuses: number[] = [];
    const ghostStatuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      realStatuses.push((await login({ email: real.email, password: `wrong-${i}` })).status);
      ghostStatuses.push((await login({ email: ghost, password: `wrong-${i}` })).status);
    }
    expect(ghostStatuses).toEqual(realStatuses);
    expect(realStatuses[5]).toBe(429);
  });
});

describe('login lockout cannot be raced', () => {
  it('a burst of 20 parallel wrong guesses gets at most 5 password comparisons', async () => {
    const user = await makeUser();
    const spy = jest.spyOn(bcrypt, 'compare');
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => login({ email: user.email, password: `guess-${i}` })));
    const compared = spy.mock.calls.filter((c) => c[1] === user.passwordHash).length;
    expect(compared).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(15);
    // And the account is now locked, even for the right password.
    expect((await login({ email: user.email, password: 'Correct-Horse-9' })).status).toBe(429);
  });
});

describe('authenticator codes are single-use at login', () => {
  it('rejects a replayed code', async () => {
    const secret = speakeasy.generateSecret().base32;
    const user = await makeUser({ twoFactorEnabled: true, twoFactorSecret: secret });
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const first = await login({ email: user.email, password: 'Correct-Horse-9', twoFactorCode: code });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeDefined();
    const replay = await login({ email: user.email, password: 'Correct-Horse-9', twoFactorCode: code });
    expect(replay.status).toBe(401);
  });
});

describe('registration', () => {
  const base = () => ({
    password: 'TestPass123!', firstName: 'Amal', lastName: 'Saleh', country: 'LY',
    phoneCountryCode: '218', phone: `91${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`, dateOfBirth: '1990-01-01',
  });
  async function register(body: Record<string, any>) {
    const h = harness({ body });
    await AuthController.register(h.req, h.res, h.next);
    return { status: h.error ? h.error.statusCode ?? 400 : h.res.statusCode, error: h.error, body: h.res.body };
  }

  it('stores the email lower-case and refuses a case variant of an existing account', async () => {
    const handle = uniq('amal');
    const email = `${uniq('Amal')}@Example.com`;
    const first = await register({ ...base(), email, username: handle });
    expect(first.status).toBe(201);
    expect(first.body.user.email).toBe(email.toLowerCase());
    const dup = await register({ ...base(), email: email.toUpperCase(), username: uniq('other') });
    expect(dup.status).toBe(400);
  });

  it('refuses a case variant of a taken handle and staff-like handles', async () => {
    const handle = uniq('salem');
    expect((await register({ ...base(), email: `${uniq('a')}@example.com`, username: handle })).status).toBe(201);
    expect((await register({ ...base(), email: `${uniq('b')}@example.com`, username: handle.toUpperCase() })).status).toBe(400);
    for (const reserved of ['support', 'Tazdan_Help', 't.a.z.d.a.n', 'admin2']) {
      expect((await register({ ...base(), email: `${uniq('c')}@example.com`, username: reserved })).status).toBe(400);
    }
  });

  it('refuses markup in names (they are interpolated into platform emails) and unsafe avatars', async () => {
    const r1 = await register({ ...base(), email: `${uniq('d')}@example.com`, username: uniq('d'), firstName: '<a href="https://evil.example">Verify now</a>' });
    expect(r1.status).toBe(400);
    const r2 = await register({ ...base(), email: `${uniq('e')}@example.com`, username: uniq('e'), avatarUrl: 'javascript:alert(1)' });
    expect(r2.status).toBe(400);
    const ok = await register({ ...base(), email: `${uniq('f')}@example.com`, username: uniq('f'), firstName: 'محمد', lastName: "O'Brien-Smith", avatarUrl: '🦅' });
    expect(ok.status).toBe(201);
  });
});
