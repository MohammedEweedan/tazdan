/**
 * Identity: step-up (transaction confirmation) exploits (Prisma faked in memory).
 */
import crypto from 'crypto';
import speakeasy from 'speakeasy';

jest.mock('../utils/prisma', () => ({ prisma: require('./helpers/fakePrisma').fakePrisma }));
jest.mock('../services/email', () => ({ sendEmail: jest.fn(async () => undefined), emailErrorSummary: () => 'x' }));
jest.mock('../services/platform/securityEvents', () => ({ recordSecurityEvent: jest.fn(async () => undefined) }));
jest.mock('../utils/deviceInfo', () => ({ parseUserAgent: () => ({ name: 'Phone', type: 'mobile', os: 'iOS' }), geoLocate: async () => null }));

import { fakePrisma } from './helpers/fakePrisma';
import { deviceFingerprint, enforceRiskBasedStepUp, enforceStepUp, verifyStepUp } from '../services/security/stepUp.service';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
let n = 0;
const uniq = (p: string) => `${p}${Date.now().toString(36)}${++n}`;
const UA = 'tazdan/2.1 (iPhone; iOS 18.0)';
const headers = () => ({ 'user-agent': UA, 'x-device-id': `dev_${uniq('k')}_a1b2c3d4e5f6` });

async function user(over: Record<string, any> = {}) {
  return fakePrisma.user.create({ data: { email: `${uniq('s')}@example.com`, passwordHash: 'x', ...over } });
}
async function knownDevice(userId: string, h: Record<string, string>) {
  await fakePrisma.knownDevice.create({ data: { userId, fingerprint: deviceFingerprint({ headers: h }) } });
}
async function emailChallenge(userId: string, code: string, action = 'transfer') {
  return fakePrisma.stepUpChallenge.create({ data: { userId, action, method: 'email', codeHash: sha256(code), expiresAt: new Date(Date.now() + 600_000) } });
}
const settle = (p: Promise<unknown>) => p.then(() => 'ok', (e) => e?.code ?? e?.statusCode ?? 'err');

describe('the client-sent biometric flag', () => {
  it('never replaces the server code for a high-value action, even on a known device', async () => {
    const u = await user();
    const h = headers();
    await knownDevice(u.id, h);
    const r = await settle(enforceStepUp({ userId: u.id, action: 'transfer', valueUsd: 50_000, req: { headers: h }, biometricVerified: true }));
    expect(r).toBe('STEP_UP_REQUIRED');
  });

  it('still lets a routine amount through on a known device', async () => {
    const u = await user();
    const h = headers();
    await knownDevice(u.id, h);
    expect(await settle(enforceStepUp({ userId: u.id, action: 'buy', valueUsd: 40, req: { headers: h }, biometricVerified: true }))).toBe('ok');
  });

  it('a request without a device id is never a known device (a User-Agent alone is trivially replayed)', async () => {
    const u = await user();
    // What the old code stored for a request with no x-device-id.
    await fakePrisma.knownDevice.create({ data: { userId: u.id, fingerprint: crypto.createHash('sha256').update(`${UA}::`).digest('hex').slice(0, 32) } });
    const r = await settle(enforceRiskBasedStepUp({ userId: u.id, action: 'transfer', valueUsd: 20, req: { headers: { 'user-agent': UA } } }));
    expect(r).toBe('STEP_UP_REQUIRED');
  });
});

describe('step-up codes', () => {
  it('a burst of parallel wrong guesses cannot outrun the attempt cap', async () => {
    const u = await user();
    await emailChallenge(u.id, '424242');
    const guesses = Array.from({ length: 20 }, (_, i) => String(500000 + i));
    await Promise.all(guesses.map((g) => settle(verifyStepUp(u.id, 'transfer', g))));
    // The old code computed the cap from attempts read BEFORE the increment,
    // so all 20 slipped through and the real code still worked afterwards.
    expect(await settle(verifyStepUp(u.id, 'transfer', '424242'))).not.toBe('ok');
  });

  it('one valid code authorises exactly one action, even when submitted twice in parallel', async () => {
    const u = await user();
    await emailChallenge(u.id, '135790');
    const results = await Promise.all([settle(verifyStepUp(u.id, 'transfer', '135790')), settle(verifyStepUp(u.id, 'transfer', '135790'))]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
  });

  it('an authenticator code cannot be replayed for a second challenge', async () => {
    const secret = speakeasy.generateSecret().base32;
    const u = await user({ twoFactorEnabled: true, twoFactorSecret: secret });
    const challenge = () => fakePrisma.stepUpChallenge.create({ data: { userId: u.id, action: 'withdrawal', method: 'totp', codeHash: 'TOTP', expiresAt: new Date(Date.now() + 600_000) } });
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    await challenge();
    expect(await settle(verifyStepUp(u.id, 'withdrawal', code))).toBe('ok');
    await challenge();
    expect(await settle(verifyStepUp(u.id, 'withdrawal', code))).not.toBe('ok');
  });

  it('rejects non-string codes (type confusion)', async () => {
    const u = await user();
    await emailChallenge(u.id, '111222');
    expect(await settle(verifyStepUp(u.id, 'transfer', ['111222'] as any))).not.toBe('ok');
  });
});
