/**
 * Identity: account-recovery and 2FA-change exploits (Prisma faked in memory).
 */
import crypto from 'crypto';
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

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
let n = 0;
const uniq = (p: string) => `${p}${Date.now().toString(36)}${++n}`;
const PASSWORD = 'Correct-Horse-9';

async function makeUser(over: Record<string, any> = {}) {
  return fakePrisma.user.create({ data: { email: `${uniq('r')}@example.com`, username: uniq('r'), passwordHash: await bcrypt.hash(PASSWORD, 4), ...over } });
}
async function call(fn: (req: any, res: any, next: any) => Promise<any>, opts: Parameters<typeof harness>[0]) {
  const h = harness(opts);
  await fn(h.req, h.res, h.next);
  return { status: h.error ? h.error.statusCode ?? 400 : h.res.statusCode, error: h.error, body: h.res.body };
}
const row = (id: string) => fakePrisma._tables.user.find((u: any) => u.id === id);

describe('password reset code', () => {
  const pending = () => ({ passwordResetCode: sha256('123456'), passwordResetAttempts: 0, passwordResetExpires: new Date(Date.now() + 3_600_000) });

  it('a burst of parallel guesses gets at most 5 tries, then the code is dead', async () => {
    const u = await makeUser(pending());
    const guesses = Array.from({ length: 20 }, (_, i) => String(i).padStart(6, '0'));
    const results = await Promise.all(guesses.map((token) => call(AuthController.resetPassword, { body: { email: u.email, token, password: 'New-Password-1' } })));
    expect(results.every((r) => r.status === 400)).toBe(true);
    // The old read-compare-write let every parallel request see "0 attempts";
    // here the code is burned, so even the right code is refused now.
    const right = await call(AuthController.resetPassword, { body: { email: u.email, token: '123456', password: 'New-Password-1' } });
    expect(right.status).toBe(400);
    expect(row(u.id).passwordResetCode).toBeNull();
    expect(await bcrypt.compare(PASSWORD, row(u.id).passwordHash)).toBe(true);
  });

  it('a valid code resets the password exactly once, even in parallel', async () => {
    const u = await makeUser(pending());
    const results = await Promise.all(['First-Password-1', 'Second-Password-2'].map((password) =>
      call(AuthController.resetPassword, { body: { email: u.email.toUpperCase(), token: '123456', password } })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });
});

describe('2FA recovery', () => {
  const recovering = () => ({
    twoFactorEnabled: true, twoFactorSecret: speakeasy.generateSecret().base32,
    twoFactorRecoveryCode: sha256('654321'), twoFactorRecoveryExpires: new Date(Date.now() + 1_800_000),
    phone: '+218912345678', dateOfBirth: new Date('1990-01-01T00:00:00Z'),
  });
  const verify = (email: string, over: Record<string, any> = {}) =>
    call(AuthController.verify2FARecovery, { body: { email, code: '654321', phone: '0912345678', dateOfBirth: '1990-01-01', ...over } });

  it('caps guesses per recovery code (it used to have no cap at all)', async () => {
    const u = await makeUser(recovering());
    for (let i = 0; i < 6; i++) await verify(u.email, { code: String(100000 + i) });
    const right = await verify(u.email);
    expect(right.status).not.toBe(200);
    expect(row(u.id).twoFactorEnabled).toBe(true);
  });

  it('needs the real phone number — a phone with no digits used to match every account', async () => {
    const u = await makeUser(recovering());
    const bypass = await verify(u.email, { phone: '---' });
    expect(bypass.status).toBe(400);
    expect(row(u.id).twoFactorEnabled).toBe(true);
    const short = await verify(u.email, { phone: '678' });
    expect(short.status).toBe(400);
  });

  it('succeeds with the right details and signs the user out everywhere', async () => {
    const u = await makeUser(recovering());
    await fakePrisma.refreshToken.create({ data: { userId: u.id, tokenHash: uniq('t'), expiresAt: new Date(Date.now() + 1e9) } });
    const ok = await verify(u.email);
    expect(ok.status).toBe(200);
    expect(row(u.id).twoFactorEnabled).toBe(false);
    expect(fakePrisma._tables.refreshToken.filter((t: any) => t.userId === u.id && !t.revokedAt)).toHaveLength(0);
    // Single use.
    expect((await verify(u.email)).status).toBe(400);
  });
});

describe('turning two-factor authentication on and off', () => {
  it('turning 2FA on needs the account password, not just a session', async () => {
    const secret = speakeasy.generateSecret().base32;
    const u = await makeUser({ twoFactorSecret: secret });
    const user = { id: u.id, email: u.email, role: 'USER' };
    const code = () => speakeasy.totp({ secret, encoding: 'base32' });

    const sessionOnly = await call(AuthController.verify2FA, { user, body: { code: code() } });
    expect(sessionOnly.status).toBe(400);
    expect(row(u.id).twoFactorEnabled).toBe(false);

    const wrongPw = await call(AuthController.verify2FA, { user, body: { code: code(), password: 'nope-nope-1' } });
    expect(wrongPw.status).toBe(400);
    expect(row(u.id).twoFactorEnabled).toBe(false);

    const ok = await call(AuthController.verify2FA, { user, body: { code: code(), password: PASSWORD } });
    expect(ok.status).toBe(200);
    expect(row(u.id).twoFactorEnabled).toBe(true);
  });

  it('turning 2FA off gives one answer for a wrong password or code, and caps the tries', async () => {
    const secret = speakeasy.generateSecret().base32;
    const u = await makeUser({ twoFactorEnabled: true, twoFactorSecret: secret });
    const user = { id: u.id, email: u.email, role: 'USER' };
    const badPw = await call(AuthController.disable2FA, { user, body: { code: '000000', password: 'wrong-password' } });
    const badCode = await call(AuthController.disable2FA, { user, body: { code: '000000', password: PASSWORD } });
    expect(badPw.status).toBe(badCode.status);
    expect(badPw.error.message).toBe(badCode.error.message);
    for (let i = 0; i < 3; i++) await call(AuthController.disable2FA, { user, body: { code: '000000', password: PASSWORD } });
    const locked = await call(AuthController.disable2FA, { user, body: { code: speakeasy.totp({ secret, encoding: 'base32' }), password: PASSWORD } });
    expect(locked.status).toBe(429);
    expect(row(u.id).twoFactorEnabled).toBe(true);
  });
});

describe('email verification', () => {
  it('the GET link path no longer verifies whichever account holds a bare code', async () => {
    const u = await makeUser({ emailVerificationToken: '111111', emailVerificationExpires: new Date(Date.now() + 3_600_000), status: 'PENDING' });
    const r = await call(AuthController.verifyEmail, { query: { token: '111111' } });
    expect(r.error).toBeDefined();
    expect(row(u.id).emailVerified).toBe(false);
    const withEmail = await call(AuthController.verifyEmail, { query: { token: '111111', email: u.email } });
    expect(withEmail.status).toBe(200);
    expect(row(u.id).emailVerified).toBe(true);
  });

  it('caps code guesses per account', async () => {
    const u = await makeUser({ emailVerificationToken: '222222', emailVerificationExpires: new Date(Date.now() + 3_600_000) });
    const user = { id: u.id, email: u.email, role: 'USER' };
    for (let i = 0; i < 5; i++) await call(AuthController.verifyEmailCode, { user, body: { code: String(300000 + i) } });
    const right = await call(AuthController.verifyEmailCode, { user, body: { code: '222222' } });
    expect(right.status).not.toBe(200);
    expect(row(u.id).emailVerified).toBe(false);
  });
});
