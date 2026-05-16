/**
 * Layered rate limiters. The global limiter is for everything; the
 * sensitive limiters are mounted on the highest-blast-radius endpoints
 * (auth + money movement). All keyed by req.ip — behind a reverse proxy
 * make sure `app.set('trust proxy', 1)` is configured.
 */
import rateLimit from 'express-rate-limit';

const minutes = (n: number) => n * 60 * 1000;

export const globalLimiter = rateLimit({
  windowMs: minutes(1),
  max: 300,                          // ~5 rps avg per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Login / password reset / 2FA. Stops credential stuffing & brute force.
export const authLimiter = rateLimit({
  windowMs: minutes(15),
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,      // only count failed attempts
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

// Registration: cap accounts/hour/IP to deter mass-signup abuse.
export const registerLimiter = rateLimit({
  windowMs: minutes(60),
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts from this IP. Try again later.' },
});

// Withdrawal endpoints — cap aggressive automation.
export const withdrawalLimiter = rateLimit({
  windowMs: minutes(10),
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Withdrawal rate limit hit. Slow down.' },
});

// Deposit webhook — protects against replay floods.
export const webhookLimiter = rateLimit({
  windowMs: minutes(1),
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
});
