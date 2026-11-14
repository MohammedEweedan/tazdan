import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { assertFeatureAvailable } from '../services/platform/availability.service';
import { publicPosts } from '../services/business/storefront.service';
import { buildApplePass, readWalletPassToken } from '../services/business/payCode.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const payeeSelect = {
  id: true, username: true, firstName: true, lastName: true, avatarUrl: true,
  profilePublic: true, kycStatus: true, accountType: true,
  businessProfile: { select: { companyName: true, tradingName: true, logoUrl: true, kybStatus: true } },
} as const;

type PayeeRow = {
  id: string; username: string | null; firstName: string | null; lastName: string | null;
  avatarUrl: string | null; profilePublic: boolean; kycStatus: string; accountType: string;
  businessProfile: { companyName: string; tradingName: string | null; logoUrl: string | null; kybStatus: string } | null;
};

/**
 * What the payer sees before confirming. Merchant branding (trading name,
 * logo) only for a business whose KYB is approved — a self-declared trading
 * name on an unreviewed account would let anyone pose as a known shop.
 * Private personal profiles show first name + last initial and no photo.
 */
export function payeeView(u: PayeeRow) {
  const biz = u.accountType === 'BUSINESS' && u.businessProfile?.kybStatus === 'APPROVED' ? u.businessProfile : null;
  if (biz) {
    return {
      id: u.id,
      username: u.username,
      kind: 'MERCHANT' as const,
      name: biz.tradingName?.trim() || biz.companyName,
      avatarUrl: biz.logoUrl ?? u.avatarUrl ?? null,
      verified: true,
    };
  }
  const first = u.firstName?.trim() ?? '';
  const last = u.lastName?.trim() ?? '';
  const name = u.profilePublic
    ? `${first} ${last}`.trim()
    : [first, last ? `${last[0]}.` : ''].filter(Boolean).join(' ');
  return {
    id: u.id,
    username: u.username,
    kind: 'PERSON' as const,
    name: name || (u.username ? `@${u.username}` : ''),
    avatarUrl: u.profilePublic ? u.avatarUrl : null,
    verified: u.kycStatus === 'APPROVED',
  };
}

export class PayController {
  /**
   * GET /api/pay/payee/:ref — resolve a scanned code or typed @handle.
   * `ref` is a handle (any case, optional @) or a user id (receive QRs of
   * accounts without a handle carry the id). Unknown and unavailable
   * accounts get the same 404, so the status of an account is never shown.
   */
  static async payee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await assertFeatureAvailable(req.user!.id, 'pay');
      const ref = String(req.params.ref ?? '').trim().replace(/^@/, '');
      if (!ref || ref.length > 64) throw new AppError('Not found', 404);
      const user = await prisma.user.findFirst({
        where: {
          status: 'ACTIVE',
          ...(UUID_RE.test(ref) ? { id: ref } : { username: { equals: ref, mode: 'insensitive' as const } }),
        },
        select: payeeSelect,
      });
      if (!user) throw new AppError('Not found', 404);
      res.json({ payee: { ...payeeView(user), self: user.id === req.user!.id } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/pay/wallet/apple/:token — the business's Apple Wallet card.
   * Opened by Safari (no bearer token), so the signed, short-lived link is
   * the credential; see walletPassToken.
   */
  static async applePass(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = readWalletPassToken(String(req.params.token ?? ''));
      if (!businessId) throw new AppError('This link has expired. Open your payment QR again.', 410);
      const business = await prisma.businessProfile.findUnique({ where: { id: businessId } });
      if (!business) throw new AppError('Not found', 404);
      const pass = await buildApplePass(business);
      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', 'attachment; filename="tazdan-pay.pkpass"');
      res.setHeader('Cache-Control', 'no-store');
      res.send(pass);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/pay/recent — the last people and shops I paid, newest first. */
  /** GET /api/pay/payee/:ref/posts — the merchant's live posts (empty for people). */
  static async posts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ref = String(req.params.ref ?? '').trim();
      if (!ref || ref.length > 64) throw new AppError('Not found', 404);
      res.json(await publicPosts(ref));
    } catch (e) { next(e); }
  }

  static async recent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      // Bounded scan, de-duplicated here: Prisma's `distinct` would read
      // every transfer the customer ever sent.
      const rows = await prisma.transfer.findMany({
        where: { senderId: me, receiverId: { not: me } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { receiverId: true, createdAt: true },
      });
      const lastPaid = new Map<string, Date>();
      for (const r of rows) {
        if (!lastPaid.has(r.receiverId)) lastPaid.set(r.receiverId, r.createdAt);
        if (lastPaid.size >= 8) break;
      }
      const users = await prisma.user.findMany({
        where: { id: { in: [...lastPaid.keys()] }, status: 'ACTIVE' },
        select: payeeSelect,
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      const payees = [...lastPaid.entries()].flatMap(([id, at]) => {
        const u = byId.get(id);
        return u ? [{ ...payeeView(u), lastPaidAt: at }] : [];
      });
      res.json({ payees });
    } catch (error) {
      next(error);
    }
  }
}
