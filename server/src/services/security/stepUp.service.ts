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
import { sendEmail } from '../email';
import { logger } from '../../utils/logger';

export const STEP_UP_USD = Number(process.env.STEP_UP_USD ?? '1000');
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
// Within this window, re-triggering an action reuses the existing code/email
// instead of sending another — prevents duplicate "your code" emails.
const RESEND_COOLDOWN_MS = 90_000;

export type StepUpAction = 'withdrawal' | 'buy' | 'sell' | 'transfer';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Stable device fingerprint from request headers (UA + a client-sent id). */
export function deviceFingerprint(req: { headers: Record<string, any> }): string {
  const ua = String(req.headers['user-agent'] ?? '');
  const devId = String(req.headers['x-device-id'] ?? '');
  return crypto.createHash('sha256').update(`${ua}::${devId}`).digest('hex').slice(0, 32);
}

/** Is this device already known/trusted for the user? */
export async function isKnownDevice(userId: string, fingerprint: string): Promise<boolean> {
  const d = await prisma.knownDevice.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
  });
  if (d) {
    // Touch lastSeen (best-effort).
    prisma.knownDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return !!d;
}

/** Remember a device after a successful step-up (or first trusted login). */
export async function rememberDevice(userId: string, fingerprint: string, label?: string): Promise<void> {
  await prisma.knownDevice.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    update: { lastSeenAt: new Date(), ...(label ? { label } : {}) },
    create: { userId, fingerprint, label },
  });
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

  // Idempotency: if a fresh, unconsumed challenge already exists (issued in the
  // last RESEND_COOLDOWN), reuse it instead of issuing a SECOND code/email.
  // This is what stops two emails when an action is (re)triggered quickly.
  const existing = await prisma.stepUpChallenge.findFirst({
    where: { userId, action, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { method: existing.method as 'email' | 'totp' };
  }

  // Otherwise clear stale challenges and issue a fresh one.
  await prisma.stepUpChallenge.deleteMany({ where: { userId, action, consumedAt: null } });

  if (user.twoFactorEnabled) {
    // TOTP path — verified live against the authenticator secret; we still
    // record a row so the action knows a challenge is outstanding.
    await prisma.stepUpChallenge.create({
      data: { userId, action, codeHash: 'TOTP', method: 'totp', expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return { method: 'totp' };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.stepUpChallenge.create({
    data: { userId, action, codeHash: hashCode(code), method: 'email', expiresAt: new Date(Date.now() + TTL_MS) },
  });
  await sendEmail({
    to: user.email,
    subject: `Your tazdan security code: ${code}`,
    html: `<p>Hi ${user.firstName || 'there'},</p>
      <p>Confirm your <b>${action}</b> with this code. It expires in 10 minutes.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>If you didn't request this, your account may be at risk — change your password and contact support.</p>`,
  }).catch((e) => logger.error('[stepUp] email send failed', { err: e }));
  return { method: 'email' };
}

/**
 * Verify a supplied code for (user, action). Consumes the challenge on success.
 * Throws AppError(401) on failure. For TOTP users, verifies the authenticator.
 */
export async function verifyStepUp(userId: string, action: StepUpAction, code: string | undefined): Promise<void> {
  if (!code || !/^\d{6}$/.test(code)) throw new AppError('A 6-digit security code is required', 401);

  // Check ALL active (unconsumed, unexpired) challenges for this action, not
  // just the latest — the issue + modal-request paths can both create one, and
  // the user's emailed code may match either. We consume whichever matches.
  const candidates = await prisma.stepUpChallenge.findMany({
    where: { userId, action, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (candidates.length === 0) throw new AppError('No active security challenge. Re-initiate the action.', 401);

  // Cheapest first: any TOTP challenge verifies against the authenticator.
  const hasTotp = candidates.some((c) => c.method === 'totp');
  let valid = false;
  if (hasTotp) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true } });
    if (user?.twoFactorSecret) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const speakeasy = require('speakeasy');
      valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 2 });
    }
  }
  if (!valid) {
    // Match the emailed code against any active email challenge.
    const h = hashCode(code);
    valid = candidates.some((c) => c.method === 'email' && c.codeHash === h);
  }

  if (!valid) {
    // Increment attempts on all candidates; if any hit the cap, clear them.
    await prisma.stepUpChallenge.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { attempts: { increment: 1 } },
    });
    const maxed = candidates.some((c) => c.attempts + 1 >= MAX_ATTEMPTS);
    if (maxed) {
      await prisma.stepUpChallenge.deleteMany({ where: { id: { in: candidates.map((c) => c.id) } } }).catch(() => {});
      throw new AppError('Too many attempts. Request a new code.', 429);
    }
    throw new AppError('Invalid security code', 401);
  }

  // Success — consume every active challenge for this action so a code can't
  // be replayed and stale challenges don't linger.
  await prisma.stepUpChallenge.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { consumedAt: new Date() },
  });
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
  /** When true, ALWAYS require a code (used for trades when 2FA is enabled),
   *  not just for high-value/new-device. Unifies the old separate 2FA gate. */
  alwaysRequire?: boolean;
}): Promise<void> {
  const fp = deviceFingerprint(opts.req);
  const known = await isKnownDevice(opts.userId, fp);
  const reason = opts.alwaysRequire
    ? '2fa'
    : stepUpRequired({ valueUsd: opts.valueUsd, knownDevice: known });
  if (!reason) return; // no step-up needed

  if (!opts.code) {
    const { method } = await issueStepUp(opts.userId, opts.action);
    const why = reason === 'new_device' ? 'new device' : reason === '2fa' ? '2FA' : 'high-value action';
    throw new AppError(
      `Security verification required (${why}). ` +
        `${method === 'totp' ? 'Enter your authenticator code.' : 'Enter the code we emailed you.'}`,
      401,
    );
  }

  await verifyStepUp(opts.userId, opts.action, opts.code);
  // Passed → trust this device going forward.
  await rememberDevice(opts.userId, fp).catch(() => {});
}
