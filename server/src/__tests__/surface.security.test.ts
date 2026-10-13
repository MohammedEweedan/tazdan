/**
 * API-surface security regressions (no database). Each block reproduces an
 * attack that worked before the fix: forged WhatsApp inbound, webhook replay,
 * staff self-dealing and maker-checker bypasses, PII masking bypass, upload
 * type spoofing and metadata leaks, mail bombing, SSRF to internal addresses,
 * operator injection through query strings, and error-path leaks.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';

jest.mock('../utils/prisma', () => {
  const store: Record<string, Record<string, jest.Mock>> = {};
  const fallback = (op: string) => (op === 'findMany' || op === 'groupBy' ? [] : op === 'count' ? 0 : op.startsWith('find') ? null : { id: `mock-${op}` });
  const model = (name: string) => new Proxy({}, {
    get: (_t, op: string) => {
      store[name] ??= {};
      return (store[name][op] ??= jest.fn(async () => fallback(op)));
    },
  });
  const prisma: any = new Proxy({}, {
    get: (_t, key: string) => {
      if (key === '$transaction') return async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
      if (key === 'then') return undefined;
      if (key.startsWith('$')) return jest.fn(async () => []);
      return model(key);
    },
  });
  return { prisma, __reset: () => { for (const k of Object.keys(store)) delete store[k]; } };
});
jest.mock('../services/whatsapp/index', () => ({
  ...jest.requireActual('../services/whatsapp/index'),
  sendWhatsAppText: jest.fn(async () => ({ ok: true })),
  startVerification: jest.fn(async () => ({ ok: true })),
}));
jest.mock('../services/email', () => ({
  ...jest.requireActual('../services/email'),
  sendWaitlistConfirmation: jest.fn(async () => undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../utils/prisma').prisma;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const resetDb = require('../utils/prisma').__reset as () => void;

import { errorHandler, clientTransportError } from '../middleware/errorHandler';
import { generateTokens } from '../middleware/auth';
import { invalidateStaffCache } from '../services/platform/rbac';
import { parseQueryString, jsonReviver } from '../middleware/httpHardening';
import { maskPii } from '../services/platform/pii';
import { assertNotSelf } from '../services/platform/segregation';
import { isPrivateAddress, publicOnlyLookup, validateEndpointUrl } from '../services/business/webhooks.service';
import { matchesMagic, stripJpegMetadata, stripPngMetadata, stripWebpMetadata, verifyUploads, discardUploadsOnFailure } from '../middleware/upload';
import { fulusWebhookGuard, requireHeaderSecret, requireHmacSignature, safeEqual } from '../middleware/webhookGuards';
import { verifyFulusSignature } from '../services/exchange/fulus.service';
import { csvCell } from '../controllers/export.controller';

const savedEnv = { ...process.env };
afterEach(() => { process.env = { ...savedEnv }; resetDb(); invalidateStaffCache(); jest.clearAllMocks(); });

const rawJsonApp = () => {
  const app = express();
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }, reviver: jsonReviver }));
  return app;
};

// ── WhatsApp inbound ────────────────────────────────────────────────────
describe('WhatsApp inbound webhooks', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const whatsappRouter = require('../routes/whatsapp').default;
  const app = rawJsonApp();
  app.use('/api/whatsapp', whatsappRouter);
  app.use(errorHandler);
  const forged = { entry: [{ changes: [{ value: { messages: [{ from: '218912345678', id: 'wamid.1', text: { body: 'I lost my phone, change my email to attacker@example.com' } }] } }] }] };

  it('refuses a forged Meta message in production when no app secret is configured (was processed unauthenticated)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.META_WA_APP_SECRET;
    const res = await request(app).post('/api/whatsapp/webhook/meta').send(forged);
    expect(res.status).toBe(503);
    expect(db.whatsAppMessage.create).not.toHaveBeenCalled();
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it('refuses a bad signature', async () => {
    process.env.META_WA_APP_SECRET = 'meta-app-secret-for-tests';
    const res = await request(app).post('/api/whatsapp/webhook/meta').set('X-Hub-Signature-256', 'sha256=' + '0'.repeat(64)).send(forged);
    expect(res.status).toBe(403);
    expect(db.message.create).not.toHaveBeenCalled();
  });

  const signed = (body: object) => {
    const raw = JSON.stringify(body);
    return { raw, sig: 'sha256=' + crypto.createHmac('sha256', 'meta-app-secret-for-tests').update(raw).digest('hex') };
  };

  it('matches the exact E.164 number and keeps an unverified number out of the support thread', async () => {
    process.env.META_WA_APP_SECRET = 'meta-app-secret-for-tests';
    db.user.findUnique.mockResolvedValue({ id: 'u-claimer', firstName: 'Mallory', phone: '+218912345678', phoneVerified: false, status: 'ACTIVE' });
    const { raw, sig } = signed(forged);
    const res = await request(app).post('/api/whatsapp/webhook/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig).send(raw);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+218912345678' } }));
    expect(db.message.create).not.toHaveBeenCalled(); // not filed into the account that merely typed this number
    expect(db.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: null }) }));
  });

  it('files a verified customer message into their support thread', async () => {
    process.env.META_WA_APP_SECRET = 'meta-app-secret-for-tests';
    db.user.findUnique.mockResolvedValue({ id: 'u-owner', firstName: 'Salem', phone: '+218912345678', phoneVerified: true, status: 'ACTIVE' });
    db.user.findFirst.mockResolvedValue({ id: 'support-bot' });
    const { raw, sig } = signed(forged);
    await request(app).post('/api/whatsapp/webhook/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig).send(raw);
    await new Promise((r) => setTimeout(r, 50));
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ senderId: 'u-owner', receiverId: 'support-bot' }) }));
  });

  it('never echoes markup from the verification handshake', async () => {
    process.env.META_WA_VERIFY_TOKEN = 'verify-token';
    const bad = await request(app).get('/api/whatsapp/webhook/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token', 'hub.challenge': '<script>alert(1)</script>' });
    expect(bad.status).toBe(403);
    const ok = await request(app).get('/api/whatsapp/webhook/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token', 'hub.challenge': '1158201444' });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/text\/plain/);
  });
});

// ── Provider webhooks ──────────────────────────────────────────────────
describe('provider webhook guards', () => {
  const handler = jest.fn((_req: any, res: any) => res.json({ ok: true }));
  const fulusApp = () => {
    const app = rawJsonApp();
    app.post('/fulus', fulusWebhookGuard(verifyFulusSignature), handler);
    return app;
  };
  const sign = (raw: string) => crypto.createHmac('sha256', 'fulus-secret-for-tests').update(raw).digest('hex');

  it('applies a signed Fulus rate once and refuses a replay of the same body', async () => {
    process.env.FULUS_WEBHOOK_SECRET = 'fulus-secret-for-tests';
    const app = fulusApp();
    const raw = JSON.stringify({ event: 'rate.created', data: { currency: 'USD', rate: '9.81', id: crypto.randomUUID() } });
    const first = await request(app).post('/fulus').set('Content-Type', 'application/json').set('X-Webhook-Signature', sign(raw)).send(raw);
    const replay = await request(app).post('/fulus').set('Content-Type', 'application/json').set('X-Webhook-Signature', sign(raw)).send(raw);
    expect(first.status).toBe(200);
    expect(replay.body).toEqual({ ok: true, duplicate: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses a stale signed Fulus event and an unsigned one', async () => {
    process.env.FULUS_WEBHOOK_SECRET = 'fulus-secret-for-tests';
    const app = fulusApp();
    const raw = JSON.stringify({ event: 'rate.created', data: { currency: 'USD', rate: '6.85', created_at: new Date(Date.now() - 3 * 3600_000).toISOString() } });
    expect((await request(app).post('/fulus').set('Content-Type', 'application/json').set('X-Webhook-Signature', sign(raw)).send(raw)).status).toBe(401);
    expect((await request(app).post('/fulus').send({ event: 'rate.created', data: { currency: 'USD', rate: 1 } })).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('TronGrid: refuses in production without a key, and a wrong key is a clean 401', async () => {
    const app = express();
    app.post('/tron', express.raw({ type: '*/*' }), requireHeaderSecret('TRON_WEBHOOK_API_KEY', 'x-api-key'), handler);
    process.env.NODE_ENV = 'production';
    delete process.env.TRON_WEBHOOK_API_KEY;
    expect((await request(app).post('/tron').send('{}')).status).toBe(503);
    process.env.TRON_WEBHOOK_API_KEY = 'tron-key-for-tests';
    expect((await request(app).post('/tron').set('x-api-key', 'x').send('{}')).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('Alchemy: a short or wrong signature is a 401, not a timingSafeEqual crash', async () => {
    process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = 'alchemy-key-for-tests';
    const app = express();
    app.post('/alchemy', express.raw({ type: '*/*' }), requireHmacSignature('ALCHEMY_WEBHOOK_SIGNING_KEY', 'x-alchemy-signature'), handler);
    app.use(errorHandler);
    expect((await request(app).post('/alchemy').set('x-alchemy-signature', 'abc').send('{"event":{}}')).status).toBe(401);
    const body = '{"event":{"activity":[]}}';
    const good = crypto.createHmac('sha256', 'alchemy-key-for-tests').update(body).digest('hex');
    expect((await request(app).post('/alchemy').set('Content-Type', 'application/json').set('x-alchemy-signature', good).send(body)).status).toBe(200);
  });

  it('safeEqual never throws on length mismatch', () => {
    expect(safeEqual('a', 'abc')).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
});

// ── Staff: self-dealing, maker-checker, PII ────────────────────────────
describe('staff controls', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { adminRouter } = require('../routes/admin');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
  const roles: Record<string, string[]> = {};
  const staff = (id: string, staffRoles: string[]) => {
    roles[id] = staffRoles;
    return `Bearer ${generateTokens({ id, email: `${id}@example.com`, role: 'ADMIN' }).accessToken}`;
  };
  beforeEach(() => {
    db.user.findUnique.mockImplementation(async ({ where }: any) => (roles[where.id]
      ? { id: where.id, role: 'ADMIN', status: 'ACTIVE', twoFactorEnabled: true, staffRoles: roles[where.id] }
      : { id: where.id, role: 'USER', status: 'ACTIVE' }));
  });

  it('a staff member cannot confirm (credit) their own deposit', async () => {
    const auth = staff('staff-ops-1', ['OPERATIONS']);
    db.deposit.findUnique.mockResolvedValue({ id: 'dep-1', userId: 'staff-ops-1', status: 'WAITING_CONFIRMATION', amount: 50000, currency: 'USD' });
    const res = await request(app).put('/api/admin/deposits/dep-1/confirm').set('Authorization', auth).send({});
    expect(res.status).toBe(403);
    expect(db.deposit.updateMany).not.toHaveBeenCalled();
  });

  it('a staff member cannot credit their own account', async () => {
    const me = '11111111-2222-4333-8444-555555555555';
    const auth = staff(me, ['FINANCE']);
    const res = await request(app).post('/api/admin/manual-credit').set('Authorization', auth).send({ userId: me, currency: 'USD', amount: 50, note: 'goodwill' });
    expect(res.status).toBe(403);
  });

  it('splitting a large credit into small ones goes to a second approver once the daily total is reached', async () => {
    const auth = staff('staff-fin-2', ['FINANCE']);
    // Earlier today this customer already received 90 USD under single control.
    db.auditLog.findMany.mockResolvedValue([{ userId: 'staff-fin-2', entityId: '7b1e6f2a-4c1d-4e8a-9a1b-1a2b3c4d5e6f', newValues: { amount: '90', currency: 'USD', approvalRequestId: null } }]);
    db.approvalRequest.create.mockResolvedValue({ id: 'apr-split' });
    const res = await request(app).post('/api/admin/manual-credit').set('Authorization', auth).send({ userId: '7b1e6f2a-4c1d-4e8a-9a1b-1a2b3c4d5e6f', currency: 'USD', amount: 60, note: 'goodwill credit part 2' });
    expect(res.status).toBe(202);
    expect(res.body.pendingApproval).toBe(true);
    expect(db.wallet.upsert).not.toHaveBeenCalled();
  });

  it('a legacy rate override in production becomes a maker-checker request (was a direct, open-ended override)', async () => {
    process.env.NODE_ENV = 'production';
    const auth = staff('staff-tre-1', ['TREASURY']);
    db.approvalRequest.create.mockResolvedValue({ id: 'apr-fx' });
    const res = await request(app).put('/api/admin/rates/EUR/USD').set('Authorization', auth).send({ buyPrice: 1.02, sellPrice: 1.01, reason: 'cheap euros for a friend' });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ pendingApproval: true, approvalId: 'apr-fx' });
    expect(db.exchangeRate.upsert).not.toHaveBeenCalled();
    expect(db.approvalRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'FX_OVERRIDE' }) }));
  });

  it('masks customer contact details for staff without customers.pii and drops contact matching from search', async () => {
    const auth = staff('staff-exec-1', ['EXECUTIVE']);
    db.user.findMany.mockResolvedValue([{ id: 'c1', email: 'alice@example.com', phone: '+218912345678', firstName: 'Alice', lastName: 'A', status: 'ACTIVE', kycStatus: 'APPROVED', wallets: [] }]);
    const res = await request(app).get('/api/admin/users').query({ search: '+21891' }).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.users[0]).toMatchObject({ email: 'al***@example.com', phone: '+218****78', firstName: 'Alice' });
    const where = db.user.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toMatch(/email|phone/);
  });

  it('shows contact details to staff holding customers.pii', async () => {
    const auth = staff('staff-sup-1', ['SUPPORT']);
    db.user.findMany.mockResolvedValue([{ id: 'c1', email: 'alice@example.com', phone: '+218912345678' }]);
    const res = await request(app).get('/api/admin/users').set('Authorization', auth);
    expect(res.body.users[0].email).toBe('alice@example.com');
  });
});

