/**
 * Contacts — the people a customer has exchanged money with (transfers, chat
 * payments, claimed payment links), and the full history with one of them.
 *
 * A contact's details are only returned to someone who has actually sent
 * money to or received money from them, and only public profile fields
 * (name, @handle, photo, verified, member since) — never email or phone.
 */
import type { NextFunction, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import type { AuthRequest } from '../types';

const publicUser = { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, kycStatus: true, createdAt: true, status: true } as const;
type PublicRow = { id: string; firstName: string; lastName: string; username: string | null; avatarUrl: string | null; kycStatus: string; createdAt: Date; status: string };

function present(u: PublicRow) {
  const closed = u.status === 'CLOSED';
  return {
    id: u.id,
    name: closed ? 'Closed account' : `${u.firstName} ${u.lastName}`.trim(),
    username: closed ? null : u.username,
    avatarUrl: closed ? null : u.avatarUrl,
    verified: u.kycStatus === 'APPROVED',
    memberSince: u.createdAt.toISOString(),
  };
}

export const ContactsController = {
  /** People the customer has exchanged money with, most recent first. */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const rows = await prisma.$queryRaw<Array<{ contactId: string; lastAt: Date; count: bigint }>>`
        SELECT "contactId", MAX("at") AS "lastAt", COUNT(*) AS count FROM (
          SELECT CASE WHEN "senderId" = ${me} THEN "receiverId" ELSE "senderId" END AS "contactId", "createdAt" AS "at"
          FROM "Transfer" WHERE ("senderId" = ${me} OR "receiverId" = ${me}) AND "senderId" <> "receiverId"
          UNION ALL
          SELECT CASE WHEN "senderId" = ${me} THEN "claimedById" ELSE "senderId" END, COALESCE("claimedAt", "createdAt")
          FROM "ClaimLink" WHERE "status" = 'CLAIMED' AND "claimedById" IS NOT NULL
            AND ("senderId" = ${me} OR "claimedById" = ${me}) AND "senderId" <> "claimedById"
        ) x GROUP BY "contactId" ORDER BY MAX("at") DESC LIMIT 30
      `;
      const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.contactId) } }, select: publicUser });
      const byId = new Map(users.map((u) => [u.id, u]));
      res.json({
        contacts: rows.filter((r) => byId.has(r.contactId)).map((r) => ({
          ...present(byId.get(r.contactId)!),
          lastAt: new Date(r.lastAt).toISOString(),
          count: Number(r.count),
        })),
      });
    } catch (e) { next(e); }
  },

  /** One contact: their public details and every payment between you. */
  async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const other = req.params.id;
      const [transfers, links] = await Promise.all([
        prisma.transfer.findMany({
          where: { OR: [{ senderId: me, receiverId: other }, { senderId: other, receiverId: me }] },
          orderBy: { createdAt: 'desc' }, take: 500,
          select: { id: true, senderId: true, amount: true, currency: true, note: true, reference: true, createdAt: true, message: { select: { id: true } } },
        }),
        prisma.claimLink.findMany({
          where: { status: 'CLAIMED', OR: [{ senderId: me, claimedById: other }, { senderId: other, claimedById: me }] },
          orderBy: { claimedAt: 'desc' }, take: 200,
          select: { id: true, senderId: true, amount: true, asset: true, note: true, claimedAt: true, createdAt: true },
        }),
      ]);
      if (!transfers.length && !links.length) throw new AppError('Contact not found', 404);
      const user = await prisma.user.findUnique({ where: { id: other }, select: publicUser });
      if (!user) throw new AppError('Contact not found', 404);

      const items = [
        ...transfers.map((t) => ({
          id: t.id, direction: t.senderId === me ? 'SENT' as const : 'RECEIVED' as const,
          amount: t.amount.toString(), currency: t.currency as string, note: t.note, reference: t.reference,
          via: t.message ? 'chat' as const : 'transfer' as const, createdAt: t.createdAt.toISOString(),
        })),
        ...links.map((l) => ({
          id: l.id, direction: l.senderId === me ? 'SENT' as const : 'RECEIVED' as const,
          amount: l.amount.toString(), currency: l.asset as string, note: l.note, reference: null,
          via: 'link' as const, createdAt: (l.claimedAt ?? l.createdAt).toISOString(),
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const totals = new Map<string, { currency: string; sent: number; received: number }>();
      for (const i of items) {
        const t = totals.get(i.currency) ?? { currency: i.currency, sent: 0, received: 0 };
        if (i.direction === 'SENT') t.sent += Number(i.amount); else t.received += Number(i.amount);
        totals.set(i.currency, t);
      }
      res.json({
        contact: present(user),
        summary: {
          count: items.length,
          firstAt: items[items.length - 1]?.createdAt ?? null,
          lastAt: items[0]?.createdAt ?? null,
          byCurrency: [...totals.values()].map((t) => ({ ...t, sent: String(t.sent), received: String(t.received) })),
        },
        items,
      });
    } catch (e) { next(e); }
  },
};
