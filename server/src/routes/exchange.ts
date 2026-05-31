import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { ExchangeController } from '../controllers/exchange.controller';
import { AuthRequest } from '../types';

export const exchangeRouter = Router();

// Per-user keyed rate limits (fall back to IP for unauthenticated hits).
const userKey = (req: AuthRequest) => req.user?.id ?? req.ip ?? 'anon';

const isSimulator = (req: any) =>
  process.env.NODE_ENV !== 'production' && req.headers['x-simulator'] === 'true';

const quoteLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: userKey,
  skip: isSimulator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many quote requests. Please wait a moment.' },
});

const executeLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 40, // raised: step-up flows legitimately hit /execute 2-3× per order
  keyGenerator: userKey,
  skip: isSimulator,
  // Don't count step-up challenges / auth prompts (401) against the limit —
  // only completed/declined orders should burn the quota. Otherwise a single
  // order that triggers a 6-digit prompt eats several "attempts".
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Order rate limit hit. Please wait a bit and try again.' },
});

// Legacy rate pair endpoints (kept for the P2P / admin rate UI).
exchangeRouter.get('/rates', ExchangeController.getRates);
exchangeRouter.get('/rates/:base/:quote', ExchangeController.getRatePair);

// Fiat FX rate for pairs not on Binance (USD/LYD etc.). Admin override
// → external API → stale fallback inside the service layer.
exchangeRouter.get('/fx/:base/:quote', ExchangeController.getFxRate);

// Custody trading (fiat ↔ crypto via Binance liquidity).
exchangeRouter.post('/quote',       authenticate, quoteLimiter,   ExchangeController.createQuote);
exchangeRouter.post('/execute',     authenticate, executeLimiter, ExchangeController.executeOrder);
exchangeRouter.get ('/orders',      authenticate,                 ExchangeController.listOrders);
exchangeRouter.get ('/orders/:id',  authenticate,                 ExchangeController.getOrder);

// Asset search — queries Binance 24hr ticker, returns any tradeable USDT pair.
exchangeRouter.get('/search', authenticate, ExchangeController.searchAssets);

// DEX aggregator (crypto ↔ crypto on-chain via 1inch — read-only quote).
exchangeRouter.get('/dex/quote', authenticate, quoteLimiter, ExchangeController.getDexQuote);
