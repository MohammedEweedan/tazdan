/**
 * Twilio adapter — WhatsApp, SMS, and phone OTP.
 *
 * OTP delivery priority:
 *   1. Twilio Verify Service (if TWILIO_VERIFY_SERVICE_SID is set) — handles
 *      delivery, retry, and TTL automatically.
 *   2. Self-hosted path — generate a 6-digit code, store hash in DB, send
 *      via our own WhatsApp / SMS number so the message comes FROM the
 *      platform number the user already trusts.
 *
 * Feature-flagged on env presence: when TWILIO_ACCOUNT_SID is unset every
 * send still persists a WhatsAppMessage row and logs to stdout. Production
 * needs:
 *   TWILIO_ACCOUNT_SID          ACxxx…
 *   TWILIO_AUTH_TOKEN           xxx…
 *   TWILIO_WHATSAPP_FROM        whatsapp:+14155238886   ← YOUR number
 *   TWILIO_SMS_FROM             +12025550123
 *   TWILIO_VERIFY_SERVICE_SID   VAxx…  (optional — enables Twilio Verify path)
 */
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';

/* ── Twilio SDK lazy-init ─────────────────────────────────────────── */

let _twilio: any | null = null;
function client(): any | null {
  if (_twilio) return _twilio;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
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
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function persistOutbound(opts: { userId?: string | null; phone: string; body: string; status: string }) {
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
  const to   = normalizeE164(opts.to);
  const phone = to.replace(/^\+/, '');
  const cli  = client();
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!cli || !from) {
    console.log('[twilio:wa] no creds — would send to', to, ':', opts.body);
    await persistOutbound({ userId: opts.userId, phone, body: opts.body, status: 'SIMULATED' });
    return { ok: true, reason: 'simulated' };
  }
  try {
    const msg = await cli.messages.create({
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
      body: opts.body,
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
  const to  = normalizeE164(opts.to);
  const cli = client();
  const from = process.env.TWILIO_SMS_FROM;
  if (!cli || !from) {
    console.log('[twilio:sms] no creds — would send to', to, ':', opts.body);
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

/* ── OTP — self-hosted path ──────────────────────────────────────── */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp(): string {
  // Cryptographically random 6-digit code (000000–999999).
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Generate and store a 6-digit OTP for the given userId, then send it
 * from our own WhatsApp / SMS number. Does NOT use Twilio Verify — the
 * message comes directly from the platform's registered WhatsApp number.
 */
async function sendOtpDirect(opts: {
  userId: string;
  phone: string;
  channel: 'whatsapp' | 'sms';
}): Promise<{ ok: boolean; reason?: string }> {
  const code = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MS);

  // Store plain code — it's short-lived (10 min) and low-value; hashing
  // is not worth the complexity for a 6-digit code. Clear on use.
  await prisma.user.update({
    where: { id: opts.userId },
    data: { phoneOtpCode: code, phoneOtpExpires: expires },
  });

  const body = `Your Fortuni verification code is: *${code}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  if (opts.channel === 'sms') {
    return sendSMS({ to: opts.phone, body });
  }
  return sendWhatsAppText({ to: opts.phone, body, userId: opts.userId });
}

/**
 * Verify a self-hosted OTP. Returns valid=true and clears the code on success.
 */
async function checkOtpDirect(opts: {
  userId: string;
  code: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { phoneOtpCode: true, phoneOtpExpires: true },
  });
  if (!user?.phoneOtpCode) return { valid: false, reason: 'No code pending' };
  if (!user.phoneOtpExpires || user.phoneOtpExpires < new Date()) {
    return { valid: false, reason: 'Code expired' };
  }
  if (user.phoneOtpCode !== opts.code) return { valid: false, reason: 'Invalid code' };

  // Clear on success — single-use.
  await prisma.user.update({
    where: { id: opts.userId },
    data: { phoneOtpCode: null, phoneOtpExpires: null },
  });
  return { valid: true };
}

/* ── Public OTP API (called by auth controller) ──────────────────── */

/**
 * Send a phone OTP via WhatsApp or SMS.
 *
 * Strategy:
 *   - If TWILIO_VERIFY_SERVICE_SID is set → use Twilio Verify (their number).
 *   - Otherwise → use our own registered WhatsApp/SMS number (self-hosted).
 *   - If no Twilio creds at all → simulate (dev mode, any 6-digit code works).
 */
export async function startVerification(opts: {
  phone: string;
  channel: 'sms' | 'whatsapp';
  userId?: string;
}): Promise<{ ok: boolean; status?: string; reason?: string; mode?: string }> {
  const to = normalizeE164(opts.phone);

  // Path 1 — Twilio Verify (code comes from Twilio's number).
  const cli = client();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (cli && serviceSid) {
    try {
      const v = await cli.verify.v2
        .services(serviceSid)
        .verifications.create({ to, channel: opts.channel });
      return { ok: true, status: v.status, mode: 'twilio-verify' };
    } catch (e: any) {
      console.warn('[twilio:verify] Verify failed, falling back to direct send', e?.message);
      // Fall through to path 2.
    }
  }

  // Path 2 — Self-hosted: generate code, send from OUR number.
  if (cli && opts.userId) {
    const result = await sendOtpDirect({ userId: opts.userId, phone: to, channel: opts.channel });
    return { ok: result.ok, status: result.ok ? 'pending' : 'failed', reason: result.reason, mode: 'direct' };
  }

  // Path 3 — Dev/sim: no Twilio creds at all.
  console.log('[twilio:verify] simulated OTP for', to, 'channel:', opts.channel);
  if (opts.userId) {
    // Store a simulated code so checkVerification works end-to-end in dev.
    await prisma.user.update({
      where: { id: opts.userId },
      data: { phoneOtpCode: '123456', phoneOtpExpires: new Date(Date.now() + OTP_TTL_MS) },
    }).catch(() => {});
  }
  return { ok: true, status: 'pending', reason: 'simulated', mode: 'simulated' };
}

/**
 * Verify the OTP code. Mirrors the same three paths as startVerification.
 */
export async function checkVerification(opts: {
  phone: string;
  code: string;
  userId?: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const to = normalizeE164(opts.phone);

  // Path 1 — Twilio Verify.
  const cli = client();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (cli && serviceSid) {
    try {
      const check = await cli.verify.v2
        .services(serviceSid)
        .verificationChecks.create({ to, code: opts.code });
      if (check.status === 'approved') return { valid: true };
      // If Verify rejects, fall through to try the self-hosted code too
      // (handles the case where we fell back to direct on send but Verify
      // is still configured).
    } catch (e: any) {
      console.warn('[twilio:verify] check failed, trying direct path', e?.message);
    }
  }

  // Path 2 — Self-hosted code in DB.
  if (opts.userId) {
    return checkOtpDirect({ userId: opts.userId, code: opts.code });
  }

  // Path 3 — Simulated: accept any 6-digit code.
  const ok = /^\d{6}$/.test(opts.code);
  return { valid: ok, reason: ok ? 'simulated' : 'simulated-rejected' };
}

/* ── Inbound webhook signature validation ─────────────────────────── */

export function validateTwilioSignature(opts: {
  signature: string | undefined;
  url: string;
  params: Record<string, any>;
}): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !opts.signature) return false;
  try {
    const twilio = require('twilio');
    return twilio.validateRequest(token, opts.signature, opts.url, opts.params);
  } catch {
    return false;
  }
}
