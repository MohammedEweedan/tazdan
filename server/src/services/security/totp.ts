/**
 * Single-use TOTP verification.
 *
 * `speakeasy.totp.verify` alone accepts the same 6-digit code again and again
 * for as long as it sits inside the window (90 seconds with window 1), so a
 * code read over a shoulder, from a phishing proxy or from a screen recording
 * can be replayed — for a second login, a second step-up or a second
 * withdrawal. Here every accepted code burns its time step for that user: a
 * code is good for exactly one check (RFC 6238 §5.2).
 *
 * Use this for EVERY TOTP check (login, step-up, 2FA changes, withdrawals,
 * wallet export) so a step burned by one flow cannot be reused by another.
 */
import speakeasy from 'speakeasy';
import { markOnce } from '../../utils/redis';

const STEP_SECONDS = 30;

/** Exactly six ASCII digits — rejects arrays/objects/`12345a` before speakeasy's lenient parseInt. */
export function isTotpFormat(code: unknown): code is string {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

/**
 * True only when `code` is valid for `secret` within ±`window` steps AND that
 * step has not been used before by this user. Never throws.
 */
export async function verifyTotpOnce(
  userId: string,
  secret: string | null | undefined,
  code: unknown,
  opts: { window?: number } = {},
): Promise<boolean> {
  if (!secret || !isTotpFormat(code)) return false;
  const window = opts.window ?? 1;
  // Pin the clock so the step we burn is exactly the step that matched.
  const nowSeconds = Date.now() / 1000;
  const counter = Math.floor(nowSeconds / STEP_SECONDS);
  let match: { delta: number } | undefined;
  try {
    match = speakeasy.totp.verifyDelta({ secret, encoding: 'base32', token: code, window, time: nowSeconds });
  } catch {
    return false;
  }
  if (!match) return false;
  const step = counter + match.delta;
  // Keep the marker until the step can no longer verify (window on both sides).
  const ttl = (window * 2 + 2) * STEP_SECONDS;
  return markOnce(`totp:used:${userId}:${step}`, ttl);
}