describe('maker-checker beneficiaries', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../services/ledger/adjustments.service');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decideApproval, requestApproval } = require('../services/platform/approvals.service');

  it('an approver cannot approve a credit to their own account requested by a colleague', async () => {
    db.approvalRequest.findUnique.mockResolvedValue({ id: 'apr-1', type: 'LEDGER_ADJUSTMENT', status: 'PENDING', requestedById: 'staff-a', payload: { userId: 'staff-b', currency: 'USD', amount: '5000', direction: 'CREDIT' }, subjectType: 'USER', subjectId: 'staff-b', expiresAt: new Date(Date.now() + 3600_000), reason: 'x' });
    await expect(decideApproval({ id: 'apr-1', approve: true, deciderId: 'staff-b', permissions: new Set(['adjustments.approve']) })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.approvalRequest.updateMany).not.toHaveBeenCalled();
  });

  it('nobody can request a credit to themselves', async () => {
    await expect(requestApproval({ type: 'LEDGER_ADJUSTMENT', payload: { userId: 'staff-a', currency: 'USD', amount: '5000', direction: 'CREDIT' }, reason: 'bonus for me please', requestedById: 'staff-a', permissions: new Set(['adjustments.request']) })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('assertNotSelf passes for colleagues', () => {
    expect(() => assertNotSelf('a', ['b', null], 'x')).not.toThrow();
    expect(() => assertNotSelf('a', ['a'], 'x')).toThrow(/segregation of duties/);
  });
});

describe('PII masking', () => {
  it('masks nested contact fields without touching the input or the staff member’s own record', () => {
    const input = { me: { id: 'staff-1', email: 'staff@tazdan.com' }, items: [{ user: { id: 'c', email: 'bob@example.com', phone: '+447700900123', dateOfBirth: '1990-01-01' }, beneficiary: { iban: 'GB33BUKB20201555555555', accountNumber: '12345678' }, documentUrl: '/uploads/x.jpg' }] };
    const out: any = maskPii(input, 'staff-1');
    expect(out.me.email).toBe('staff@tazdan.com');
    expect(out.items[0].user).toMatchObject({ email: 'bo***@example.com', phone: '+447****23', dateOfBirth: null });
    expect(out.items[0].beneficiary).toEqual({ iban: '••••5555', accountNumber: '••••5678' });
    expect(out.items[0].documentUrl).toBeNull();
    expect(input.items[0].user.email).toBe('bob@example.com');
  });
});

// ── Uploads ────────────────────────────────────────────────────────────
describe('uploads', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-up-'));
  const file = (name: string, bytes: Buffer, mimetype: string) => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, bytes);
    return { path: p, mimetype, size: bytes.length } as Express.Multer.File;
  };

  it('rejects and deletes an HTML file declared as a PNG', async () => {
    const f = file('fake.png', Buffer.from('<html><script>alert(document.domain)</script></html>'), 'image/png');
    const next = jest.fn();
    await verifyUploads({ file: f } as any, {} as any, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(fs.existsSync(f.path)).toBe(false);
    expect(matchesMagic('image/png', Buffer.from('<svg onload=alert(1)>'))).toBe(false);
  });

  const segment = (marker: number, payload: Buffer) => {
    const h = Buffer.alloc(4); h.writeUInt16BE(0xff00 | marker, 0); h.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([h, payload]);
  };
  const exif = (orientation: number) => {
    // Little-endian TIFF: IFD0 with Orientation and a GPS IFD pointer, then a fake GPS blob.
    const t = Buffer.alloc(8 + 2 + 24 + 4 + 16);
    t.write('II', 0, 'latin1'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4); t.writeUInt16LE(2, 8);
    t.writeUInt16LE(0x0112, 10); t.writeUInt16LE(3, 12); t.writeUInt32LE(1, 14); t.writeUInt16LE(orientation, 18);
    t.writeUInt16LE(0x8825, 22); t.writeUInt16LE(4, 24); t.writeUInt32LE(1, 26); t.writeUInt32LE(38, 30);
    t.write('GPS32.8872N13.18', 38, 'latin1');
    return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
  };

  it('removes EXIF/GPS from a JPEG, keeps its orientation and image data', () => {
    const scan = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0xff, 0xd9]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), segment(0xe0, Buffer.from('JFIF\0\x01\x01', 'latin1')), segment(0xe1, exif(6)), segment(0xfe, Buffer.from('shot at home')), scan]);
    const out = stripJpegMetadata(jpeg);
    expect(out.includes(Buffer.from('GPS32.8872N'))).toBe(false);
    expect(out.includes(Buffer.from('shot at home'))).toBe(false);
    expect(out.subarray(out.length - scan.length).equals(scan)).toBe(true);
    const app1 = out.indexOf(Buffer.from('Exif\0\0', 'latin1'));
    expect(app1).toBeGreaterThan(0);
    expect(out.readUInt16BE(app1 + 6 + 18)).toBe(6); // orientation survives (big-endian TIFF)
    expect(out[2]).toBe(0xff); expect(out[3]).toBe(0xe0); // JFIF stays first
  });

  it('removes text/EXIF chunks from PNG and EXIF/XMP from WebP', () => {
    const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); return Buffer.concat([l, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]); };
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('GPS\0Tripoli')), chunk('IDAT', Buffer.alloc(4)), chunk('IEND', Buffer.alloc(0))]);
    expect(stripPngMetadata(png).includes(Buffer.from('Tripoli'))).toBe(false);
    const wchunk = (fourcc: string, data: Buffer) => { const s = Buffer.alloc(4); s.writeUInt32LE(data.length); return Buffer.concat([Buffer.from(fourcc, 'latin1'), s, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]); };
    const vp8x = Buffer.alloc(10); vp8x[0] = 0x08 | 0x04;
    const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), wchunk('VP8X', vp8x), wchunk('VP8 ', Buffer.alloc(10)), wchunk('EXIF', Buffer.from('GPS Tripoli')), wchunk('XMP ', Buffer.from('<x:xmpmeta/>'))]);
    const riff = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), body]); riff.writeUInt32LE(body.length, 4);
    const out = stripWebpMetadata(riff);
    expect(out.includes(Buffer.from('Tripoli'))).toBe(false);
    expect(out.includes(Buffer.from('xmpmeta'))).toBe(false);
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out[20] & 0x0c).toBe(0);
  });

  it('deletes the files of a request that ends in an error', async () => {
    const f = file('orphan.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg');
    const app = express();
    app.post('/up', discardUploadsOnFailure, (req: any, res) => { req.file = f; res.status(400).json({ error: 'Verify your identity first' }); });
    await request(app).post('/up');
    await new Promise((r) => setTimeout(r, 30));
    expect(fs.existsSync(f.path)).toBe(false);
  });
});

