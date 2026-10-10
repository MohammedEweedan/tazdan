/**
 * Business webhooks: signed, retried event delivery to customer endpoints.
 *
 * Signature (Stripe-style, so customers can reuse familiar verification code):
 *   Tazdan-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 * Receivers should reject timestamps older than five minutes.
 *
 * Deliveries are rows (BusinessWebhookDelivery) claimed with a conditional
 * update, so two workers never send the same attempt. Failures back off
 * exponentially; after MAX_ATTEMPTS the delivery is DEAD and visible in the
 * cockpit. Endpoint URLs must be HTTPS and, in production, must not resolve to
 * private, loopback or link-local addresses (SSRF guard).
 */
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export const WEBHOOK_EVENTS = [
  'payout.completed', 'payout.failed', 'payout.cancelled',
  'batch.pending_approval', 'batch.compliance_review', 'batch.completed', 'batch.rejected',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_ATTEMPTS = 8;
const TIMEOUT_MS = 8000;
const isProd = () => process.env.NODE_ENV === 'production';

export function sign(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

/** Verify a signature header (exported for SDK docs and tests). */
export function verifySignature(secret: string, body: string, header: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(expected, 'hex'); const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

/** Static checks at registration time. */
export function validateEndpointUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError('Webhook URL is not a valid URL', 400); }
  const localDev = !isProd() && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !(localDev && url.protocol === 'http:')) throw new AppError('Webhook URL must use HTTPS', 400);
  if (url.username || url.password) throw new AppError('Webhook URL must not contain credentials', 400);
  if (isProd() && (net.isIP(url.hostname) ? isPrivateAddress(url.hostname) : url.hostname === 'localhost')) {
    throw new AppError('Webhook URL must be publicly reachable', 400);
  }
  return url;
}

/** Re-checked at send time: DNS can change after registration. */
async function assertPublicTarget(url: URL): Promise<void> {
  if (!isProd()) return;
  const addrs = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Webhook host resolves to a non-public address');
}

export async function createEndpoint(businessId: string, input: { url: string; events: string[] }) {
  validateEndpointUrl(input.url);
  const events = [...new Set(input.events)];
  if (!events.length) throw new AppError('Choose at least one event', 400);
  const unknown = events.filter((e) => e !== '*' && !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (unknown.length) throw new AppError(`Unknown event(s): ${unknown.join(', ')}`, 400);
  const count = await prisma.businessWebhookEndpoint.count({ where: { businessId, status: 'ACTIVE' } });
  if (count >= 10) throw new AppError('A business can have at most 10 active webhook endpoints', 400, 'LIMIT_EXCEEDED');
  const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
  return prisma.businessWebhookEndpoint.create({ data: { businessId, url: input.url, events, secret } });
}

/** Never return the signing secret after creation. */
export function publicEndpoint(e: { id: string; url: string; events: string[]; status: string; createdAt: Date; secret: string }, revealSecret = false) {
  return { id: e.id, url: e.url, events: e.events, status: e.status, createdAt: e.createdAt, secret: revealSecret ? e.secret : `whsec_…${e.secret.slice(-4)}` };
}

/** Queue an event for every active endpoint subscribed to it. Safe inside a transaction. */
export async function enqueueEvent(client: Prisma.TransactionClient | typeof prisma, businessId: string, event: WebhookEvent, data: Record<string, unknown>) {
  const endpoints = await client.businessWebhookEndpoint.findMany({ where: { businessId, status: 'ACTIVE' } });
  const targets = endpoints.filter((e) => e.events.includes('*') || e.events.includes(event));
  if (!targets.length) return 0;
  const payload = { id: `evt_${crypto.randomUUID()}`, type: event, created: new Date().toISOString(), data };
  await client.businessWebhookDelivery.createMany({ data: targets.map((e) => ({ endpointId: e.id, event, payload: payload as Prisma.InputJsonValue })) });
  return targets.length;
}

async function attempt(d: { id: string; attempts: number; event: string; payload: Prisma.JsonValue; endpoint: { url: string; secret: string; status: string } }) {
  if (d.endpoint.status !== 'ACTIVE') {
    await prisma.businessWebhookDelivery.update({ where: { id: d.id }, data: { status: 'DEAD', lastError: 'Endpoint disabled' } });
    return;
  }
  const body = JSON.stringify(d.payload);
  const attempts = d.attempts + 1;
  try {
    const url = validateEndpointUrl(d.endpoint.url);
    await assertPublicTarget(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST', redirect: 'manual', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'user-agent': 'Tazdan-Webhooks/1', 'tazdan-event': d.event, 'tazdan-delivery': d.id, 'tazdan-signature': sign(d.endpoint.secret, body) },
      body,
    }).finally(() => clearTimeout(timer));
    if (res.status >= 200 && res.status < 300) {
      await prisma.businessWebhookDelivery.update({ where: { id: d.id }, data: { status: 'DELIVERED', attempts, responseStatus: res.status, deliveredAt: new Date(), lastError: null } });
      return;
    }
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  } catch (err) {
    const dead = attempts >= MAX_ATTEMPTS;
    const backoffMin = Math.min(360, 2 ** attempts);
    await prisma.businessWebhookDelivery.update({
      where: { id: d.id },
      data: {
        status: dead ? 'DEAD' : 'FAILED', attempts, responseStatus: (err as any).status ?? null,
        lastError: String((err as Error).message).slice(0, 300), nextAttemptAt: new Date(Date.now() + backoffMin * 60_000),
      },
    });
  }
}

/** Send every due delivery once. Returns how many were attempted. */
export async function deliverDue(limit = 50): Promise<number> {
  const now = new Date();
  const due = await prisma.businessWebhookDelivery.findMany({
    where: { OR: [{ status: { in: ['PENDING', 'FAILED'] } }, { status: 'SENDING' }], nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: 'asc' }, take: limit,
    include: { endpoint: { select: { url: true, secret: true, status: true } } },
  });
  let sent = 0;
  for (const d of due) {
    // Claim: a SENDING row whose lease ran out is retried; anyone else racing loses.
    const claimed = await prisma.businessWebhookDelivery.updateMany({
      where: { id: d.id, status: d.status, attempts: d.attempts, nextAttemptAt: d.nextAttemptAt },
      data: { status: 'SENDING', nextAttemptAt: new Date(Date.now() + 5 * 60_000) },
    });
    if (claimed.count !== 1) continue;
    await attempt(d).catch((err) => logger.warn('[webhooks] delivery error', { id: d.id, err: (err as Error).message }));
    sent++;
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
export function startWebhookWorker(intervalMs = 15_000) {
  if (timer) return;
  timer = setInterval(() => { void deliverDue().catch((err) => logger.warn('[webhooks] worker tick failed', { err: (err as Error).message })); }, intervalMs);
  timer.unref?.();
}
