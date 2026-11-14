/**
 * Business tills — checkout points with their own QR and kiosk.
 *
 * A till's QR is the business's permanent pay code plus `?till=<id>` (and an
 * optional amount for the kiosk). A payment made from it carries the till id
 * on the Transfer, so the business sees counts, totals, average ticket and
 * the last payment per till. Money still goes to the business owner's
 * account through the normal transfer path; the till is attribution only.
 */
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { assertCan, assertKybApproved, type BusinessContext } from './access';

const linkBase = () => (process.env.PAY_LINK_BASE || 'https://tazdan.com').replace(/\/+$/, '');
const MAX_TILLS = 50;
const DAY = 86_400_000;

type Totals = Record<string, { count: number; total: string; average: string }>;

function summarise(rows: Array<{ currency: string; amount: unknown }>): Totals {
  const out: Record<string, { count: number; sum: number }> = {};
  for (const r of rows) {
    const k = String(r.currency);
    out[k] ??= { count: 0, sum: 0 };
    out[k].count += 1;
    out[k].sum += Number(r.amount);
  }
  return Object.fromEntries(Object.entries(out).map(([c, v]) => [c, {
    count: v.count, total: v.sum.toFixed(3), average: (v.sum / v.count).toFixed(3),
  }]));
}

function startOfToday(): Date {
  // Business days follow Tripoli time, like KYC limits.
  const now = new Date();
  const tripoli = new Date(now.toLocaleString('en-US', { timeZone: process.env.LIMITS_TIMEZONE || 'Africa/Tripoli' }));
  const offset = now.getTime() - tripoli.getTime();
  tripoli.setHours(0, 0, 0, 0);
  return new Date(tripoli.getTime() + offset);
}

/** Every till of the business with today / 7-day / 30-day figures. */
export async function listTills(ctx: BusinessContext) {
  const tills = await prisma.businessTill.findMany({ where: { businessId: ctx.business.id }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
  if (!tills.length) return { tills: [] };
  const since30 = new Date(Date.now() - 30 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);
  const today = startOfToday();
  const payments = await prisma.transfer.findMany({
    where: { tillId: { in: tills.map((t) => t.id) }, receiverId: ctx.business.userId, createdAt: { gte: since30 } },
    select: { tillId: true, currency: true, amount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return {
    tills: tills.map((t) => {
      const mine = payments.filter((p) => p.tillId === t.id);
      return {
        id: t.id, name: t.name, active: t.active, createdAt: t.createdAt,
        lastPaymentAt: mine[0]?.createdAt ?? null,
        today: summarise(mine.filter((p) => p.createdAt >= today)),
        week: summarise(mine.filter((p) => p.createdAt >= since7)),
        month: summarise(mine),
      };
    }),
  };
}

async function ownTill(ctx: BusinessContext, id: string) {
  const till = await prisma.businessTill.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!till) throw new AppError('Till not found', 404);
  return till;
}

export async function createTill(ctx: BusinessContext, name: string) {
  assertCan(ctx, 'tills.manage');
  assertKybApproved(ctx.business, 'you can open tills');
  const count = await prisma.businessTill.count({ where: { businessId: ctx.business.id } });
  if (count >= MAX_TILLS) throw new AppError(`A business can have up to ${MAX_TILLS} tills`, 400);
  return prisma.$transaction(async (tx) => {
    const till = await tx.businessTill.create({ data: { businessId: ctx.business.id, name: name.trim(), createdById: ctx.userId } });
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_TILL_CREATED', entity: 'BusinessTill', entityId: till.id, after: { name: till.name } });
    return till;
  });
}

export async function updateTill(ctx: BusinessContext, id: string, changes: { name?: string; active?: boolean }) {
  assertCan(ctx, 'tills.manage');
  const before = await ownTill(ctx, id);
  return prisma.$transaction(async (tx) => {
    const till = await tx.businessTill.update({
      where: { id },
      data: { ...(changes.name !== undefined ? { name: changes.name.trim() } : {}), ...(changes.active !== undefined ? { active: changes.active } : {}) },
    });
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_TILL_UPDATED', entity: 'BusinessTill', entityId: id, before: { name: before.name, active: before.active }, after: { name: till.name, active: till.active } });
    return till;
  });
}

/** Payments at one till — the kiosk polls this with `since` to see a payment land. */
export async function tillPayments(ctx: BusinessContext, id: string, opts: { since?: Date; limit?: number }) {
  await ownTill(ctx, id);
  const rows = await prisma.transfer.findMany({
    where: { tillId: id, receiverId: ctx.business.userId, ...(opts.since ? { createdAt: { gt: opts.since } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(opts.limit ?? 25, 1), 100),
    select: { id: true, amount: true, currency: true, reference: true, note: true, createdAt: true, sender: { select: { firstName: true, lastName: true } } },
  });
  return {
    payments: rows.map((r) => ({
      id: r.id, amount: r.amount.toString(), currency: r.currency, reference: r.reference, note: r.note, createdAt: r.createdAt,
      // Payer shown as first name + last initial (the till screen is public-facing).
      payer: `${r.sender.firstName} ${(r.sender.lastName ?? '').slice(0, 1)}${r.sender.lastName ? '.' : ''}`.trim(),
    })),
  };
}

/** The till's QR link: the business's permanent code plus the till (and an optional amount). */
export async function tillCode(ctx: BusinessContext, id: string, amount?: string, currency?: string) {
  const till = await ownTill(ctx, id);
  if (!till.active) throw new AppError('This till is closed', 409);
  const params = new URLSearchParams({ till: till.id });
  if (amount && currency) {
    if (!/^\d+(\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) throw new AppError('Enter a valid amount', 400);
    params.set('amount', amount);
    params.set('currency', currency.toUpperCase());
  }
  return { url: `${linkBase()}/pay/${ctx.business.userId}?${params.toString()}`, till: { id: till.id, name: till.name } };
}

/** For the transfer path: the till must belong to the receiving business and be open. */
export async function assertTillForReceiver(tillId: string, receiverId: string): Promise<void> {
  const till = await prisma.businessTill.findUnique({ where: { id: tillId }, select: { active: true, business: { select: { userId: true } } } });
  if (!till || till.business.userId !== receiverId) throw new AppError('This till code does not belong to this business', 400);
  if (!till.active) throw new AppError('This till is closed. Ask the cashier for another code.', 409);
}
