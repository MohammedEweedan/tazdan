/**
 * Meta WhatsApp Cloud API adapter.
 *
 * This is the platform's OWN WhatsApp Business account — messages
 * are sent from the phone number you registered with Meta, NOT from
 * Twilio's sandbox / shared sender. The user sees a single, branded
 * sender for every chatbot reply and every OTP.
 *
 * Required env (see .env.example):
 *   META_WA_PHONE_NUMBER_ID   The 15-digit numeric ID from Meta dashboard
 *   META_WA_ACCESS_TOKEN      Long-lived (system user) bearer token
 *   META_WA_VERIFY_TOKEN      Webhook verification token you choose
 *   META_WA_APP_SECRET        App secret used to validate inbound payload
 *
 * Optional:
 *   META_WA_API_VERSION       Defaults to v20.0
 *
 * When env is missing we no-op (simulate) so dev works without a
 * real Meta business account configured.
 */
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';

const API_VERSION = process.env.META_WA_API_VERSION || 'v20.0';

export function isMetaWhatsAppConfigured(): boolean {
  return !!(process.env.META_WA_PHONE_NUMBER_ID && process.env.META_WA_ACCESS_TOKEN);
}

function normalizeE164(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function persistOutbound(opts: {
  userId?: string | null; phone: string; body: string; status: string;
}) {
  try {
    await (prisma as any).whatsAppMessage.create({
      data: {
        userId:      opts.userId ?? null,
        phoneNumber: opts.phone,
        message:     opts.body,
        direction:   'OUT',
        status:      opts.status,
      },
    });
  } catch (e) {
    console.warn('[meta:wa] persist failed', e);
  }
}

/**
 * Send a free-form text message via the Cloud API. Only works inside
 * the 24-hour customer service window (a user must have messaged us
 * within the last 24h). For OTP and out-of-window pushes use
 * `sendWhatsAppTemplate` with a pre-approved template.
 */
export async function sendWhatsAppText(opts: {
  to: string; body: string; userId?: string;
}): Promise<{ ok: boolean; sid?: string; reason?: string }> {
  const to    = normalizeE164(opts.to);
  const phone = to.replace(/^\+/, '');
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const token         = process.env.META_WA_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.log('[meta:wa] no creds — would send to', to, ':', opts.body);
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'SIMULATED' });
    return { ok: true, reason: 'simulated' };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:                phone,
        type:              'text',
        text:              { preview_url: false, body: opts.body },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[meta:wa] send failed', res.status, json?.error?.message);
      await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'FAILED' });
      return { ok: false, reason: json?.error?.message ?? `HTTP ${res.status}` };
    }
    const sid = json?.messages?.[0]?.id;
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'SENT' });
    return { ok: true, sid };
  } catch (e: any) {
    console.warn('[meta:wa] send error', e?.message);
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'FAILED' });
    return { ok: false, reason: e?.message };
  }
}

/**
 * Send a template message (e.g. for OTP outside the 24h window).
 * Template + language must be pre-approved in Meta Business Manager.
 */
export async function sendWhatsAppTemplate(opts: {
  to: string;
  templateName: string;
  languageCode?: string;          // e.g. 'en_US'
  bodyParams?: string[];          // text variables in body
  buttonParams?: string[];        // text variables in URL button (for OTP it's the code)
  userId?: string;
}): Promise<{ ok: boolean; sid?: string; reason?: string }> {
  const to    = normalizeE164(opts.to);
  const phone = to.replace(/^\+/, '');
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const token         = process.env.META_WA_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.log('[meta:wa-template] no creds — would send', opts.templateName, 'to', to, opts.bodyParams);
    await persistOutbound({
      userId: opts.userId, phone,
      body: `[template ${opts.templateName}] ${opts.bodyParams?.join(' | ')}`,
      status: 'SIMULATED',
    });
    return { ok: true, reason: 'simulated' };
  }

  const components: any[] = [];
  if (opts.bodyParams?.length) {
    components.push({
      type: 'body',
      parameters: opts.bodyParams.map((t) => ({ type: 'text', text: t })),
    });
  }
  if (opts.buttonParams?.length) {
    // OTP template — button index 0, URL sub-type with the code.
    components.push({
      type:     'button',
      sub_type: 'url',
      index:    '0',
      parameters: opts.buttonParams.map((t) => ({ type: 'text', text: t })),
    });
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:                phone,
        type:              'template',
        template: {
          name:     opts.templateName,
          language: { code: opts.languageCode ?? 'en_US' },
          components,
        },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[meta:wa-template] failed', res.status, json?.error?.message);
      await persistOutbound({
        userId: opts.userId, phone,
        body: `[template ${opts.templateName}]`,
        status: 'FAILED',
      });
      return { ok: false, reason: json?.error?.message ?? `HTTP ${res.status}` };
    }
    const sid = json?.messages?.[0]?.id;
    await persistOutbound({
      userId: opts.userId, phone,
      body: `[template ${opts.templateName}] ${(opts.bodyParams ?? []).join(' | ')}`,
      status: 'SENT',
    });
    return { ok: true, sid };
  } catch (e: any) {
    console.warn('[meta:wa-template] error', e?.message);
    return { ok: false, reason: e?.message };
  }
}

/**
 * Validate inbound webhook payload signature.
 * Meta signs the raw body with the app secret using HMAC-SHA256.
 *
 * The signature header looks like: "sha256=<hex>"
 */
export function validateMetaSignature(opts: {
  signatureHeader: string | undefined;
  rawBody: string;
}): boolean {
  const secret = process.env.META_WA_APP_SECRET;
  if (!secret || !opts.signatureHeader) return false;
  const [scheme, sig] = opts.signatureHeader.split('=');
  if (scheme !== 'sha256' || !sig) return false;
  const expected = crypto.createHmac('sha256', secret).update(opts.rawBody).digest('hex');
  // Length check guards against `timingSafeEqual` throwing on mismatched lengths.
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/* ── OTP via Meta (your number) ───────────────────────────────────── */

/**
 * Send a 6-digit code from the platform's own WhatsApp Business number.
 *
 * Strategy:
 *   1. If a template name is configured (`META_WA_OTP_TEMPLATE`), use it —
 *      this works for first-contact users (outside the 24h window).
 *   2. Otherwise fall back to free-form text, which only delivers if the
 *      user has messaged us in the last 24 hours.
 *
 * The caller is responsible for storing the code + expiry in the User
 * row before calling this. We do not touch the DB here.
 */
export async function sendOtpFromMeta(opts: {
  to: string; code: string; userId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const templateName = process.env.META_WA_OTP_TEMPLATE;
  if (templateName) {
    return sendWhatsAppTemplate({
      to: opts.to,
      templateName,
      languageCode: process.env.META_WA_OTP_LANGUAGE || 'en_US',
      bodyParams:   [opts.code],
      buttonParams: [opts.code],
      userId:       opts.userId,
    });
  }
  const body = `Your Fortuni verification code is: *${opts.code}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
  return sendWhatsAppText({ to: opts.to, body, userId: opts.userId });
}
