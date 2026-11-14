/**
 * Credential checks shared by login and every password-gated security change.
 *
 *  - Identifiers are normalised once (emails are case-insensitive).
 *  - Unknown accounts cost the same as known ones: a REAL bcrypt hash at the
 *    production cost is compared, so response time does not reveal whether an
 *    email or handle is registered.
 *  - Login attempts are reserved atomically BEFORE the password is checked,
 *    so a burst of parallel guesses cannot all pass the lockout check before
 *    the first failure is written. Unknown identifiers lock out on exactly the
 *    same schedule, so "too many attempts" does not reveal an account either.
 *  - Password re-checks for sensitive changes (2FA on/off, password change)
 *    have their own per-account cap, so a stolen session cannot use them as
 *    an unthrottled password oracle.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/prisma';
import { clearAttempts, hasFlag, incrAttempts, reserveAttempt, setFlag } from '../../utils/redis';

export const BCRYPT_COST = 12;
export const LOGIN_FAILURE_THRESHOLD = 5;
const LOCK_TIER_MINUTES = [5, 15, 60];

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Login accepts an email or a @handle; both are matched lower-case. */
export function normalizeLoginIdentifier(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

// Handles that would let someone pose as the platform or its staff, also
// with dots/underscores in between (t.a.z.d.a.n, support_team…).
const RESERVED_HANDLE_PREFIXES = ['tazdan', 'admin', 'support', 'official', 'security', 'staff', 'compliance', 'moderator'];
const RESERVED_HANDLES = new Set([
  'root', 'system', 'platform', 'help', 'helpdesk', 'team', 'billing', 'payments', 'wallet', 'api', 'ops',
  'mod', 'service', 'info', 'contact', 'noreply', 'verify', 'verification', 'account', 'accounts', 'bank',
  'treasury', 'fulus', 'null', 'undefined', 'me', 'settings', 'search',
]);
export function isReservedHandle(handle: string): boolean {
  const bare = handle.toLowerCase().replace(/[._]/g, '');
  return RESERVED_HANDLES.has(bare) || RESERVED_HANDLE_PREFIXES.some((p) => bare.startsWith(p));
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Constant-time equality for two hex digests (or any two strings). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// A valid 60-character bcrypt hash at the production cost. (bcryptjs returns
// `false` instantly for a malformed hash, which is what the old hard-coded
// 63-character "dummy" did — unknown emails answered in ~0 ms, known ones in
// ~250 ms.)
let dummyHash: Promise<string> | null = null;
function dummyPasswordHash(): Promise<string> {
  if (!dummyHash) {
    // String salt from the sync generator: skips bcryptjs's async genSalt
    // step, whose failures surface inside setImmediate instead of rejecting.
    const pending = bcrypt.hash(crypto.randomBytes(18).toString('base64'), bcrypt.genSaltSync(BCRYPT_COST));
    dummyHash = pending;
    pending.catch(() => { if (dummyHash === pending) dummyHash = null; }); // retry next time; never unhandled
  }
  return dummyHash;
}
// Pre-warm on boot so the first unknown-account login is not slower than the
// rest. Not under jest: a background hash outliving a test file's teardown
// surfaced as an unhandled bcryptjs rejection.
if (process.env.NODE_ENV !== 'test') dummyPasswordHash().catch(() => undefined);

/** Spend one real bcrypt comparison without an account (always false). */
export async function burnPasswordCompare(password: string): Promise<false> {
  try {
    await bcrypt.compare(String(password), await dummyPasswordHash());
  } catch { /* timing filler only */ }
  return false;
}

function lockMinutes(failures: number): number {
  const tier = Math.min(LOCK_TIER_MINUTES.length, Math.floor(failures / LOGIN_FAILURE_THRESHOLD));
  return LOCK_TIER_MINUTES[Math.max(tier, 1) - 1];
}

/**
 * Reserve one login attempt on an existing account (compare-and-swap on the
 * counter). The attempt is counted before the password is checked and the
 * lockout is armed by the attempt that reaches the threshold, so concurrency
 * cannot buy extra guesses. Success resets the counter (`loginSucceeded`).
 * Returns false while the account is locked.
 */
export async function reserveAccountLoginAttempt(userId: string): Promise<boolean> {
  for (let i = 0; i < 6; i++) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true, lockoutUntil: true },
    });
    if (!u) return false;
    const now = new Date();
    if (u.lockoutUntil && u.lockoutUntil > now) return false;
    const next = u.failedLoginAttempts + 1;
    const claimed = await prisma.user.updateMany({
      where: { id: userId, failedLoginAttempts: u.failedLoginAttempts },
      data: {
        failedLoginAttempts: next,
        ...(next >= LOGIN_FAILURE_THRESHOLD
          ? { lockoutUntil: new Date(now.getTime() + lockMinutes(next) * 60_000) }
          : {}),
      },
    });
    if (claimed.count === 1) return true;
  }
  return false; // sustained contention on one account is an attack — refuse
}

/** The same schedule for identifiers that match no account. */
export async function reserveUnknownLoginAttempt(identifier: string): Promise<boolean> {
  const h = sha256(identifier);
  if (await hasFlag(`auth:login:nxlock:${h}`)) return false;
  const n = await incrAttempts(`auth:login:nx:${h}`, 24 * 60 * 60);
  if (n >= LOGIN_FAILURE_THRESHOLD) await setFlag(`auth:login:nxlock:${h}`, lockMinutes(n) * 60);
  return true;
}

export const SENSITIVE_PASSWORD_MAX_FAILURES = 5;
const SENSITIVE_WINDOW_SECONDS = 15 * 60;

const sensitiveKey = (userId: string) => `auth:pwcheck:${userId}`;

/**
 * Re-check the account password for a security change. At most 5 tries per
 * 15 minutes per account (reserved before bcrypt, so parallel guesses count).
 * The budget is shared by everything the change asks for (password AND any
 * authenticator code) and is only refilled by `sensitiveActionSucceeded`
 * once the whole change went through — a known password must not reset the
 * budget for guessing the code that comes after it.
 */
export async function verifyPasswordForSensitiveAction(
  userId: string, passwordHash: string, password: string,
): Promise<'ok' | 'invalid' | 'locked'> {
  const slot = await reserveAttempt(sensitiveKey(userId), SENSITIVE_PASSWORD_MAX_FAILURES, SENSITIVE_WINDOW_SECONDS);
  if (!slot.allowed) return 'locked';
  if (typeof password !== 'string' || typeof passwordHash !== 'string' || passwordHash.length !== 60) return 'invalid';
  const ok = await bcrypt.compare(password, passwordHash).catch(() => false);
  return ok ? 'ok' : 'invalid';
}

export async function sensitiveActionSucceeded(userId: string): Promise<void> {
  await clearAttempts(sensitiveKey(userId));
}