// ── Waitlist ───────────────────────────────────────────────────────────
describe('waitlist', () => {
  it('sends the confirmation once, not on every repeated signup (mail-bombing)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { waitlistRouter } = require('../routes/waitlist');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sendWaitlistConfirmation } = require('../services/email');
    const app = express(); app.use(express.json()); app.use('/w', waitlistRouter);
    db.waitlistEntry.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'w1' });
    for (let i = 0; i < 3; i++) expect((await request(app).post('/w').send({ email: 'victim@example.com' })).status).toBe(200);
    expect(sendWaitlistConfirmation).toHaveBeenCalledTimes(1);
  });
});

// ── Outbound SSRF ──────────────────────────────────────────────────────
describe('business webhook SSRF guard', () => {
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '198.18.0.1', '::1', '::ffff:7f00:1', '::ffff:127.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', 'fd00::1', 'fe80::1', '2001:0:4136:e378::1'])('treats %s as internal', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('treats %s as public', (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it('refuses internal webhook URLs in production, including bracketed IPv4-mapped IPv6', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validateEndpointUrl('https://[::ffff:127.0.0.1]/hook')).toThrow();
    expect(() => validateEndpointUrl('https://intranet/hook')).toThrow();
    expect(() => validateEndpointUrl('https://hooks.example.com/tazdan')).not.toThrow();
  });

  it('the connection lookup blocks names that resolve to internal addresses (DNS rebinding)', (done) => {
    publicOnlyLookup('localhost', {}, (err: any) => { expect(err?.code).toBe('EBLOCKED'); done(); });
  });
});

