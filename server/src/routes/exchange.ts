import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { ExchangeController } from '../controllers/exchange.controller';
import { AuthRequest } from '../types';

export const exchangeRouter = Router();

// Per-user keyed rate limits (fall back to IP for unauthenticated hits).
const userKey = (req: AuthRequest) => req.user?.id ?? req.ip ?? 'anon';

const quoteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many quote requests. Please wait a moment.' },
});

const executeLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Order rate limit hit (10/hour). Try again later.' },
});

// Legacy rate pair endpoints (kept for the P2P / admin rate UI).
exchangeRouter.get('/rates', ExchangeController.getRates);
exchangeRouter.get('/rates/:base/:quote', ExchangeController.getRatePair);

// Custody trading (fiat ↔ crypto via Binance liquidity).
exchangeRouter.post('/quote',       authenticate, quoteLimiter,   ExchangeController.createQuote);
exchangeRouter.post('/execute',     authenticate, executeLimiter, ExchangeController.executeOrder);
exchangeRouter.get ('/orders',      authenticate,                 ExchangeController.listOrders);
exchangeRouter.get ('/orders/:id',  authenticate,                 ExchangeController.getOrder);

// DEX aggregator (crypto ↔ crypto on-chain via 1inch — read-only quote).
// Rate-limit: same quoteLimiter (5/min per user) is sufficient for a preview endpoint.
exchangeRouter.get('/dex/quote', authenticate, quoteLimiter, ExchangeController.getDexQuote);
