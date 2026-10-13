/**
 * Step-up authentication for high-value / risky actions.
 *
 * A user must satisfy a 6-digit challenge (emailed code, OR their authenticator
 * TOTP if 2FA is enabled) before the platform will execute a:
 *   - withdrawal, sell, buy, or transfer whose USD value ≥ STEP_UP_USD ($1000), OR
 *   - any of the above from an UNRECOGNIZED device (new fingerprint).
 *
 * Flow:
 *   1. Client calls the action; server computes USD value + checks device.
 *      If step-up is required and no valid code is supplied → 401 + a challenge
 *      is issued (code emailed, or "use your authenticator" if TOTP).
 *   2. Client re-submits the action with `stepUpCode`.
 *   3. verifyStepUp() consumes the challenge; the action proceeds.
 *
 * Security:
 *   - Codes are SHA-256 hashed at rest, single-use, 10-min TTL, 5-attempt cap.
 *   - A challenge is bound to (user, action) so a code can't be replayed for a
 *     different action.
 *   - TOTP path verifies against the user's existing authenticator secret.
 */
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { sendEmail, emailErrorSummary } from '../email';
import { logger } from '../../utils/logger';
import { parseUserAgent, geoLocate } from '../../utils/deviceInfo';
import { clearAttempts, reserveAttempt } from '../../utils/redis';
import { recordSecurityEvent } from '../platform/securityEvents';
import { verifyTotpOnce } from './totp';
import { safeEqual } from './credentials';

export const STEP_UP_USD = Number(process.env.STEP_UP_USD ?? '1000');
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
// Within this window, re-triggering an action reuses the existing code/email
// instead of sending another — prevents duplicate "your code" emails.
const RESEND_COOLDOWN_MS = 90_000;
// Per-user budget across ALL challenges: re-issuing a challenge (silent for
// authenticator users) must not buy a fresh set of guesses.
const USER_ATTEMPT_BUDGET = 10;
const USER_BUDGET_WINDOW_S = 30 * 60;
const EMAIL_CODES_PER_HOUR = 20;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type StepUpAction = 'withdrawal' | 'buy' | 'sell' | 'transfer' | 'account_close';

/** How each action reads in the security-code email. */
const ACTION_LABEL: Record<StepUpAction, string> = {
  withdrawal: 'withdrawal', buy: 'purchase', sell: 'sale', transfer: 'transfer', account_close: 'account closure',
};

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * The per-install random id the app keeps in the keychain and sends as
 * `x-device-id`. Without one there is no device to trust: a fingerprint of
 * the User-Agent alone is shared by every phone of that model and trivially
 * replayed, so such requests are never "known".
 */
function deviceIdOf(req: { headers: Record<string, any> }): string | null {
  const raw = req.headers['x-device-id'];
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return id.length >= 16 && id.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

/** Stable device fingerprint from request headers (UA + the client's device id); null without a usable device id. */
export function deviceFingerprint(req: { headers: Record<string, any> }): string | null {
  const devId = deviceIdOf(req);
  if (!devId) return null;
  const ua = String(req.headers['user-agent'] ?? '');
  return crypto.createHash('sha256').update(`${ua}::${devId}`).digest('hex').slice(0, 32);
}

/** Is this device already known/trusted for the user? */
export async function isKnownDevice(userId: string, fingerprint: string | null): Promise<boolean> {
  if (!fingerprint) return false;
  const d = await prisma.knownDevice.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
  });
  if (d) {
    // Touch lastSeen (best-effort).
    prisma.knownDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return !!d;
}

/**
 * Remember a device after a successful step-up (or first trusted login).
 *
 * Captures a human-readable label, device type, OS, IP, and "City, Country"
 * from the request so the Trusted Devices screen can show real detail instead
 * of a generic "Verified device". Geo lookup is best-effort and never blocks.
 */
export async function rememberDevice(
  userId: string,
  fingerprint: string | null,
  req?: { headers: Record<string, any>; ip?: string },
): Promise<void> {
  if (!fingerprint) return; // nothing device-specific to trust
  let label: string | undefined;
  let deviceType: string | undefined;
  let os: string | undefined;
  let ipAddress: string | undefined;
  let location: string | null = null;

  if (req) {
    const ua = String(req.headers['user-agent'] ?? '');
    const parsed = parseUserAgent(ua);
    label = parsed.browser ? `${parsed.name} · ${parsed.browser}` : parsed.name;
    deviceType = parsed.type;
    os = parsed.os;
    ipAddress =
      req.ip ||
      (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) ||
      undefined;
  }

  await prisma.knownDevice.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    update: {
      lastSeenAt: new Date(),
      ...(label ? { label } : {}),
      ...(deviceType ? { deviceType } : {}),
      ...(os ? { os } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(location ? { location } : {}),
    },
    create: { userId, fingerprint, label, deviceType, os, ipAddress, location },
  });
  // "City, Country" is cosmetic: never hold up a payment or sign-in for it.
  if (ipAddress) {
    void geoLocate(ipAddress)
      .then((loc) => loc ? prisma.knownDevice.update({ where: { userId_fingerprint: { userId, fingerprint } }, data: { location: loc } }) : null)
      .catch(() => undefined);
  }
}

