/**
 * Shared guards for inbound provider webhooks, mounted on the route before
 * the handler so every provider gets the same rules:
 *  - refuse (503) in production when the provider secret is not configured;
 *  - compare secrets and signatures in constant time (length-checked first,
 *    so a malformed header is a 401, not a crash);
 *  - verify signatures over the exact raw bytes received;
 *  - refuse replays of an already-accepted signed body.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { recordSecurityEvent } from '../services/platform/securityEvents';
import { getRedisClient } from '../utils/redis';

const isProd = () => process.env.NODE_ENV === 'production';

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function reject(req: Request, res: Response, status: 401 | 403 | 409 | 503, reason: string): void {
  void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: status === 503 ? 'MEDIUM' : 'HIGH', ipAddress: req.ip, path: req.originalUrl, details: { reason } });
  res.status(status).json({ error: status === 503 ? 'Webhook not configured' : status === 409 ? 'Duplicate webhook' : 'Unauthorized' });
}

function rawBodyOf(req: Request): Buffer | null {
  if (Buffer.isBuffer(req.body)) return req.body;
  const raw = (req as Request & { rawBody?: string }).rawBody;
  return typeof raw === 'string' ? Buffer.from(raw, 'utf8') : null;
}

/** A static shared key in a header (TronGrid style). */
export function requireHeaderSecret(envVar: string, header: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[envVar];
    if (!secret) return isProd() ? reject(req, res, 503, `${envVar}_unset`) : next();
    const provided = req.headers[header.toLowerCase()];
    if (typeof provided !== 'string' || !safeEqual(provided, secret)) return reject(req, res, 401, `bad_${header.toLowerCase()}`);
    next();
  };
}

/** Hex HMAC-SHA256 of the raw body in a header (Alchemy style). */
export function requireHmacSignature(envVar: string, header: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[envVar];
    if (!secret) return isProd() ? reject(req, res, 503, `${envVar}_unset`) : next();
    const raw = rawBodyOf(req);
    const sig = req.headers[header.toLowerCase()];
    if (!raw || typeof sig !== 'string') return reject(req, res, 401, 'missing_signature');
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!safeEqual(sig.trim().toLowerCase(), expected)) return reject(req, res, 401, 'bad_signature');
    next();
  };
}

// ── Replay protection ─────────────────────────────────────────────────
const seen = new Map<string, number>();
const REPLAY_TTL_SEC = () => Number(process.env.WEBHOOK_REPLAY_WINDOW_SEC ?? 24 * 3600);

/** True the first time a key is presented within the window (Redis when available). */
export async function firstSighting(key: string): Promise<boolean> {
  const ttl = REPLAY_TTL_SEC();
  const redis = getRedisClient();
  if (redis) {
    try {
      return (await redis.set(`webhook:seen:${key}`, '1', { NX: true, EX: ttl })) === 'OK';
    } catch { /* fall through to the in-process window */ }
  }
  const now = Date.now();
  if (seen.size > 50_000) for (const [k, exp] of seen) if (exp < now) seen.delete(k);
  const exp = seen.get(key);
  if (exp && exp > now) return false;
  seen.set(key, now + ttl * 1000);
  return true;
}

/** Event time carried in a provider payload, if any (ISO string or unix seconds/ms). */
function eventTime(body: any): number | null {
  const candidates = [body?.timestamp, body?.created_at, body?.createdAt, body?.data?.timestamp, body?.data?.created_at, body?.data?.createdAt];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = typeof c === 'number' ? (c < 1e12 ? c * 1000 : c) : Date.parse(String(c));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Fulus rate webhook: signature (HMAC over the raw body), freshness when the
 * payload carries an event time, and no replays. Fulus does not sign a
 * timestamp, so a captured signed body could otherwise be replayed later to
 * pin an old LYD rate (the cache accepts any positive rate as fresh).
 */
export function fulusWebhookGuard(verify: (sig: string | undefined, raw: string) => boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!process.env.FULUS_WEBHOOK_SECRET) return reject(req, res, isProd() ? 503 : 401, 'fulus_secret_unset');
      const raw = (req as Request & { rawBody?: string }).rawBody;
      const sig = req.headers['x-webhook-signature'];
      if (typeof raw !== 'string' || !verify(typeof sig === 'string' ? sig : undefined, raw)) return reject(req, res, 401, 'bad_fulus_signature');
      const at = eventTime(req.body);
      const maxAgeMs = Number(process.env.FULUS_WEBHOOK_MAX_AGE_SEC ?? 900) * 1000;
      if (at !== null && (Date.now() - at > maxAgeMs || at - Date.now() > 5 * 60_000)) return reject(req, res, 401, 'stale_fulus_event');
      const digest = crypto.createHash('sha256').update(raw).digest('hex');
      const key = `fulus:${digest}`;
      if (!(await firstSighting(key))) {
        void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: 'MEDIUM', ipAddress: req.ip, path: req.originalUrl, details: { reason: 'fulus_replay' } });
        // 200 so a genuine provider retry is not retried forever; nothing is applied.
        return res.status(200).json({ ok: true, duplicate: true });
      }
      // If our own handler fails, let the provider's retry through.
      res.on('finish', () => { if (res.statusCode >= 500) void forget(key); });
      next();
    } catch (err) { next(err); }
  };
}

async function forget(key: string): Promise<void> {
  seen.delete(key);
  await getRedisClient()?.del(`webhook:seen:${key}`).catch(() => undefined);
}
