/**
 * /api/bank-feeds/:source — statement lines pushed by a bank, LyPay or
 * OnePay integration instead of a staff upload.
 *
 * Off unless BANK_FEED_SECRET_<SOURCE> is set (e.g. BANK_FEED_SECRET_LYPAY).
 * Every request is signed over the exact bytes sent:
 *   X-Tazdan-Timestamp: unix seconds (refused when more than 5 minutes off)
 *   X-Tazdan-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
 * Body: { "lines": [{ direction, amount, currency?, valueDate, railRef?, narration?,
 *   counterpartyName?, counterpartyAccount?, counterpartyBank? }] }
 * Re-sending the same body is safe: it answers with the earlier import.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { SOURCES, importStatement, type Source } from '../services/bankStatements/statements.service';
import { parseAmount, parseDate, type ParsedLine } from '../services/bankStatements/parse';

export const bankFeedRouter = Router();

const lineSchema = z.object({
  direction: z.enum(['CREDIT', 'DEBIT']),
  amount: z.union([z.string().max(40), z.number().positive()]),
  currency: z.string().trim().toUpperCase().max(8).optional(),
  valueDate: z.string().max(40),
  railRef: z.string().max(120).optional().nullable(),
  narration: z.string().max(500).optional().nullable(),
  counterpartyName: z.string().max(200).optional().nullable(),
  counterpartyAccount: z.string().max(64).optional().nullable(),
  counterpartyBank: z.string().max(120).optional().nullable(),
});
const bodySchema = z.object({ lines: z.array(lineSchema).min(1).max(2000), platformBankAccountId: z.string().max(64).optional().nullable() });

function verify(req: Request & { rawBody?: string }, secret: string) {
  const ts = Number(req.header('x-tazdan-timestamp'));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) throw new AppError('Stale or missing timestamp', 401, 'AUTHENTICATION');
  const given = String(req.header('x-tazdan-signature') ?? '').replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${req.rawBody ?? ''}`).digest('hex');
  const a = Buffer.from(given, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new AppError('Bad signature', 401, 'AUTHENTICATION');
}

bankFeedRouter.post('/:source', async (req: Request & { rawBody?: string }, res: Response, next: NextFunction) => {
  try {
    const source = req.params.source.toUpperCase() as Source;
    const secret = (SOURCES as readonly string[]).includes(source) ? process.env[`BANK_FEED_SECRET_${source}`] : undefined;
    if (!secret) throw new AppError('Not found', 404, 'NOT_FOUND');
    verify(req, secret);
    const body = bodySchema.parse(req.body);
    const lines: ParsedLine[] = body.lines.map((l, i) => {
      const amount = parseAmount(String(l.amount));
      const valueDate = parseDate(l.valueDate) ?? (Number.isFinite(Date.parse(l.valueDate)) ? new Date(l.valueDate) : null);
      if (!amount || amount.negative || Number(amount.value) <= 0) throw new AppError(`Line ${i + 1}: amount must be a positive number`, 400, 'VALIDATION');
      if (!valueDate) throw new AppError(`Line ${i + 1}: unreadable valueDate`, 400, 'VALIDATION');
      return {
        row: i + 1, direction: l.direction, amount: amount.value, currency: l.currency ?? 'LYD', valueDate,
        railRef: l.railRef ?? null, narration: l.narration ?? null, counterpartyName: l.counterpartyName ?? null,
        counterpartyAccount: l.counterpartyAccount ?? null, counterpartyBank: l.counterpartyBank ?? null, raw: {},
      };
    });
    try {
      const r = await importStatement({ source, platformBankAccountId: body.platformBankAccountId, content: Buffer.from(req.rawBody ?? ''), feedLines: lines, actorId: null });
      res.status(201).json({ importId: r.importId, newLines: r.newLines, duplicates: r.duplicates, suggested: r.suggested, strong: r.strong });
    } catch (e) {
      if (e instanceof AppError && e.code === 'DUPLICATE_REQUEST') { res.json({ duplicate: true, importId: (e.details as any)?.importId ?? null }); return; }
      throw e;
    }
  } catch (e) { next(e); }
});
