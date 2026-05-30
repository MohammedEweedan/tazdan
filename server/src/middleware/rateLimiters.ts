/**
 * Layered rate limiters with optional simulator bypass.
 * - Production: fully enforced
 * - Dev / simulation: bypass allowed via x-simulator header
 */

import rateLimit from 'express-rate-limit';
import { recordStrike } from './ipBan';

const minutes = (n: number) => n * 60 * 1000;

const isSimulatorRequest = (req: any) =>
  req.headers['x-simulator'] === 'true';

const skipRateLimit = (req: any) =>
  process.env.NODE_ENV !== 'production' && isSimulatorRequest(req);

/**
 * Global limiter (baseline protection)
 */
export const globalLimiter = rateLimit({
  windowMs: minutes(1),
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: 'Too many requests, please slow down.' },
});

/**
 * Suspicious-pattern limiter — tight threshold for high-frequency IPs.
 * Triggers at 50 req/min (vs. 300 for globalLimiter).
 */
export const suspiciousLimiter = rateLimit({
  windowMs: minutes(1),
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  handler: (req, res) => {
    recordStrike(req.ip ?? '');
    res.set('Retry-After', '60');
    res.status(429).json({ message: 'Too many requests. Please try again later.' });
  },
});

/**
 * Auth limiter (login / password reset / 2FA)
 *
 * `skipSuccessfulRequests` is intentionally false.  Setting it to
 * true would let an attacker who has a stolen password brute-force
 * the 6-digit TOTP code unbounded — the per-account password check
 * succeeds, the server returns `requires2FA: true` with status 200,
 * the limiter skips the request, and they get another free guess.
 * Counting every request closes that amplification, at the cost of
 * a legit user hitting the limit faster if they spam login (10 in
 * 15min is still very generous for human use).
 */
export const authLimiter = rateLimit({
  windowMs: minutes(15),
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: skipRateLimit,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
  handler: (req, res) => {
    recordStrike(req.ip ?? '');
    res.status(429).json({ message: 'Too many attempts. Please try again later.' });
  },
});

/**
 * Registration limiter (most important for your issue)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10_000 : 5,
  skip: skipRateLimit,
  message: { error: 'Too many registrations.' },
});

/**
 * Withdrawal limiter (money movement protection)
 */
export const withdrawalLimiter = rateLimit({
  windowMs: minutes(10),
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: 'Withdrawal rate limit hit. Slow down.' },
});

/**
 * Webhook limiter (protects against spam/replay floods)
 */
export const webhookLimiter = rateLimit({
  windowMs: minutes(1),
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: 'Webhook rate limit exceeded.' },
});
