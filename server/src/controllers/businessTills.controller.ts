/**
 * /api/business/tills — checkout points, their QR, kiosk feed and metrics.
 */
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../types';
import { assertCan, resolveBusiness } from '../services/business/access';
import { createTill, listTills, tillCode, tillPayments, updateTill } from '../services/business/tills.service';

const ctxOf = async (req: AuthRequest) => {
  const ctx = await resolveBusiness(req.user!.id);
  assertCan(ctx, 'tills.view');
  return ctx;
};

export const BusinessTillsController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await listTills(await ctxOf(req))); } catch (e) { next(e); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = z.object({ name: z.string().trim().min(1).max(40) }).parse(req.body);
      res.status(201).json({ till: await createTill(await ctxOf(req), name) });
    } catch (e) { next(e); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ name: z.string().trim().min(1).max(40).optional(), active: z.boolean().optional() }).parse(req.body);
      res.json({ till: await updateTill(await ctxOf(req), req.params.id, body) });
    } catch (e) { next(e); }
  },
  async payments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = z.object({ since: z.coerce.date().optional(), limit: z.coerce.number().int().optional() }).parse(req.query);
      res.setHeader('Cache-Control', 'no-store');
      res.json(await tillPayments(await ctxOf(req), req.params.id, q));
    } catch (e) { next(e); }
  },
  async code(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = z.object({ amount: z.string().max(24).optional(), currency: z.string().min(3).max(5).optional() }).parse(req.query);
      res.json(await tillCode(await ctxOf(req), req.params.id, q.amount, q.currency));
    } catch (e) { next(e); }
  },
};
