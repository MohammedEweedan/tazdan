import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types';
import * as Lydt from '../services/lydt/lydt.service';

const keyOf = (req: Request) => {
  const raw = (req.body?.idempotencyKey ?? req.headers['idempotency-key']) as unknown;
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 120) : null;
};

/** LYDT sandbox endpoints (services/lydt). */
export const LydtController = {
  /** GET /api/lydt/reserves — public transparency report. */
  async reserves(_req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.json({ reserves: await Lydt.reserveReport() });
    } catch (e) { next(e); }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ lydt: await Lydt.myLydt(req.user!.id) }); } catch (e) { next(e); }
  },

  async issue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ operation: await Lydt.issue(req.user!.id, req.body?.amount, keyOf(req)) }); } catch (e) { next(e); }
  },

  async redeem(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ operation: await Lydt.redeem(req.user!.id, req.body?.amount, keyOf(req)) }); } catch (e) { next(e); }
  },

  async transfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        receiverId: z.string().min(1).max(64),
        amount: z.union([z.number(), z.string()]),
        note: z.string().max(500).optional(),
        stepUpCode: z.string().regex(/^\d{6}$/).optional(),
        biometricVerified: z.boolean().optional(),
      }).parse(req.body);
      res.json({
        operation: await Lydt.transfer({
          senderId: req.user!.id, receiverId: body.receiverId, amount: body.amount, note: body.note, key: keyOf(req),
          req, stepUpCode: body.stepUpCode, biometricVerified: body.biometricVerified,
        }),
      });
    } catch (e) { next(e); }
  },

  // ── Supervisor (cockpit) ──
  async supervisor(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { prisma } = await import('../utils/prisma');
      const [reserves, attestations, frozen] = await Promise.all([
        Lydt.reserveReport(),
        prisma.lydtAttestation.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.lydtFreeze.findMany({ orderBy: { createdAt: 'desc' } }),
      ]);
      res.json({ reserves, attestations, frozen });
    } catch (e) { next(e); }
  },

  async attest(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json({ attestation: await Lydt.recordAttestation(req.user!.id, req.body ?? {}) }); } catch (e) { next(e); }
  },

  async freeze(req: AuthRequest, res: Response, next: NextFunction) {
    try { await Lydt.freeze(req.user!.id, req.params.userId, req.body?.reason); res.json({ frozen: true }); } catch (e) { next(e); }
  },

  async unfreeze(req: AuthRequest, res: Response, next: NextFunction) {
    try { await Lydt.unfreeze(req.user!.id, req.params.userId, req.body?.reason); res.json({ frozen: false }); } catch (e) { next(e); }
  },
};
