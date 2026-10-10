/**
 * Contacts: people you have exchanged money with, and the history with one.
 * Details only for real counterparts, and no email or phone.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const marker = `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
let seq = 0;
let app: Express;
const mk = () => { seq += 1; return prisma.user.create({ data: { email: `${marker}_${seq}@example.com`, phone: `+21891${String(Date.now()).slice(-6)}${seq}`, passwordHash: 'x', firstName: 'Contact', lastName: `N${seq}`, username: `${marker}_${seq}`, kycStatus: 'APPROVED', referralCode: `${marker}${seq}`.slice(-16) } }); };
const auth = (u: any) => `Bearer ${generateTokens(u).accessToken}`;

describeDb('contacts', () => {
  beforeAll(async () => {
    const [{ contactsRouter }, { errorHandler }] = await Promise.all([import('../routes/contacts'), import('../middleware/errorHandler')]);
    app = express(); app.use(express.json()); app.use('/api/contacts', contactsRouter); app.use(errorHandler);
  });
  afterAll(async () => { await prisma.$disconnect().catch(() => {}); });

  it('lists counterparts and shows every payment between you, with totals', async () => {
    const [me, friend, stranger] = [await mk(), await mk(), await mk()];
    await prisma.transfer.create({ data: { senderId: me.id, receiverId: friend.id, currency: 'USD', amount: new Decimal('25'), reference: `${marker}_t1`, note: 'Lunch' } });
    await prisma.transfer.create({ data: { senderId: friend.id, receiverId: me.id, currency: 'USD', amount: new Decimal('10'), reference: `${marker}_t2` } });
    await prisma.claimLink.create({ data: { senderId: friend.id, asset: 'USDT', amount: new Decimal('5'), claimToken: `${marker}_tok`, status: 'CLAIMED', claimedById: me.id, claimedAt: new Date(), expiresAt: new Date(Date.now() + 86400_000) } });

    const list = await request(app).get('/api/contacts').set('Authorization', auth(me));
    expect(list.status).toBe(200);
    expect(list.body.contacts).toEqual([expect.objectContaining({ id: friend.id, name: `Contact ${friend.lastName}`, username: friend.username, count: 3, verified: true })]);
    expect(JSON.stringify(list.body)).not.toContain(friend.email);

    const d = await request(app).get(`/api/contacts/${friend.id}`).set('Authorization', auth(me));
    expect(d.status).toBe(200);
    expect(d.body.items.map((i: any) => [i.direction, i.via])).toEqual(expect.arrayContaining([['SENT', 'transfer'], ['RECEIVED', 'transfer'], ['RECEIVED', 'link']]));
    expect(d.body.summary.byCurrency).toEqual(expect.arrayContaining([{ currency: 'USD', sent: '25', received: '10' }, { currency: 'USDT', sent: '0', received: '5' }]));
    expect(JSON.stringify(d.body)).not.toContain(friend.email);
    expect(JSON.stringify(d.body)).not.toContain(friend.phone!);

    const nope = await request(app).get(`/api/contacts/${stranger.id}`).set('Authorization', auth(me));
    expect(nope.status).toBe(404);
  });
});
