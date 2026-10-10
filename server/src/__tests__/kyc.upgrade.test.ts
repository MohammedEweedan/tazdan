/**
 * Raising a verification level never removes the limits a customer already
 * has: documents for a higher level are reviewed while the level stays, and
 * declining them keeps it.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import { generateTokens } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `kyu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let seq = 0;
let app: Express;
// Smallest valid PNG (1×1).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const mk = (data: Record<string, unknown>) => { seq += 1; return prisma.user.create({ data: { email: `${marker}_${seq}@example.com`, passwordHash: 'x', firstName: 'Kyc', lastName: `U${seq}`, referralCode: `${marker}${seq}`.slice(-16), ...data } as any }); };
const auth = (u: any) => `Bearer ${generateTokens(u).accessToken}`;

describeDb('verification upgrades', () => {
  const prev = process.env.KYC_PROVIDER;
  beforeAll(async () => {
    process.env.KYC_PROVIDER = 'MANUAL';
    const [{ userRouter }, { adminRouter }, { errorHandler }] = await Promise.all([import('../routes/user'), import('../routes/admin'), import('../middleware/errorHandler')]);
    app = express(); app.use(express.json());
    app.use('/api/users', userRouter); app.use('/api/admin', adminRouter); app.use(errorHandler);
  });
  afterAll(async () => { process.env.KYC_PROVIDER = prev; await prisma.$disconnect().catch(() => {}); });

  it('keeps the current level while an address upgrade is reviewed, and after it is declined', async () => {
    const u = await mk({ kycStatus: 'APPROVED', kycTier: 'TIER_1', status: 'ACTIVE' });
    const admin = await mk({ role: 'ADMIN', status: 'ACTIVE', kycStatus: 'APPROVED' });

    const r = await request(app).post('/api/users/kyc').set('Authorization', auth(u)).field('level', 'ADDRESS').attach('documents', PNG, { filename: 'bill.png', contentType: 'image/png' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual(expect.objectContaining({ kycStatus: 'APPROVED', upgradePending: true }));
    expect(await prisma.user.findUnique({ where: { id: u.id }, select: { kycStatus: true, kycTier: true } })).toEqual({ kycStatus: 'APPROVED', kycTier: 'TIER_1' });

    const status = await request(app).get('/api/users/kyc').set('Authorization', auth(u));
    expect(status.body.pendingUpgrade).toBe('address');

    const queue = await request(app).get('/api/admin/kyc').query({ status: 'PENDING' }).set('Authorization', auth(admin));
    expect(queue.body.users.map((x: any) => x.id)).toContain(u.id);

    const rej = await request(app).put(`/api/admin/kyc/${u.id}/reject`).set('Authorization', auth(admin)).send({ reason: 'Bill is older than 3 months' });
    expect(rej.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: u.id }, select: { kycStatus: true, kycTier: true } })).toEqual({ kycStatus: 'APPROVED', kycTier: 'TIER_1' });
    const after = await request(app).get('/api/users/kyc').set('Authorization', auth(u));
    expect(after.body).toEqual(expect.objectContaining({ pendingUpgrade: null, rejectionReason: 'Bill is older than 3 months' }));
  });

  it('asks for identity first, and refuses a second identity submission once verified', async () => {
    const fresh = await mk({ status: 'ACTIVE' });
    const a = await request(app).post('/api/users/kyc').set('Authorization', auth(fresh)).field('level', 'ADDRESS').attach('documents', PNG, { filename: 'bill.png', contentType: 'image/png' });
    expect(a.status).toBe(400);
    const verified = await mk({ status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2' });
    const b = await request(app).post('/api/users/kyc').set('Authorization', auth(verified)).field('level', 'IDENTITY').attach('documents', PNG, { filename: 'id.png', contentType: 'image/png' });
    expect(b.status).toBe(409);
  });
});
