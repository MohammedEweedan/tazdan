/**
 * Cockpit: merchant posts (take-down / restore) and till plaque orders
 * (production and delivery).
 */
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { moderatePost, setPlaqueStatus } from '../../services/business/storefront.service';

const business = { select: { id: true, companyName: true, tradingName: true, userId: true } } as const;

export const CockpitStorefrontController = {
  async posts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const hidden = req.query.hidden === '1' ? true : req.query.hidden === '0' ? false : undefined;
      const items = await prisma.businessPost.findMany({
        where: hidden === undefined ? {} : { hiddenByStaff: hidden },
        orderBy: { createdAt: 'desc' }, take: 100, include: { business },
      });
      res.json({ items });
    } catch (e) { next(e); }
  },
  async moderate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ hidden: z.boolean(), reason: z.string().trim().min(5).max(500) }).parse(req.body);
      res.json({ post: await moderatePost(req.user!.id, req.params.id, body.hidden, body.reason, req) });
    } catch (e) { next(e); }
  },
  async plaqueOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
      const items = await prisma.plaqueOrder.findMany({
        where: status ? { status: status as any } : {},
        orderBy: { createdAt: 'desc' }, take: 100, include: { business },
      });
      res.json({ items });
    } catch (e) { next(e); }
  },
  async plaqueStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ status: z.enum(['REQUESTED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED']), note: z.string().trim().min(3).max(500) }).parse(req.body);
      res.json({ order: await setPlaqueStatus(req.user!.id, req.params.id, body.status, body.note, req) });
    } catch (e) { next(e); }
  },
};
