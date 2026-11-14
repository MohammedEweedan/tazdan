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
import dns from 'dns';
import http from 'http';
import https from 'https';
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

function v4Private(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)          // carrier-grade NAT
    || (a === 169 && b === 254)                    // link-local / cloud metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19))       // benchmarking
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

/** Expand an IPv6 address to eight 16-bit groups (handles :: and a dotted IPv4 tail). */
function v6Groups(ip: string): number[] | null {
  let v = ip.toLowerCase().split('%')[0];
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    v = v.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = v.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const groups = [...h, ...Array(Math.max(0, fill)).fill('0'), ...t].map((g) => parseInt(g || '0', 16));
  return groups.length === 8 && groups.every((g) => Number.isFinite(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return v4Private(ip);
  if (!net.isIPv6(ip)) return true; // not an IP literal: never "public"
  const g = v6Groups(ip);
  if (!g) return true;
  const embedded = (hi: number, lo: number) => v4Private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return true; // :: and ::1
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return embedded(g[6], g[7]); // v4-mapped / v4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b) return embedded(g[6], g[7]);  // NAT64
  if (g[0] === 0x2002) return embedded(g[1], g[2]);                   // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true;                     // Teredo
  return (g[0] & 0xfe00) === 0xfc00   // unique local fc00::/7
    || (g[0] & 0xffc0) === 0xfe80     // link-local
    || (g[0] & 0xffc0) === 0xfec0     // site-local
    || (g[0] & 0xff00) === 0xff00;    // multicast
}

/** Static checks at registration time. */
export function validateEndpointUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError('Webhook URL is not a valid URL', 400); }
  const localDev = !isProd() && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !(localDev && url.protocol === 'http:')) throw new AppError('Webhook URL must use HTTPS', 400);
  if (url.username || url.password) throw new AppError('Webhook URL must not contain credentials', 400);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isProd() && (net.isIP(host) ? isPrivateAddress(host) : host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || !host.includes('.'))) {
    throw new AppError('Webhook URL must be publicly reachable', 400);
  }
  return url;
}

/**
 * DNS lookup used for the actual connection: every resolved address must be
 * public, and the socket connects to exactly the address checked here — so a
 * hostname that re-resolves to an internal address between a check and the
 * connection (DNS rebinding) cannot reach it.
 */
export function publicOnlyLookup(hostname: string, options: any, callback: any): void {
  const opts = typeof options === 'object' && options !== null ? options : {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as unknown as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error('Webhook host resolves to a non-public address'), { code: 'EBLOCKED' }));
    }
    if (opts.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/** POST a JSON body; resolves with the status code. No redirects are followed. */
function postJson(url: URL, body: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isProd() && net.isIP(host) && isPrivateAddress(host)) return reject(new Error('Webhook host is a non-public address'));
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'POST',
      headers: { ...headers, 'content-length': String(Buffer.byteLength(body)) },
      timeout: TIMEOUT_MS,
      ...(isProd() ? { lookup: publicOnlyLookup as any } : {}),
    }, (res) => {
      res.resume(); // the body is never needed
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => req.destroy(new Error('Webhook delivery timed out')));
    req.on('error', reject);
    req.end(body);
  });
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
    const status = await postJson(url, body, { 'content-type': 'application/json', 'user-agent': 'Tazdan-Webhooks/1', 'tazdan-event': d.event, 'tazdan-delivery': d.id, 'tazdan-signature': sign(d.endpoint.secret, body) });
    if (status >= 200 && status < 300) {
      await prisma.businessWebhookDelivery.update({ where: { id: d.id }, data: { status: 'DELIVERED', attempts, responseStatus: status, deliveredAt: new Date(), lastError: null } });
      return;
    }
    throw Object.assign(new Error(`HTTP ${status}`), { status });
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
