/**
 * Layered rate limiters with optional simulator bypass.
 * - Production: fully enforced
 * - Dev / simulation: bypass allowed via x-simulator header
 *
 * Counters live in Redis when REDIS_URL is configured, so limits hold
 * across cluster workers and deploys. The default MemoryStore is
 * per-process: with CLUSTER_WORKERS=4 every limit silently became 4x,
 * and every restart reset all counters mid-attack. On a Redis outage
 * the limiters fail OPEN (passOnStoreError) — availability over
 * throttling — while the DB-backed per-account lockout in
 * auth.controller still protects credentials.
 */

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { recordStrike } from './ipBan';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

const minutes = (n: number) => n * 60 * 1000;

const isSimulatorRequest = (req: any) =>
  req.headers['x-simulator'] === 'true';

const skipRateLimit = (req: any) =>
  process.env.NODE_ENV !== 'production' && isSimulatorRequest(req);

/**
 * Redis-backed store, resolved lazily per command — the limiters are
 * constructed at import time, before initRedis() has connected.
 * Returns undefined when Redis is not configured (dev), which makes
 * express-rate-limit use its MemoryStore.
 */
function redisStore(prefix: string): RedisStore | undefined {
  if (!process.env.REDIS_URL?.trim()) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: async (...args: string[]) => {
      const client = getRedisClient();
      if (!client) throw new Error('Redis not ready');
      return client.sendCommand(args);
    },
  });
}

/** Shared options wiring for every limiter. */
function baseOpts(prefix: string) {
  return {
    standardHeaders: true as const,
    legacyHeaders: false,
    skip: skipRateLimit,
    store: redisStore(prefix),
    // Fail open on store errors (Redis blip ≠ platform outage).
    passOnStoreError: true,
  };
}

/**
 * Global limiter (baseline protection)
 */
export const globalLimiter = rateLimit({
  ...baseOpts('global'),
  windowMs: minutes(1),
  max: 300,
  message: { error: 'Too many requests, please slow down.' },
});

/**
 * Suspicious-pattern limiter — tight threshold for high-frequency IPs.
 * Triggers at 50 req/min (vs. 300 for globalLimiter).
 */
export const suspiciousLimiter = rateLimit({
  ...baseOpts('suspicious'),
  windowMs: minutes(1),
  max: 50,
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
  ...baseOpts('auth'),
  windowMs: minutes(15),
  max: 10,
  skipSuccessfulRequests: false,
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
  ...baseOpts('register'),
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10_000 : 5,
  message: { error: 'Too many registrations.' },
});

/**
 * Withdrawal limiter (money movement protection)
 */
export const withdrawalLimiter = rateLimit({
  ...baseOpts('withdrawal'),
  windowMs: minutes(10),
  max: 10,
  message: { error: 'Withdrawal rate limit hit. Slow down.' },
});

/**
 * Webhook limiter (protects against spam/replay floods)
 */
export const webhookLimiter = rateLimit({
  ...baseOpts('webhook'),
  windowMs: minutes(1),
  max: 120,
  message: { error: 'Webhook rate limit exceeded.' },
});

// Loud one-time notice if production is running without Redis — limits
// still enforce per-process, but cross-worker/cross-deploy consistency
// is gone.
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL?.trim()) {
  logger.warn('[rateLimiters] REDIS_URL not set — rate limits are per-process and reset on every deploy.');
}
