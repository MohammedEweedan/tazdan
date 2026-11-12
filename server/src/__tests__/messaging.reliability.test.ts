/**
 * Messaging reliability: what a chat app on a bad network depends on.
 *
 *   - a retried send (lost reply, offline outbox) never duplicates a message
 *     and never pays twice — sequentially or concurrently
 *   - chat payments obey the same recipient rules as the Send screen
 *   - opening a thread clears my unread state even with read receipts off
 *   - threads page backwards ("load earlier") and forwards (catch-up)
 *   - every conversation is listed with its own unread count
 *   - the Send screen's transfer is idempotent on its key
 *   - new messages push the receiver, per their preferences
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

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn(),
}));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn(),
  verifyStepUp: jest.fn(),
}));
const sendPushToUser = jest.fn().mockResolvedValue(undefined);
const pushTxEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/push.service', () => ({
  ...jest.requireActual('../services/push.service'),
  sendPushToUser: (...args: unknown[]) => sendPushToUser(...args),
  pushTxEvent: (...args: unknown[]) => pushTxEvent(...args),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const PARALLEL = 6;
const marker = `msgrel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser(extra: Record<string, unknown> = {}) {
  const email = `${marker}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      firstName: 'Msg',
      lastName: `Test${emails.length}`,
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

function auth(user: { id: string; email: string; role: string }) {
  return `Bearer ${generateTokens(user).accessToken}`;
}

async function fund(userId: string, amount: string) {
  await prisma.$transaction(async (tx) => {
    await postLedger(tx, {
      refType: 'test_opening',
      refId: `${marker}_${userId}_USD`,
      legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: new Decimal(amount).neg() },
        { type: 'USER', userId, currency: 'USD', amount: new Decimal(amount) },
      ],
    });
  });
}

async function usd(userId: string) {
  const w = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
  return new Decimal(w?.balance.toString() ?? '0').toString();
}

const pay = (amount: number, clientId?: string) => ({
  content: 'pay', type: 'PAYMENT', metadata: { amount, currency: 'USD' }, ...(clientId ? { clientId } : {}),
});

/** notifyNewMessage runs after the response — let it finish. */
const settle = () => new Promise((r) => setTimeout(r, 150));

