/**
 * In-app account deletion (closure), required by the App Store and Google
 * Play: blocked while money is held, always needs a server-checked code,
 * signs the customer out everywhere, and anonymises personal data after the
 * retention period while the financial records stay.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  issueStepUp: jest.fn().mockResolvedValue({ method: 'email' }),
  verifyStepUp: jest.fn().mockResolvedValue(undefined),
}));
import { issueStepUp, verifyStepUp } from '../services/security/stepUp.service';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `close_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const emails: string[] = [];
let app: Express;

async function createUser(password = 'Correct-Horse-9') {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: await bcrypt.hash(password, 4), firstName: 'Close', lastName: 'Me',
      username: `${marker}_${emails.length}`, status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2',
      emailVerified: true, referralCode: `${marker}${emails.length}`.slice(-16), bio: 'hello', profilePublic: true,
    },
  });
}
const auth = (u: any) => `Bearer ${generateTokens(u).accessToken}`;

describeDb('account closure', () => {
  beforeAll(async () => {
    const [{ userRouter }, { authRouter }, { errorHandler }] = await Promise.all([
      import('../routes/user'), import('../routes/auth'), import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/users', userRouter);
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { OR: [{ email: { in: emails } }, { email: { startsWith: 'closed+' }, closureReason: marker }] }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.p2PListing.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('lists what must be settled first and refuses to close while money is held', async () => {
    const u = await createUser();
    await prisma.$transaction((tx) => postLedger(tx, {
      refType: 'test_opening', refId: `${marker}_${u.id}`,
      legs: [{ type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal('-12.5') }, { type: 'USER', userId: u.id, currency: 'USD', amount: new Decimal('12.5') }],
    }));
    await prisma.deposit.create({ data: { userId: u.id, currency: 'USD', amount: new Decimal('5'), paymentMethod: 'BANK_TRANSFER', status: 'WAITING_CONFIRMATION', reference: `${marker}_dep` } });

    const info = await request(app).get('/api/users/me/closure').set('Authorization', auth(u));
    expect(info.status).toBe(200);
    expect(info.body.canClose).toBe(false);
    expect(info.body.blockers.map((b: any) => b.code).sort()).toEqual(['BALANCE', 'PENDING_DEPOSIT']);
    expect(info.body.blockers.find((b: any) => b.code === 'BALANCE').message).toContain('12.5 USD');

    const r = await request(app).post('/api/users/me/close').set('Authorization', auth(u)).send({ confirm: 'CLOSE', stepUpCode: '123456' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('CLOSURE_BLOCKED');
    expect((await prisma.user.findUnique({ where: { id: u.id } }))!.status).toBe('ACTIVE');
  });

  it('needs a security code, then closes, signs out and refuses sign-in', async () => {
    const u = await createUser('Correct-Horse-9');
    const listing = await prisma.p2PListing.create({ data: { userId: u.id, currency: 'USDT', fiatCurrency: 'USD', side: 'SELL', price: new Decimal(1), amount: new Decimal(10), minLimit: new Decimal(1), maxLimit: new Decimal(10), paymentMethods: ['BANK_TRANSFER'], status: 'ACTIVE' } as any });
    const key = await prisma.aPIKey.create({ data: { userId: u.id, name: 'k', keyHash: `${marker}_hash`, prefix: 'tzk_test_x', permissions: [] } as any });

    const noCode = await request(app).post('/api/users/me/close').set('Authorization', auth(u)).send({ confirm: 'CLOSE' });
    expect(noCode.status).toBe(401);
    expect(noCode.body.code).toBe('STEP_UP_REQUIRED');
    expect(issueStepUp).toHaveBeenCalledWith(u.id, 'account_close');

    const done = await request(app).post('/api/users/me/close').set('Authorization', auth(u)).send({ confirm: 'CLOSE', stepUpCode: '123456', reason: marker });
    expect(done.status).toBe(200);
    expect(verifyStepUp).toHaveBeenCalledWith(u.id, 'account_close', '123456');

    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after!.status).toBe('CLOSED');
    expect(after!.profilePublic).toBe(false);
    expect(after!.bio).toBeNull();
    const years = (after!.erasureDueAt!.getTime() - after!.closedAt!.getTime()) / (365.25 * 86400_000);
    expect(Math.round(years)).toBe(5);
    expect((await prisma.p2PListing.findUnique({ where: { id: listing.id } }))!.status).toBe('CANCELLED');
    expect((await prisma.aPIKey.findUnique({ where: { id: key.id } }))!.isActive).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: 'ACCOUNT_CLOSED', entityId: u.id } })).toBe(1);

    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Correct-Horse-9' });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ACCOUNT_CLOSED');

    const again = await request(app).post('/api/users/me/close').set('Authorization', auth(u)).send({ confirm: 'CLOSE', stepUpCode: '123456' });
    expect(again.status).toBe(409);
  });

  it('a restricted account cannot close itself', async () => {
    const u = await createUser();
    await prisma.user.update({ where: { id: u.id }, data: { status: 'SUSPENDED' } });
    const r = await request(app).post('/api/users/me/close').set('Authorization', auth(u)).send({ confirm: 'CLOSE', stepUpCode: '123456' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('COMPLIANCE_HOLD');
  });

  it('anonymises personal data after the retention period and keeps the financial records', async () => {
    const u = await createUser();
    await prisma.$transaction((tx) => postLedger(tx, {
      refType: 'test_opening', refId: `${marker}_anon_in`,
      legs: [{ type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal('-3') }, { type: 'USER', userId: u.id, currency: 'USD', amount: new Decimal('3') }],
    }));
    await prisma.$transaction((tx) => postLedger(tx, {
      refType: 'test_closing', refId: `${marker}_anon_out`,
      legs: [{ type: 'USER', userId: u.id, currency: 'USD', amount: new Decimal('-3') }, { type: 'SYSTEM_OFFRAMP', currency: 'USD', amount: new Decimal('3') }],
    }));
    await prisma.kYCDocument.create({ data: { userId: u.id, documentType: 'PASSPORT', documentUrl: '/uploads/does-not-exist.jpg' } });
    const { closeAccount, anonymiseDueAccounts } = await import('../services/account/closure.service');
    await closeAccount(u.id, { reason: marker });
    const entriesBefore = await prisma.ledgerEntry.count({ where: { account: { userId: u.id } } });

    expect(await anonymiseDueAccounts(new Date())).toBe(0); // not due yet
    await prisma.user.update({ where: { id: u.id }, data: { erasureDueAt: new Date(Date.now() - 1000) } });
    expect(await anonymiseDueAccounts(new Date())).toBeGreaterThanOrEqual(1);

    const anon = await prisma.user.findUnique({ where: { id: u.id } });
    expect(anon).toEqual(expect.objectContaining({ email: `closed+${u.id}@anonymised.invalid`, firstName: 'Closed', lastName: 'Account', username: null, phone: null, dateOfBirth: null }));
    expect(anon!.anonymisedAt).not.toBeNull();
    expect(await prisma.kYCDocument.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { account: { userId: u.id } } })).toBe(entriesBefore);
    expect(entriesBefore).toBe(2);
  });
});
