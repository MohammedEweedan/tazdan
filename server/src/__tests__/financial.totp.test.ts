import speakeasy from 'speakeasy';
jest.mock('../utils/prisma', () => ({ prisma: { stepUpChallenge: { create: jest.fn() } } }));
jest.mock('../utils/redis', () => ({ markOnce: jest.fn() }));
import { markOnce } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { verifyTotpOnce } from '../services/security/totp';

describe('authoritative production MFA replay prevention', () => {
  const saved = process.env.NODE_ENV;
  const secret = 'JBSWY3DPEHPK3PXP';
  beforeEach(() => { process.env.NODE_ENV = 'production'; (markOnce as jest.Mock).mockResolvedValue(true); });
  afterEach(() => { process.env.NODE_ENV = saved; jest.resetAllMocks(); });
  const code = () => speakeasy.totp({ secret, encoding: 'base32' });

  it('cannot reuse a step when another worker already persisted it, even if Redis grants it', async () => {
    (prisma.stepUpChallenge.create as jest.Mock).mockResolvedValueOnce({ id: 'marker' }).mockRejectedValueOnce({ code: 'P2002' });
    const otp = code();
    expect(await verifyTotpOnce('user-1', secret, otp)).toBe(true);
    expect(await verifyTotpOnce('user-1', secret, otp)).toBe(false);
    expect((prisma.stepUpChallenge.create as jest.Mock).mock.calls[0][0].data).toMatchObject({ method: 'TOTP_MARKER', codeHash: 'CONSUMED' });
  });
  it('fails closed on unavailable persistent replay storage', async () => {
    (prisma.stepUpChallenge.create as jest.Mock).mockRejectedValue(new Error('database down'));
    expect(await verifyTotpOnce('user-2', secret, code())).toBe(false);
  });
  it('uses an existing transaction connection when one is supplied', async () => {
    const tx = { stepUpChallenge: { create: jest.fn().mockResolvedValue({}) } };
    expect(await verifyTotpOnce('user-3', secret, code(), { client: tx as any })).toBe(true);
    expect(tx.stepUpChallenge.create).toHaveBeenCalledTimes(1);
    expect(prisma.stepUpChallenge.create).not.toHaveBeenCalled();
  });
});
