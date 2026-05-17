/**
 * Twilio adapter — WhatsApp, SMS, and Verify (phone OTP).
 *
 * Feature-flagged on env presence: when `TWILIO_ACCOUNT_SID` is unset
 * (e.g. local dev), every send still persists a `WhatsAppMessage` row
 * (or logs the SMS) but does NOT call Twilio. This keeps the app
 * usable end-to-end without billing credentials, while production
 * needs:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM    e.g. "whatsapp:+14155238886"
 *   TWILIO_SMS_FROM         e.g. "+12025550123"
 *   TWILIO_VERIFY_SERVICE_SID  (created in Twilio Verify console)
 */
import { prisma } from '../../utils/prisma';

let _twilio: any | null = null;
function client(): any | null {
  if (_twilio) return _twilio;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    _twilio = twilio(sid, token);
    return _twilio;
  } catch (e) {
    console.warn('[twilio] init failed', (e as Error).message);
    return null;
  }
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function normalizeE164(raw: string): string {
  // Caller is expected to pass +<dial><number>; we strip trailing junk.
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function persistOutbound(opts: { userId?: string | null; phone: string; body: string; status: string; }) {
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
    console.warn('[twilio] persist failed', e);
  }
}

/* ── WhatsApp ────────────────────────────────────────────────────── */

export async function sendWhatsAppText(opts: {
  to: string; body: string; userId?: string;
}): Promise<{ ok: boolean; sid?: string; reason?: string }> {
  const to = normalizeE164(opts.to);
  const phone = to.replace(/^\+/, '');
  const cli = client();
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!cli || !from) {
    console.log('[twilio:wa] no creds — would send', { to, body: opts.body });
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'SIMULATED' });
    return { ok: true, reason: 'simulated' };
  }
  try {
    const msg = await cli.messages.create({
      from:  from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to:    to.startsWith('whatsapp:')  ? to   : `whatsapp:${to}`,
      body:  opts.body,
    });
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'SENT' });
    return { ok: true, sid: msg.sid };
  } catch (e: any) {
    console.warn('[twilio:wa] send failed', e?.message);
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'FAILED' });
    return { ok: false, reason: e?.message };
  }
}

/* ── SMS ─────────────────────────────────────────────────────────── */

export async function sendSMS(opts: {
  to: string; body: string;
}): Promise<{ ok: boolean; sid?: string; reason?: string }> {
  const to = normalizeE164(opts.to);
  const cli = client();
  const from = process.env.TWILIO_SMS_FROM;
  if (!cli || !from) {
    console.log('[twilio:sms] no creds — would send', { to, body: opts.body });
    return { ok: true, reason: 'simulated' };
  }
  try {
    const msg = await cli.messages.create({ from, to, body: opts.body });
    return { ok: true, sid: msg.sid };
  } catch (e: any) {
    console.warn('[twilio:sms] send failed', e?.message);
    return { ok: false, reason: e?.message };
  }
}

/* ── Twilio Verify (phone OTP) ──────────────────────────────────── */

/**
 * Initiate a phone verification. Twilio Verify owns the code generation
 * + delivery + retry policy. Channel = "whatsapp" or "sms".
 */
export async function startVerification(opts: {
  phone: string; channel: 'sms' | 'whatsapp';
}): Promise<{ ok: boolean; status?: string; reason?: string }> {
  const to = normalizeE164(opts.phone);
  const cli = client();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!cli || !serviceSid) {
    console.log('[twilio:verify] no creds — simulated', { to, channel: opts.channel });
    return { ok: true, status: 'pending', reason: 'simulated' };
  }
  try {
    const v = await cli.verify.v2
      .services(serviceSid)
      .verifications.create({ to, channel: opts.channel });
    return { ok: true, status: v.status };
  } catch (e: any) {
    console.warn('[twilio:verify] start failed', e?.message);
    return { ok: false, reason: e?.message };
  }
}

export async function checkVerification(opts: {
  phone: string; code: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const to = normalizeE164(opts.phone);
  const cli = client();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!cli || !serviceSid) {
    // Simulated mode — accept any 6-digit code so devs can complete
    // the flow without a Twilio account.
    const ok = /^\d{4,8}$/.test(opts.code);
    return { valid: ok, reason: ok ? 'simulated' : 'simulated-rejected' };
  }
  try {
    const check = await cli.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to, code: opts.code });
    return { valid: check.status === 'approved' };
  } catch (e: any) {
    console.warn('[twilio:verify] check failed', e?.message);
    return { valid: false, reason: e?.message };
  }
}

/* ── Inbound webhook signature validation ───────────────────────── */

/**
 * Verify that an inbound Twilio webhook actually came from Twilio.
 * Twilio signs the full URL + form-encoded params with HMAC-SHA1 using
 * the account auth token. The `validateRequest` helper in the Twilio
 * SDK encapsulates that.
 */
export function validateTwilioSignature(opts: {
  signature: string | undefined;
  url: string;
  params: Record<string, any>;
}): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !opts.signature) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    return twilio.validateRequest(token, opts.signature, opts.url, opts.params);
  } catch {
    return false;
  }
}
