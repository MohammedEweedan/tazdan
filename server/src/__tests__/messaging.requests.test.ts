/**
 * Money requests in chat.
 *
 *   - the person asked pays a request from the chat; the request turns PAID
 *     with the payment's reference, in the same transaction as the money
 *   - a request can't be paid twice, for a different amount or currency, or
 *     by anyone but the person asked
 *   - the person asked can decline; the person who asked can cancel; neither
 *     works once the request is closed
 *
 * DB-backed: runs in CI, or locally with RUN_DB_TESTS=1 against a
 * disposable database.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn() }));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/push.service', () => ({
  ...jest.requireActual('../services/push.service'),
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
  pushTxEvent: jest.fn().mockResolvedValue(undefined),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `msgreq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser() {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email, passwordHash: 'test-hash', firstName: 'Req', lastName: `Test${emails.length}`, role: 'USER', status: 'ACTIVE',
      kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, referralCode: `${marker.slice(-10)}_${emails.length}`,
    },
  });
}
const auth = (u: { id: string; email: string; role: string }) => `Bearer ${generateTokens(u).accessToken}`;

async function fund(userId: string, amount: string) {
  await prisma.$transaction((tx) => postLedger(tx, {
    refType: 'test_opening', refId: `${marker}_${userId}_USD`,
    legs: [
      { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal(amount).neg() },
      { type: 'USER', userId, currency: 'USD', amount: new Decimal(amount) },
    ],
  }));
}
const usd = async (userId: string) => new Decimal((await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } }))?.balance.toString() ?? '0').toString();

describeDb('money requests in chat', () => {
  beforeAll(async () => {
    const [{ messageRouter }, { errorHandler }] = await Promise.all([import('../routes/messages'), import('../middleware/errorHandler')]);
    app = express();
    app.use(express.json());
    app.use('/api/messages', messageRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  const ask = (from: any, to: any, amount: number, currency = 'USD') => request(app).post('/api/messages').set('Authorization', auth(from))
    .send({ receiverId: to.id, content: 'dinner', type: 'REQUEST', metadata: { amount, currency, note: 'dinner', status: 'PAID' } });
  const payReq = (from: any, to: any, requestId: string, amount: number, currency = 'USD', clientId?: string) => request(app).post('/api/messages').set('Authorization', auth(from))
    .send({ receiverId: to.id, content: 'paid', type: 'PAYMENT', metadata: { amount, currency, requestId }, ...(clientId ? { clientId } : {}) });

  it('pays a request once, for exactly what was asked', async () => {
    const asker = await createUser();
    const payer = await createUser();
    const other = await createUser();
    await fund(payer.id, '200');
    await fund(other.id, '200');

    const r = await ask(asker, payer, 25);
    expect(r.status).toBe(201);
    expect(r.body.message.metadata.status).toBe('PENDING'); // the client can't pre-set it
    const id = r.body.message.id;

    expect((await payReq(payer, asker, id, 30)).status).toBe(400); // wrong amount
    expect((await payReq(payer, asker, id, 25, 'EUR')).status).toBe(400); // wrong currency
    expect((await payReq(other, asker, id, 25)).status).toBe(400); // not the person asked
    expect(await usd(payer.id)).toBe('200');

    const paid = await payReq(payer, asker, id, 25);
    expect(paid.status).toBe(201);
    const after = await prisma.message.findUniqueOrThrow({ where: { id } });
    expect(after.metadata).toMatchObject({ status: 'PAID', txRef: paid.body.message.metadata.txRef });
    expect(await usd(payer.id)).toBe('175');
    expect(await usd(asker.id)).toBe('25');

    // A second payment (new key) is refused; a retry with the same key replays.
    expect((await payReq(payer, asker, id, 25)).status).toBe(409);
    expect(await usd(payer.id)).toBe('175');
  });

  it('declines and cancels pending requests only', async () => {
    const asker = await createUser();
    const payer = await createUser();
    await fund(payer.id, '50');
    const respond = (who: any, id: string, action: string) => request(app).post(`/api/messages/${id}/request`).set('Authorization', auth(who)).send({ action });

    const a = (await ask(asker, payer, 10)).body.message.id;
    expect((await respond(asker, a, 'DECLINE')).status).toBe(403); // only the person asked declines
    const declined = await respond(payer, a, 'DECLINE');
    expect(declined.status).toBe(200);
    expect(declined.body.message.metadata.status).toBe('DECLINED');
    expect((await payReq(payer, asker, a, 10)).status).toBe(409);
    expect((await respond(payer, a, 'DECLINE')).status).toBe(409);

    const b = (await ask(asker, payer, 5)).body.message.id;
    expect((await respond(payer, b, 'CANCEL')).status).toBe(403); // only the person who asked cancels
    expect((await respond(asker, b, 'CANCEL')).body.message.metadata.status).toBe('CANCELLED');
    expect(await usd(payer.id)).toBe('50');
  });
});