describeDb('messaging reliability', () => {
  beforeAll(async () => {
    const [{ messageRouter }, transactions, { errorHandler }] = await Promise.all([
      import('../routes/messages'),
      import('../routes/transactions'),
      import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/messages', messageRouter);
    app.use('/api/transactions', transactions.default);
    app.use(errorHandler);
  });

  beforeEach(() => {
    sendPushToUser.mockClear();
    pushTxEvent.mockClear();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('a chat payment retried with the same clientId pays once and replays the original', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    await fund(sender.id, '100');
    const body = { receiverId: receiver.id, ...pay(30, `${marker}_retry`) };

    const first = await request(app).post('/api/messages').set('Authorization', auth(sender)).send(body);
    const retry = await request(app).post('/api/messages').set('Authorization', auth(sender)).send(body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.replayed).toBe(true);
    expect(retry.body.message.id).toBe(first.body.message.id);
    expect(retry.body.message.clientId).toBe(`${marker}_retry`);
    expect(await usd(sender.id)).toBe('70');
    expect(await usd(receiver.id)).toBe('30');
    expect(await prisma.message.count({ where: { senderId: sender.id } })).toBe(1);
    expect(await prisma.transfer.count({ where: { senderId: sender.id } })).toBe(1);
  });

  it('concurrent retries of one chat payment move the money exactly once', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    await fund(sender.id, '100');
    const body = { receiverId: receiver.id, ...pay(25, `${marker}_race`) };

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app).post('/api/messages').set('Authorization', auth(sender)).send(body)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.message.id)).size).toBe(1);
    expect(await usd(sender.id)).toBe('75');
    expect(await usd(receiver.id)).toBe('25');
    expect(await prisma.transfer.count({ where: { senderId: sender.id } })).toBe(1);
  });

  it('a clientId reused for a different recipient is refused, not replayed', async () => {
    const sender = await createUser();
    const a = await createUser();
    const b = await createUser();
    const clientId = `${marker}_reuse`;
    const ok = await request(app).post('/api/messages').set('Authorization', auth(sender))
      .send({ receiverId: a.id, content: 'hi', clientId });
    const reused = await request(app).post('/api/messages').set('Authorization', auth(sender))
      .send({ receiverId: b.id, content: 'hi', clientId });
    expect(ok.status).toBe(201);
    expect(reused.status).toBe(409);
    expect(await prisma.message.count({ where: { receiverId: b.id } })).toBe(0);
  });

  it('a retried text message is stored once', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    const body = { receiverId: receiver.id, content: 'ok', clientId: `${marker}_text` };
    const results = await Promise.all(Array.from({ length: 3 }, () =>
      request(app).post('/api/messages').set('Authorization', auth(sender)).send(body)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(await prisma.message.count({ where: { senderId: sender.id } })).toBe(1);
  });

  it('chat payments refuse recipients the Send screen refuses', async () => {
    const sender = await createUser();
    const suspended = await createUser({ status: 'SUSPENDED' });
    await fund(sender.id, '50');
    const res = await request(app).post('/api/messages').set('Authorization', auth(sender))
      .send({ receiverId: suspended.id, ...pay(10) });
    expect(res.status).toBe(400);
    expect(res.body.details?.reason ?? res.body.reason).toBe('UNAVAILABLE');
    expect(await usd(sender.id)).toBe('50');
    expect(await usd(suspended.id)).toBe('0');
  });

  it('opening a thread clears my unread count even with read receipts off', async () => {
    const sender = await createUser();
    const reader = await createUser({ notificationPrefs: { messages: { readReceiptsOn: false } } });
    for (const content of ['one', 'two']) {
      await request(app).post('/api/messages').set('Authorization', auth(sender))
        .send({ receiverId: reader.id, content });
    }
    const before = await request(app).get('/api/messages/unread-count').set('Authorization', auth(reader));
    expect(before.body.unread).toBe(2);

    await request(app).post(`/api/messages/read/${sender.id}`).set('Authorization', auth(reader)).send({});

    const after = await request(app).get('/api/messages/unread-count').set('Authorization', auth(reader));
    const inbox = await request(app).get('/api/messages/conversations').set('Authorization', auth(reader));
    expect(after.body.unread).toBe(0);
    expect(inbox.body.conversations[0].unread).toBe(0);
    // The sender still gets no read receipt.
    const sent = await prisma.message.findMany({ where: { senderId: sender.id } });
    expect(sent.every((m) => m.isRead === false && m.readAt === null && m.seenAt !== null)).toBe(true);
  });

  it('pages a thread backwards and catches up forwards', async () => {
    const a = await createUser();
    const b = await createUser();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/messages').set('Authorization', auth(i % 2 ? b : a))
        .send({ receiverId: (i % 2 ? a : b).id, content: `m${i}` });
      ids.push(res.body.message.id);
    }

    const latest = await request(app).get(`/api/messages/${b.id}?limit=2`).set('Authorization', auth(a));
    expect(latest.body.messages.map((m: any) => m.content)).toEqual(['m3', 'm4']);
    expect(latest.body.hasMore).toBe(true);

    const earlier = await request(app).get(`/api/messages/${b.id}?limit=2&before=${ids[3]}`).set('Authorization', auth(a));
    expect(earlier.body.messages.map((m: any) => m.content)).toEqual(['m1', 'm2']);
    expect(earlier.body.hasMore).toBe(true);

    const catchUp = await request(app).get(`/api/messages/${b.id}?after=${ids[1]}`).set('Authorization', auth(a));
    expect(catchUp.body.messages.map((m: any) => m.content)).toEqual(['m2', 'm3', 'm4']);
    expect(catchUp.body.hasMore).toBe(false);

    const unknown = await request(app).get(`/api/messages/${b.id}?before=00000000-0000-0000-0000-000000000000`).set('Authorization', auth(a));
    expect(unknown.status).toBe(404);
  });

  it('lists each conversation once, newest first, with its own unread count', async () => {
    const me = await createUser();
    const x = await createUser();
    const y = await createUser();
    await request(app).post('/api/messages').set('Authorization', auth(x)).send({ receiverId: me.id, content: 'x1' });
    await request(app).post('/api/messages').set('Authorization', auth(x)).send({ receiverId: me.id, content: 'x2' });
    await request(app).post('/api/messages').set('Authorization', auth(me)).send({ receiverId: y.id, content: 'y1' });

    const res = await request(app).get('/api/messages/conversations').set('Authorization', auth(me));
    const rows = res.body.conversations.map((c: any) => [c.partner.id, c.lastMessage.content, c.unread]);
    expect(rows).toEqual([[y.id, 'y1', 0], [x.id, 'x2', 2]]);
  });

  it('the Send screen transfer is idempotent on its key', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    await fund(sender.id, '100');
    const body = { receiverId: receiver.id, currency: 'USD', amount: 40, idempotencyKey: `${marker}_send` };

    const results = await Promise.all(Array.from({ length: PARALLEL }, () =>
      request(app).post('/api/transactions/transfer').set('Authorization', auth(sender)).send(body)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.transfer.id)).size).toBe(1);
    expect(results.filter((r) => r.body.replayed).length).toBe(PARALLEL - 1);
    expect(await usd(sender.id)).toBe('60');
    expect(await usd(receiver.id)).toBe('40');

    const changed = await request(app).post('/api/transactions/transfer').set('Authorization', auth(sender))
      .send({ ...body, amount: 41 });
    expect(changed.status).toBe(409);
    expect(await usd(sender.id)).toBe('60');

    await settle();
    expect(pushTxEvent).toHaveBeenCalledTimes(2); // "Sent" and "Received", once
  });

  it('pushes new messages to the receiver, honouring their preferences', async () => {
    const sender = await createUser({ username: `${marker.slice(-12)}snd` });
    const receiver = await createUser({ expoPushToken: 'ExponentPushToken[abcdefghijklmnop]' });

    await request(app).post('/api/messages').set('Authorization', auth(sender)).send({ receiverId: receiver.id, content: 'hello there' });
    await settle();
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    const [to, payload] = sendPushToUser.mock.calls[0];
    expect(to).toBe(receiver.id);
    expect(payload).toMatchObject({ body: 'hello there', badge: 1, priority: 'high', data: { kind: 'message', partnerId: sender.id } });

    await prisma.user.update({ where: { id: receiver.id }, data: { notificationPrefs: { push: { messagePreview: false }, pushLocale: 'ar' } } });
    await request(app).post('/api/messages').set('Authorization', auth(sender)).send({ receiverId: receiver.id, content: 'secret' });
    await settle();
    expect(sendPushToUser.mock.calls[1][1]).toMatchObject({ body: 'رسالة جديدة', badge: 2 });

    await prisma.user.update({ where: { id: receiver.id }, data: { notificationPrefs: { push: { messages: false } } } });
    await request(app).post('/api/messages').set('Authorization', auth(sender)).send({ receiverId: receiver.id, content: 'muted' });
    await settle();
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });
});
