/**
 * KYC limits on calendar periods: what the customer can do now and when it
 * resets (dd/mm/yyyy), the LIMIT_EXCEEDED error that carries the same
 * details, and that no security code is issued for a transfer the limit
 * would refuse.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { prisma } from '../utils/prisma';

jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  issueStepUp: jest.fn().mockResolvedValue({ method: 'email' }),
}));
import { issueStepUp } from '../services/security/stepUp.service';
import { enforceKycLimit, formatLimitDate, limitPeriods, limitStatus } from '../utils/kycLimits';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `lim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let seq = 0;
let app: Express;

async function user(tier: 'TIER_1' | 'TIER_2' = 'TIER_1') {
  seq += 1;
  return prisma.user.create({
    data: {
      email: `${marker}_${seq}@example.com`, passwordHash: 'x', firstName: 'Limit', lastName: `T${seq}`, username: `${marker}_${seq}`,
      status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: tier, emailVerified: true, referralCode: `${marker}${seq}`.slice(-16),
    },
  });
}
const tx = (userId: string, type: 'BUY' | 'TRANSFER_OUT', amount: string, createdAt = new Date()) => prisma.transaction.create({
  data: { userId, type, currency: 'USD', amount: new Decimal(amount), fee: new Decimal(0), balanceBefore: new Decimal(0), balanceAfter: new Decimal(0), createdAt },
});

describeDb('KYC limits', () => {
  beforeAll(async () => {
    const [{ transferRouter }, { userRouter }, { errorHandler }] = await Promise.all([import('../routes/transfer'), import('../routes/user'), import('../middleware/errorHandler')]);
    app = express();
    app.use(express.json());
    app.use('/api/transfers', transferRouter);
    app.use('/api/users', userRouter);
    app.use(errorHandler);
  });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it('resets daily at local midnight and monthly on the 1st (Tripoli time)', () => {
    const p = limitPeriods(new Date('2026-10-31T22:30:00Z')); // 00:30 on 1 Nov in Tripoli
    expect(formatLimitDate(p.monthStart)).toBe('01/11/2026');
    expect(formatLimitDate(p.monthEnd)).toBe('01/12/2026');
    expect(formatLimitDate(p.dayEnd)).toBe('02/11/2026');
  });

  it('says when a used-up monthly limit frees, and what the next level allows', async () => {
    const u = await user('TIER_1'); // ONRAMP_BUY: 2,000 per tx, 5,000 a day, 20,000 a month
    const monthStart = limitPeriods().monthStart;
    // Spread over earlier days of this month where possible so the daily limit is not what binds.
    for (let i = 0; i < 10; i++) await tx(u.id, 'BUY', '-2000', new Date(Math.max(monthStart.getTime() + 60_000, Date.now() - (i + 1) * 3600_000 * 30)));
    const st = await limitStatus(u.id, 'ONRAMP_BUY');
    expect(st.monthly.usedUsd).toBe(20000);
    expect(st.maxNowUsd).toBe(0);
    expect(st.availableAgainOn).toBe(st.monthly.resetsOn);
    expect(st.monthly.resetsOn).toMatch(/^01\/\d{2}\/\d{4}$/);
    expect(st.nextTier).toEqual(expect.objectContaining({ tier: 'TIER_2', monthlyUsd: 250000 }));

    await expect(enforceKycLimit(u.id, 'ONRAMP_BUY', 50, 'USD')).rejects.toMatchObject({
      statusCode: 400, code: 'LIMIT_EXCEEDED',
      message: expect.stringContaining(`again from ${st.monthly.resetsOn}`),
      details: expect.objectContaining({ window: 'MONTHLY', availableAgainOn: st.monthly.resetsOn }),
    });
  });

  it('tells the customer how much is left when an amount is over what remains', async () => {
    const u = await user('TIER_1');
    await tx(u.id, 'TRANSFER_OUT', '-1500'); // SEND: 1,000 per tx, 2,000 a day
    const st = await limitStatus(u.id, 'SEND');
    expect(st.maxNowUsd).toBe(500);
    await expect(enforceKycLimit(u.id, 'SEND', 800, 'USD')).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED', message: expect.stringContaining('up to 500 USD more today'), details: expect.objectContaining({ window: 'DAILY' }),
    });
    await expect(enforceKycLimit(u.id, 'SEND', 1200, 'USD')).rejects.toMatchObject({ details: expect.objectContaining({ window: 'PER_TX' }) });
  });

  it('refuses an over-limit transfer before sending a security code, and the app endpoint reports it', async () => {
    const u = await user('TIER_1');
    const r2 = await user('TIER_1');
    await tx(u.id, 'TRANSFER_OUT', '-2000');
    (issueStepUp as jest.Mock).mockClear();
    const auth = `Bearer ${generateTokens(u).accessToken}`;
    const res = await request(app).post('/api/transfers/send').set('Authorization', auth).send({ recipientEmail: r2.email, currency: 'USD', amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LIMIT_EXCEEDED');
    expect(issueStepUp).not.toHaveBeenCalled();

    const limits = await request(app).get('/api/users/me/limits').set('Authorization', auth);
    expect(limits.status).toBe(200);
    expect(limits.body.actions.SEND).toEqual(expect.objectContaining({ maxNowUsd: 0, availableAgainOn: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/) }));
    expect(limits.body.timezone).toBe('Africa/Tripoli');
  });
});
