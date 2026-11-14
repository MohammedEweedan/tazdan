/**
 * /api/business — kiosk PIN, posts (offers, deals, news) and plaque orders.
 * Public posts for customers live under /api/pay/payee/:ref/posts.
 */
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../types';
import { resolveBusiness } from '../services/business/access';
import {
  PLAQUE_LOCALES, PLAQUE_SIZES, cancelPlaqueOrder, createPost, deletePost, kioskPinStatus, listPlaqueOrders, listPosts,
  orderPlaques, setKioskPin, updatePost, uploadLogo, verifyKioskPin,
} from '../services/business/storefront.service';

const ctxOf = (req: AuthRequest) => resolveBusiness(req.user!.id);
const date = z.coerce.date().nullable().optional();
const postSchema = z.object({
  kind: z.enum(['OFFER', 'DEAL', 'NEWS']),
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(1).max(600),
  startsAt: date, endsAt: date,
  published: z.boolean().optional(),
});

export const BusinessStorefrontController = {
  /** POST /business/logo { data: base64 } — stored as public media. */
  async logo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { data } = z.object({ data: z.string().min(16).max(1_000_000) }).parse(req.body);
      const origin = process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get('host')}`;
      res.json(await uploadLogo(await ctxOf(req), data.replace(/^data:image\/[a-z]+;base64,/, ''), origin));
    } catch (e) { next(e); }
  },
  async pinStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await kioskPinStatus(await ctxOf(req))); } catch (e) { next(e); }
  },
  async setPin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pin } = z.object({ pin: z.string() }).parse(req.body);
      res.json(await setKioskPin(await ctxOf(req), pin));
    } catch (e) { next(e); }
  },
  async verifyPin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pin } = z.object({ pin: z.string().max(12) }).parse(req.body);
      res.json(await verifyKioskPin(await ctxOf(req), pin));
    } catch (e) { next(e); }
  },

  async posts(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ posts: await listPosts(await ctxOf(req)) }); } catch (e) { next(e); }
  },
  async createPost(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json({ post: await createPost(await ctxOf(req), postSchema.parse(req.body)) }); } catch (e) { next(e); }
  },
  async updatePost(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ post: await updatePost(await ctxOf(req), req.params.id, postSchema.partial().parse(req.body)) }); } catch (e) { next(e); }
  },
  async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
    try { await deletePost(await ctxOf(req), req.params.id); res.json({ deleted: true }); } catch (e) { next(e); }
  },

  async plaques(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ orders: await listPlaqueOrders(await ctxOf(req)) }); } catch (e) { next(e); }
  },
  async orderPlaques(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        tillId: z.string().uuid().nullable().optional(),
        quantity: z.number().int().min(1).max(20),
        size: z.enum(PLAQUE_SIZES),
        locale: z.enum(PLAQUE_LOCALES),
        shippingName: z.string().trim().min(2).max(120),
        shippingPhone: z.string().trim().min(6).max(30),
        shippingAddress: z.string().trim().min(5).max(300),
        shippingCity: z.string().trim().min(2).max(80),
        notes: z.string().trim().max(500).nullable().optional(),
      }).parse(req.body);
      res.status(201).json({ order: await orderPlaques(await ctxOf(req), body) });
    } catch (e) { next(e); }
  },
  async cancelPlaque(req: AuthRequest, res: Response, next: NextFunction) {
    try { await cancelPlaqueOrder(await ctxOf(req), req.params.id); res.json({ cancelled: true }); } catch (e) { next(e); }
  },
};