// ── Request parsing, errors, exports ───────────────────────────────────
describe('request parsing and error paths', () => {
  it('query values are flat strings: no operator objects, no arrays, no prototype keys', () => {
    const q = parseQueryString('status[not]=CLOSED&type=a&type=b&__proto__=1&constructor=1&a[__proto__][x]=1');
    // Bracket syntax is just a literal key now; nothing is nested, merged or inherited.
    expect(q).toEqual({ 'status[not]': 'CLOSED', type: 'b', 'a[__proto__][x]': '1' });
    expect(Object.getPrototypeOf(q)).toBe(Object.prototype);
    expect(({} as any).x).toBeUndefined();
  });

  it('JSON bodies cannot carry __proto__ / constructor.prototype gadgets', () => {
    const parsed = JSON.parse('{"__proto__":{"isAdmin":true},"a":{"constructor":{"prototype":{"x":1}}},"b":1}', jsonReviver);
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    expect(parsed.a.constructor).toBe(Object);
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it('malformed or oversized bodies and refused origins are 4xx, not 500', async () => {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.post('/x', (_req, res) => res.json({ ok: true }));
    app.get('/cors', (_req, _res, next) => next(Object.assign(new Error('CORS: origin not allowed'), { status: 403, expose: true })));
    app.use(errorHandler);
    expect((await request(app).post('/x').set('Content-Type', 'application/json').send('{"a":')).status).toBe(400);
    expect((await request(app).post('/x').set('Content-Type', 'application/json').send(JSON.stringify({ a: 'x'.repeat(5000) }))).status).toBe(413);
    expect((await request(app).get('/cors')).status).toBe(403);
    expect(clientTransportError({ name: 'MulterError', code: 'LIMIT_FILE_SIZE' })).toEqual({ status: 413, message: 'File is too large' });
  });

  it('CSV cells cannot start a spreadsheet formula, numbers stay numbers', () => {
    expect(csvCell('=HYPERLINK("https://evil.example","x")')).toBe('"\'=HYPERLINK(""https://evil.example"",""x"")"');
    expect(csvCell('-5.00')).toBe('"-5.00"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });
});