/**
 * Decide whether an action needs step-up. Returns the reason, or null if not.
 */
export function stepUpRequired(opts: { valueUsd: number; knownDevice: boolean }): null | 'high_value' | 'new_device' {
  if (!opts.knownDevice) return 'new_device';
  if (Number.isFinite(opts.valueUsd) && opts.valueUsd >= STEP_UP_USD) return 'high_value';
  return null;
}

/**
 * Issue a challenge. If the user has TOTP, we don't email a code — they use
 * their authenticator. Otherwise we email a fresh 6-digit code.
 * Returns the method so the client can prompt correctly.
 */
export async function issueStepUp(userId: string, action: StepUpAction): Promise<{ method: 'email' | 'totp' }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, twoFactorEnabled: true },
  });
  if (!user) throw new AppError('User not found', 404);

  // The challenge method must match the user's CURRENT 2FA state. A user with
  // no authenticator (or who disabled it) must get an EMAILED code.
  const wantMethod: 'email' | 'totp' = user.twoFactorEnabled ? 'totp' : 'email';

  // Idempotency: if a fresh, unconsumed challenge of the SAME method already
  // exists (issued in the last RESEND_COOLDOWN), reuse it instead of issuing a
  // second code/email — stops duplicate emails when an action is re-triggered
  // quickly (e.g. /execute and /step-up/start firing together). A stale
  // challenge of the WRONG method (e.g. a leftover TOTP row for a user who no
  // longer has 2FA) must NOT be reused — that would suppress the email and
  // leave the user with nothing to enter.
  const existing = await prisma.stepUpChallenge.findFirst({
    where: { userId, action, method: wantMethod, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { method: wantMethod };
  }

  if (wantMethod === 'email') {
    // Bounded inbox noise: a stolen session must not be able to mail-bomb the owner.
    const slot = await reserveAttempt(`stepup:issue:${userId}`, EMAIL_CODES_PER_HOUR, 60 * 60);
    if (!slot.allowed) throw new AppError('Too many security codes requested. Try again later.', 429);
  }

  // Otherwise clear stale challenges (any method) and issue a fresh one.
  await prisma.stepUpChallenge.deleteMany({ where: { userId, action, consumedAt: null } });

  if (wantMethod === 'totp') {
    // TOTP path — verified live against the authenticator secret; we still
    // record a row so the action knows a challenge is outstanding.
    await prisma.stepUpChallenge.create({
      data: { userId, action, codeHash: 'TOTP', method: 'totp', expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return { method: 'totp' };
  }

  // Email path: create the challenge, then AWAIT the email so a send failure is
  // surfaced (we don't want to tell the user "check your email" when nothing
  // sent). If the send fails, delete the orphan challenge and throw so the
  // client shows a real error instead of prompting for a code that never came.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = await prisma.stepUpChallenge.create({
    data: { userId, action, codeHash: hashCode(code), method: 'email', expiresAt: new Date(Date.now() + TTL_MS) },
  });
  try {
    await sendEmail({
      to: user.email,
      subject: `Your tazdan security code: ${code}`,
      html: `<p>Hi ${esc(user.firstName || 'there')},</p>
        <p>Confirm your <b>${ACTION_LABEL[action] ?? action}</b> with this code. It expires in 10 minutes.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
        <p>If you didn't request this, your account may be at risk — change your password and contact support.</p>`,
      sender: 'auth',
    });
  } catch (e) {
    logger.error('[stepUp] security-code email failed to send', { userId, action, err: emailErrorSummary(e) });
    await prisma.stepUpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw new AppError('Could not send your security code email. Please try again shortly.', 502);
  }
  return { method: 'email' };
}

/**
 * Verify a supplied code for (user, action). Consumes the challenge on success.
 * Throws AppError(401) on failure. For TOTP users, verifies the authenticator.
 */
export async function verifyStepUp(userId: string, action: StepUpAction, code: string | undefined): Promise<void> {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new AppError('A 6-digit security code is required', 401);

  // Reserved BEFORE verifying, so a parallel burst is counted in full;
  // refilled only by a success.
  const budgetKey = `stepup:try:${userId}`;
  const budget = await reserveAttempt(budgetKey, USER_ATTEMPT_BUDGET, USER_BUDGET_WINDOW_S);
  if (!budget.allowed) throw new AppError('Too many attempts. Try again in 30 minutes.', 429);

  // Check ALL active (unconsumed, unexpired, not exhausted) challenges for
  // this action — the issue + modal-request paths can both create one, and
  // the user's emailed code may match either. We consume whichever matches.
  const candidates = await prisma.stepUpChallenge.findMany({
    where: { userId, action, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'desc' },
  });
  if (candidates.length === 0) throw new AppError('No active security challenge. Re-initiate the action.', 401);
  const ids = candidates.map((c) => c.id);

  // Reserve this attempt on the challenges themselves. The conditional
  // increment is re-checked under the row lock, so parallel guesses cannot
  // all read a stale "attempts" and slip past the cap (the old code computed
  // the cap from the value read before the increment).
  const reserved = await prisma.stepUpChallenge.updateMany({
    where: { id: { in: ids }, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved.count === 0) {
    await prisma.stepUpChallenge.deleteMany({ where: { id: { in: ids }, consumedAt: null } }).catch(() => {});
    throw new AppError('Too many attempts. Request a new code.', 429);
  }

  let matched: (typeof candidates)[number] | undefined;
  const totpChallenge = candidates.find((c) => c.method === 'totp');
  if (totpChallenge) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
    // Single-use: the same authenticator code cannot satisfy two challenges.
    if (user?.twoFactorEnabled && await verifyTotpOnce(userId, user.twoFactorSecret, code)) matched = totpChallenge;
  }
  if (!matched) {
    // Match the emailed code against any active email challenge.
    const h = hashCode(code);
    matched = candidates.find((c) => c.method === 'email' && safeEqual(c.codeHash, h));
  }

  if (!matched) {
    // Burn every challenge whose attempts are now used up (current DB values).
    const burned = await prisma.stepUpChallenge
      .deleteMany({ where: { id: { in: ids }, consumedAt: null, attempts: { gte: MAX_ATTEMPTS } } })
      .catch(() => ({ count: 0 }));
    void recordSecurityEvent({ type: 'STEP_UP_FAILED', severity: 'MEDIUM', userId, details: { action } });
    if (burned.count > 0) throw new AppError('Too many attempts. Request a new code.', 429);
    throw new AppError('Invalid security code', 401);
  }

  // Single use, atomically: of several parallel requests carrying the same
  // valid code, exactly one consumes the challenge — one code, one action.
  const consumed = await prisma.stepUpChallenge.updateMany({
    where: { id: matched.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw new AppError('This security code was already used. Request a new one.', 401);
  // Retire the other active challenges for this action so stale codes don't linger.
  const others = ids.filter((id) => id !== matched!.id);
  if (others.length) {
    await prisma.stepUpChallenge.updateMany({ where: { id: { in: others }, consumedAt: null }, data: { consumedAt: new Date() } }).catch(() => {});
  }
  await clearAttempts(budgetKey);
}

/**
 * One-call guard for controllers. Throws 401 (with a `stepUp` payload) if a
 * challenge is needed and not yet satisfied; otherwise returns and the action
 * proceeds. Records the device as known after a satisfied challenge.
 */
export async function enforceStepUp(opts: {
  userId: string;
  action: StepUpAction;
  valueUsd: number;
  req: { headers: Record<string, any> };
  code?: string;
  /** The client asserts it just passed a LOCAL biometric (Face ID/Touch ID)
   *  check. Honoured ONLY on a trusted/known device — never on a new device,
   *  where biometric alone is insufficient and a server code is required. */
  biometricVerified?: boolean;
}): Promise<void> {
  const fp = deviceFingerprint(opts.req);
  const known = await isKnownDevice(opts.userId, fp);
  const highValue = Number.isFinite(opts.valueUsd) && opts.valueUsd >= STEP_UP_USD;

  // SECURITY MODEL:
  //  - `biometricVerified` is a flag the CLIENT sends; the server cannot
  //    verify it. It may only relax a routine-value confirmation on a known
  //    device. It never replaces a server-checked code for a high-value
  //    action — otherwise anyone holding a session token and the device
  //    headers could move any amount by sending `biometricVerified: true`.
  //  - New/unknown device OR high value → the server requires a real code
  //    (authenticator TOTP if 2FA on, else emailed code).
  if (known && !highValue && opts.biometricVerified) {
    await rememberDevice(opts.userId, fp, opts.req).catch(() => {});
    return;
  }

  if (!opts.code) {
    const { method } = await issueStepUp(opts.userId, opts.action);
    const why = !known ? 'new device' : highValue ? 'high-value action' : 'security';
    throw new AppError(
      `Security verification required (${why}). ` +
        `${method === 'totp' ? 'Enter your authenticator code.' : 'Enter the code we emailed you.'}`,
      401,
      'STEP_UP_REQUIRED',
      { method },
    );
  }

  await verifyStepUp(opts.userId, opts.action, opts.code);
  // Passed → trust this device going forward.
  await rememberDevice(opts.userId, fp, opts.req).catch(() => {});
}

/**
 * Risk-based variant for everyday payments (transfers, chat payments, claim
 * links): a routine amount from a recognised device goes through without a
 * prompt; a high-value amount or an unrecognised device must pass
 * `enforceStepUp` (local biometric only counts on a known device).
 */
export async function enforceRiskBasedStepUp(opts: {
  userId: string;
  action: StepUpAction;
  valueUsd: number;
  req: { headers: Record<string, any> };
  code?: string;
  biometricVerified?: boolean;
}): Promise<void> {
  const known = await isKnownDevice(opts.userId, deviceFingerprint(opts.req));
  const highValue = Number.isFinite(opts.valueUsd) && opts.valueUsd >= STEP_UP_USD;
  if (known && !highValue) return;
  await enforceStepUp(opts);
}
