/**
 * Cockpit: LyPay, OnePay and bank statements matched to customers' deposit
 * and withdrawal requests, and AML/KYC requests exchanged with banks.
 */
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../types';
import { hasPermission } from '../../services/platform/rbac';
import { FIELDS } from '../../services/bankStatements/parse';
import {
  SOURCES, acceptMatch, acceptStrongDeposits, assignLineToCustomer, exceptions, importStatement, lineDetail, listImports, listLines,
  matchLines, openLineCase, previewStatement, setLineStatus,
} from '../../services/bankStatements/statements.service';
import {
  LEGAL_BASES, REQUEST_TYPES, bankRequestDetail, closeBankRequest, createBankRequest, listBankRequests, markSent, proposeDisclosure, recordBankAnswer,
} from '../../services/bankStatements/bankRequests.service';

const MAX_FILE_BYTES = 6 * 1024 * 1024;

const fileBody = z.object({
  source: z.enum(SOURCES),
  platformBankAccountId: z.string().max(64).optional().nullable(),
  fileName: z.string().max(200).optional().nullable(),
  contentBase64: z.string().min(1),
  defaultDirection: z.enum(['CREDIT', 'DEBIT']).optional().nullable(),
  currency: z.string().trim().toUpperCase().max(8).optional().nullable(),
  mapping: z.record(z.enum(FIELDS), z.string().max(120)).optional().nullable(),
});

function decodeFile(b64: string): Buffer {
  const buf = Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new AppError('The file is empty', 400);
  if (buf.length > MAX_FILE_BYTES) throw new AppError('The file is larger than 6 MB; split the statement by date', 400);
  return buf;
}

const parseOptions = (b: z.infer<typeof fileBody>) => ({
  defaultDirection: b.defaultDirection ?? undefined, currency: b.currency ?? undefined, mapping: b.mapping ?? undefined,
});

/** Parser messages explain the file problem; report them as 400s, not server errors. */
function asClientError(e: unknown): unknown {
  if (e instanceof AppError || (e as any)?.name === 'ZodError') return e;
  if (e instanceof Error && !(e as any).code) return new AppError(e.message, 400, 'VALIDATION');
  return e;
}

/** The raw statement row can hold account numbers under any header: PII staff only. */
function withoutRaw<T extends { raw?: unknown }>(req: AuthRequest, row: T): T {
  return hasPermission(req, 'customers.pii') ? row : { ...row, raw: undefined };
}

export const CockpitBankMatchingController = {
  async lines(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = z.object({
        status: z.string().max(20).optional(), direction: z.enum(['CREDIT', 'DEBIT']).optional(), source: z.string().max(20).optional(),
        q: z.string().max(100).optional(), flagged: z.enum(['1', 'true']).optional(),
        page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
      }).parse(req.query);
      res.json(await listLines({ ...q, status: q.status || undefined, flagged: Boolean(q.flagged) }));
    } catch (e) { next(e); }
  },

  async line(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(withoutRaw(req, await lineDetail(req.params.id))); } catch (e) { next(e); }
  },

  async exceptions(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await exceptions()); } catch (e) { next(e); }
  },

  async imports(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ imports: await listImports() }); } catch (e) { next(e); }
  },

  async preview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = fileBody.parse(req.body);
      try { res.json(previewStatement(decodeFile(b.contentBase64), parseOptions(b))); } catch (e) { throw asClientError(e); }
    } catch (e) { next(e); }
  },

  async import(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = fileBody.parse(req.body);
      const content = decodeFile(b.contentBase64);
      try {
        res.status(201).json(await importStatement({
          source: b.source, platformBankAccountId: b.platformBankAccountId, fileName: b.fileName, content, options: parseOptions(b), actorId: req.user!.id, req,
        }));
      } catch (e) { throw asClientError(e); }
    } catch (e) { next(e); }
  },

  async rematch(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await matchLines()); } catch (e) { next(e); }
  },

  async accept(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ candidateId: z.string().min(1).max(64), reason: z.string().max(1000).optional().nullable() }).parse(req.body);
      res.json(await acceptMatch({ lineId: req.params.id, candidateId: b.candidateId, reason: b.reason, staffId: req.user!.id, permissions: req.staff?.permissions, req }));
    } catch (e) { next(e); }
  },

  async acceptStrong(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await acceptStrongDeposits({ staffId: req.user!.id, permissions: req.staff?.permissions, req })); } catch (e) { next(e); }
  },

  async assign(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ userId: z.string().min(1).max(64), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
      res.json(await assignLineToCustomer({ lineId: req.params.id, userId: b.userId, reason: b.reason, staffId: req.user!.id, permissions: req.staff?.permissions, req }));
    } catch (e) { next(e); }
  },

  async setStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ status: z.enum(['HELD', 'IGNORED', 'UNMATCHED']), reason: z.string().trim().min(5).max(500) }).parse(req.body);
      res.json(await setLineStatus({ lineId: req.params.id, status: b.status, reason: b.reason, staffId: req.user!.id, req }));
    } catch (e) { next(e); }
  },

  async openCase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ reason: z.string().trim().min(10).max(2000), userId: z.string().max(64).optional().nullable() }).parse(req.body);
      res.status(201).json(await openLineCase({ lineId: req.params.id, reason: b.reason, userId: b.userId, staffId: req.user!.id }));
    } catch (e) { next(e); }
  },

  // ── Bank requests ──────────────────────────────────────────────────

  async requests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = z.object({
        status: z.string().max(20).optional(), direction: z.enum(['OUTBOUND', 'INBOUND']).optional(),
        page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
      }).parse(req.query);
      res.json(await listBankRequests({ ...q, status: q.status || undefined }));
    } catch (e) { next(e); }
  },

  async request(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await bankRequestDetail(req.params.id)); } catch (e) { next(e); }
  },

  async createRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({
        direction: z.enum(['OUTBOUND', 'INBOUND']), bankName: z.string().trim().min(2).max(120), bankContact: z.string().max(200).optional().nullable(),
        type: z.enum(REQUEST_TYPES), legalBasis: z.enum(LEGAL_BASES), question: z.string().trim().min(10).max(4000),
        subjectUserId: z.string().max(64).optional().nullable(), statementLineId: z.string().max(64).optional().nullable(), caseId: z.string().max(64).optional().nullable(),
        dueAt: z.coerce.date().optional().nullable(),
      }).parse(req.body);
      res.status(201).json(await createBankRequest({ ...b, staffId: req.user!.id, req }));
    } catch (e) { next(e); }
  },

  async markSent(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await markSent({ id: req.params.id, staffId: req.user!.id, req })); } catch (e) { next(e); }
  },

  /** Outbound: the bank's reply. Inbound: our proposed reply, sent after a second approval. */
  async answer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ answer: z.string().trim().min(3).max(4000), holderConfirmed: z.boolean().optional() }).parse(req.body);
      const r = await bankRequestDetail(req.params.id);
      if (r.direction === 'INBOUND') {
        res.json(await proposeDisclosure({ id: r.id, answer: b.answer, staffId: req.user!.id, permissions: req.staff?.permissions ?? new Set(), req }));
      } else {
        res.json(await recordBankAnswer({ id: r.id, answer: b.answer, holderConfirmed: b.holderConfirmed, staffId: req.user!.id, req }));
      }
    } catch (e) { next(e); }
  },

  async close(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = z.object({ note: z.string().trim().min(3).max(1000) }).parse(req.body);
      res.json(await closeBankRequest({ id: req.params.id, note: b.note, staffId: req.user!.id, req }));
    } catch (e) { next(e); }
  },
};
