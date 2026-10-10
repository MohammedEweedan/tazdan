/**
 * Cockpit: AI assistant (OBSERVE), drafts (ASSIST) and the AI audit trail.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { aiStatus, ask, decideDraft, draftCaseSummary, draftSupportReply } from '../../services/ai/assistant.service';
import { toolsFor } from '../../services/ai/tools';
import { pageParams } from './helpers';

const actor = (req: AuthRequest) => ({ id: req.user!.id, permissions: [...req.staff!.permissions] as string[] });

export const CockpitAiController = {
  async status(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ ...aiStatus(), tools: toolsFor([...req.staff!.permissions]).map((t) => ({ name: t.definition.name, description: t.definition.description })) });
    } catch (e) { next(e); }
  },

  async ask(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        question: z.string().trim().min(3).max(2000),
        history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).max(20).default([]),
      }).parse(req.body);
      res.json(await ask(actor(req), body.question, body.history));
    } catch (e) { next(e); }
  },

  async caseSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await draftCaseSummary(actor(req), req.params.id)); } catch (e) { next(e); }
  },

  async supportDraft(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await draftSupportReply(actor(req), req.params.id)); } catch (e) { next(e); }
  },

  async decide(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ accept: z.boolean(), finalText: z.string().max(20_000).optional(), note: z.string().max(500).optional() }).parse(req.body);
      res.json({ interaction: await decideDraft(actor(req), req.params.id, body.accept, body.finalText, body.note) });
    } catch (e) { next(e); }
  },

  /** Every AI request and draft. Operators see their own; audit.read sees everyone's. */
  async interactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 100);
      const where: Prisma.AiInteractionWhereInput = {};
      if (!req.staff!.permissions.has('audit.read')) where.operatorId = req.user!.id;
      else if (req.query.operatorId) where.operatorId = String(req.query.operatorId);
      if (req.query.kind) where.kind = String(req.query.kind);
      if (req.query.approvalStatus) where.approvalStatus = String(req.query.approvalStatus);
      const [items, total] = await Promise.all([
        prisma.aiInteraction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.aiInteraction.count({ where }),
      ]);
      const ids = [...new Set(items.flatMap((i) => [i.operatorId, i.approvedById]).filter(Boolean) as string[])];
      const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
      res.json({ items, total, page, limit, people });
    } catch (e) { next(e); }
  },

  async interaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const row = await prisma.aiInteraction.findUnique({ where: { id: req.params.id } });
      if (!row) throw new AppError('Not found', 404);
      if (row.operatorId !== req.user!.id && !req.staff!.permissions.has('audit.read')) throw new AppError('Not found', 404);
      res.json({ interaction: row });
    } catch (e) { next(e); }
  },
};
