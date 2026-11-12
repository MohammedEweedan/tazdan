/**
 * Cockpit: product availability — hide or lock features, currencies and
 * pairs for everyone or chosen customers, and preview what one customer sees.
 */
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../types';
import { listAvailability, setAvailabilityRule } from '../../services/platform/availability.service';
import { clientFeatures } from '../../services/platform/clientFeatures';

const STATE = z.enum(['AVAILABLE', 'LOCKED', 'HIDDEN']);

export const CockpitAvailabilityController = {
  async list(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await listAvailability()); } catch (e) { next(e); }
  },

  async set(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        kind: z.enum(['FEATURE', 'CURRENCY', 'PAIR']),
        key: z.string().trim().min(1).max(40),
        state: STATE,
        allowUserIds: z.array(z.string().min(1).max(64)).max(500).optional(),
        denyUserIds: z.array(z.string().min(1).max(64)).max(500).optional(),
        denyState: STATE.optional(),
        includeStaff: z.boolean().optional(),
        message: z.string().max(140).optional().nullable(),
        expiresAt: z.coerce.date().optional().nullable(),
        reason: z.string().trim().min(5).max(1000),
      }).parse(req.body);
      const result = await setAvailabilityRule({ ...body, actorId: req.user!.id, req });
      res.json(result);
    } catch (e) { next(e); }
  },

  /** What one customer's app shows right now. */
  async preview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { id: true, firstName: true, lastName: true, username: true, role: true, status: true },
      });
      if (!user) throw new AppError('Customer not found', 404);
      res.json({ user, ...(await clientFeatures({ id: user.id, isStaff: user.role === 'ADMIN' })) });
    } catch (e) { next(e); }
  },
};
