/**
 * WhatsApp / SMS dispatcher.
 *
 * Routing rules:
 *   - WhatsApp text/template → Meta Cloud API (the platform's own
 *     WhatsApp Business number). Falls back to Twilio only if Meta is
 *     not configured (legacy / dev convenience).
 *   - SMS                    → Twilio (Twilio stays in the stack for
 *     SIM-card OTP and any SMS-only fallback).
 *   - Phone OTP              → WhatsApp first (Meta if configured,
 *     else Twilio), then SMS via Twilio as fallback.
 *
 * This module is the single import point for the rest of the server.
 * Controllers should never reach into `meta.service` or `twilio.service`
 * directly — call through here so future provider swaps stay local.
 */
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import {
  isMetaWhatsAppConfigured,
  sendWhatsAppText      as metaSendText,
  sendWhatsAppTemplate  as metaSendTemplate,
  sendOtpFromMeta,
  validateMetaSignature,
} from './meta.service';
import {
  isTwilioConfigured,
  sendWhatsAppText as twilioSendWa,
  sendSMS          as twilioSendSms,
  startVerification as twilioStartVerification,
  checkVerification as twilioCheckVerification,
  validateTwilioSignature,
} from './twilio.service';

const OTP_TTL_MS = 10 * 60 * 1000;

/* ── WhatsApp send ──────────────────────────────────────────────── */

export async function sendWhatsAppText(opts: { to: string; body: string; userId?: string }) {
  if (isMetaWhatsAppConfigured()) return metaSendText(opts);
  return twilioSendWa(opts);
}

export async function sendWhatsAppTemplate(opts: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonParams?: string[];
  userId?: string;
}) {
  if (isMetaWhatsAppConfigured()) return metaSendTemplate(opts);
  // Twilio's WhatsApp template flow uses contentSid; we don't wire it
  // here because the user explicitly wants WhatsApp via Meta. Fall back
  // to free-form text so dev still works.
  return twilioSendWa({ to: opts.to, body: `[template ${opts.templateName}]`, userId: opts.userId });
}

/* ── SMS — Twilio only ──────────────────────────────────────────── */

export async function sendSMS(opts: { to: string; body: string }) {
  return twilioSendSms(opts);
}

/* ── Phone OTP ──────────────────────────────────────────────────── */

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Start phone verification. Stores a code in the User row and pushes it
 * over the chosen channel. WhatsApp goes through Meta when configured.
 */
export async function startVerification(opts: {
  phone: string;
  channel: 'sms' | 'whatsapp';
  userId?: string;
}): Promise<{ ok: boolean; status?: string; reason?: string; mode?: string }> {
  // SMS path stays on Twilio — the user asked for Twilio for SIM OTP only.
  if (opts.channel === 'sms') {
    // Defer to Twilio's existing verify/self-hosted/simulated logic so
    // we don't duplicate code generation for the SMS path.
    return twilioStartVerification(opts);
  }

  // WhatsApp path — prefer Meta, generate code ourselves, store in DB,
  // and send from our own WhatsApp Business number.
  if (opts.userId && isMetaWhatsAppConfigured()) {
    const code    = generateOtp();
    const expires = new Date(Date.now() + OTP_TTL_MS);
    await prisma.user.update({
      where: { id: opts.userId },
      data:  { phoneOtpCode: code, phoneOtpExpires: expires },
    });
    const result = await sendOtpFromMeta({ to: opts.phone, code, userId: opts.userId });
    return {
      ok:     result.ok,
      status: result.ok ? 'pending' : 'failed',
      reason: result.reason,
      mode:   'meta-direct',
    };
  }

  // Fallback — Meta not configured: delegate to Twilio's WhatsApp path
  // (Verify or self-hosted depending on what's configured).
  return twilioStartVerification(opts);
}

/**
 * Verify the OTP code. Checks the DB-stored code first (Meta-direct +
 * Twilio self-hosted both write to the same column), then falls back
 * to Twilio Verify, then dev simulation.
 */
export async function checkVerification(opts: {
  phone: string;
  code: string;
  userId?: string;
}): Promise<{ valid: boolean; reason?: string }> {
  // DB code wins — works for both Meta-direct and Twilio self-hosted.
  if (opts.userId) {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { phoneOtpCode: true, phoneOtpExpires: true },
    });
    if (user?.phoneOtpCode) {
      if (!user.phoneOtpExpires || user.phoneOtpExpires < new Date()) {
        return { valid: false, reason: 'Code expired' };
      }
      if (user.phoneOtpCode === opts.code) {
        await prisma.user.update({
          where: { id: opts.userId },
          data:  { phoneOtpCode: null, phoneOtpExpires: null },
        });
        return { valid: true };
      }
      // Don't return false yet — Twilio Verify might still hold the code
      // if both paths were tried in this session.
    }
  }
  return twilioCheckVerification(opts);
}

/* ── Inbound signature validation ──────────────────────────────── */

export { validateMetaSignature, validateTwilioSignature };
export { isMetaWhatsAppConfigured, isTwilioConfigured };
