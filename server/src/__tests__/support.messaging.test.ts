/**
 * Support messaging — socket fan-out of support / escalation messages.
 * Prisma is mocked (no Postgres needed); `io` records every emit so we can
 * assert exactly which user rooms receive which message.
 */
const SUPPORT = '00000000-0000-4000-8000-00000000a001';
const ME = '00000000-0000-4000-8000-00000000b001';
const PEER = '00000000-0000-4000-8000-00000000c001';
const ESC = '00000000-0000-4000-8000-00000000e001';

let seq = 0;
const row = (data: any) => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  isRead: false, readAt: null, editedAt: null, deletedAt: null, tradeId: null,
  metadata: null, createdAt: new Date('2026-10-11T10:00:00Z'), ...data,
});

const mockPrisma: any = {
  user: { findFirst: jest.fn(async () => ({ id: SUPPORT })) },
  supportEscalation: {
    create: jest.fn(async ({ data }: any) => ({ id: ESC, ...data })),
    updateMany: jest.fn(async () => ({ count: 1 })),
    findUniqueOrThrow: jest.fn(async () => ({ id: ESC, raisedById: ME, counterpartyId: PEER, tradeId: null })),
  },
  message: { create: jest.fn(async ({ data }: any) => row(data)) },
  whatsAppMessage: { findFirst: jest.fn(async () => null) },
  $transaction: jest.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
};
jest.mock('../utils/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../services/platform/audit', () => ({ writeAudit: jest.fn(async () => undefined) }));

import { MessageController } from '../controllers/message.controller';
import { AdminController } from '../controllers/admin.controller';

type Emit = { rooms: string[]; event: string; payload: any };
function harness(userId: string, body: any, params: any = {}) {
  const emits: Emit[] = [];
  const io = { to: (rooms: string | string[]) => ({ emit: (event: string, payload: any) => { emits.push({ rooms: ([] as string[]).concat(rooms), event, payload }); } }) };
  const req: any = { body, params, user: { id: userId, role: 'ADMIN' }, app: { get: (k: string) => (k === 'io' ? io : undefined) }, headers: {}, ip: '127.0.0.1' };
  const res: any = { statusCode: 200, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  return { req, res, emits, next: jest.fn() };
}
const roomsFor = (emits: Emit[], content: RegExp) =>
  emits.filter((e) => e.event === 'message:new' && content.test(e.payload.content)).flatMap((e) => e.rooms).sort();

beforeEach(() => { jest.clearAllMocks(); });

describe('support messaging fan-out', () => {
  it('escalate: each escalation notice reaches only its addressee and support', async () => {
    const h = harness(ME, { counterpartyId: PEER, reason: 'Payment not received' });
    await MessageController.escalate(h.req, h.res, h.next);
    expect(h.next).not.toHaveBeenCalled();
    expect(h.res.statusCode).toBe(201);
    // "…opened. A support agent will respond shortly." is addressed to the raiser.
    expect(roomsFor(h.emits, /respond shortly/)).toEqual([`user:${ME}`, `user:${SUPPORT}`].sort());
    // "…opened by your trade counterparty." is addressed to the counterparty.
    expect(roomsFor(h.emits, /counterparty/)).toEqual([`user:${PEER}`, `user:${SUPPORT}`].sort());
    // The opener stays in the raiser <-> support thread.
    expect(roomsFor(h.emits, /Payment not received/)).toEqual([`user:${ME}`, `user:${SUPPORT}`].sort());
  });

  it('sendAsSupport: emits the full wire shape to the customer and to support sessions', async () => {
    const h = harness('00000000-0000-4000-8000-00000000d001', { userId: ME, content: 'Your top-up is credited' });
    await AdminController.sendAsSupport(h.req, h.res, h.next);
    expect(h.next).not.toHaveBeenCalled();
    const e = h.emits.find((x) => x.event === 'message:new')!;
    expect(e.rooms.sort()).toEqual([`user:${ME}`, `user:${SUPPORT}`].sort());
    expect(e.payload).toEqual(expect.objectContaining({ senderId: SUPPORT, receiverId: ME, content: 'Your top-up is credited', readAt: null, editedAt: null, deletedAt: null, tradeId: null }));
  });

  it('resolveEscalation: pushes the resolution notice live to both parties', async () => {
    const h = harness('00000000-0000-4000-8000-00000000d001', { resolutionNote: 'Refunded' }, { id: ESC });
    await AdminController.resolveEscalation(h.req, h.res, h.next);
    expect(h.next).not.toHaveBeenCalled();
    const notices = h.emits.filter((x) => x.event === 'message:new');
    expect(notices).toHaveLength(2);
    expect(notices.map((n) => n.payload.receiverId).sort()).toEqual([ME, PEER].sort());
    for (const n of notices) {
      expect(n.rooms.sort()).toEqual([`user:${n.payload.receiverId}`, `user:${SUPPORT}`].sort());
      expect(n.payload).toEqual(expect.objectContaining({ senderId: SUPPORT, type: 'SYSTEM', content: expect.stringContaining('resolved by support: Refunded') }));
    }
  });
});
