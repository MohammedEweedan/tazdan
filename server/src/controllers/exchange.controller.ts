import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Server as IOServer } from 'socket.io';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import {
  buildQuote,
  getQuote,
  getConfiguredSpread,
  type SupportedAsset,
} from '../services/exchange/priceEngine.service';
import { executeQuote } from '../services/exchange/orderExecution.service';
import { getDexQuote, SUPPORTED_CHAINS, type ChainId } from '../services/dex/oneinch';
import { isLedgerCurrency } from '../services/ledger/ledger.service';
import { enforceStepUp } from '../services/security/stepUp.service';
import { sendBuyConfirmed, sendSellConfirmed } from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';
import { logger } from '../utils/logger';
import { isFeatureEnabled } from '../utils/features';

const positiveAmount = z.union([z.string(), z.number()]).refine(
  (v) => { const n = Number(v); return Number.isFinite(n) && n > 0; },
  { message: 'Amount must be greater than zero' },
);

const quoteSchema = z.object({
  asset: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  network: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  fiatAmount: positiveAmount.optional(),
  cryptoAmount: positiveAmount.optional(),
  // BUY: fiat wallet to fund from. SELL: fiat/stablecoin wallet to receive into.
  // Required. Never default, because defaulting silently moves the wrong wallet.
  receiveCurrency: z.string().min(1).max(10).optional(),
  fundingCurrency: z.string().min(1).max(10).optional(),
});

const executeSchema = z.object({
  quoteId: z.string().min(1),
  confirmedByUser: z.literal(true),
  idempotencyKey: z.string().min(8).max(128).optional(),
  // Required when the user has 2FA enabled (we re-check server-side).
  twoFactorCode: z.string().min(6).max(8).optional(),
  // 6-digit step-up code for high-value (≥$1000) or new-device trades.
  stepUpCode: z.string().regex(/^\d{6}$/).optional(),
  // Client asserts a local biometric (Face ID/Touch ID) just passed. Honoured
  // only on a trusted device; ignored on a new device (code required there).
  biometricVerified: z.boolean().optional(),
});

export class ExchangeController {
  static async getRates(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await prisma.exchangeRate.findMany({ where: { isActive: true } });
      res.json({ rates });
    } catch (error) {
      next(error);
    }
  }

  static async getRatePair(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const rate = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: base.toUpperCase() as any, quoteCurrency: quote.toUpperCase() as any } },
      });
      res.json({ rate });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchange/spread
   * Public — the disclosed quote spread fraction (e.g. 0.025 = 2.5%). The
   * mobile charts use it to render marked-up prices so the line/candles and
   * the buy/sell markers all live in the same price space the user transacts at.
   */
  static async getSpread(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const spread = await getConfiguredSpread();
      res.json({ spreadPct: spread.toString() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchange/fx/:base/:quote
   * Live FX rate with admin-override → API → stale fallback. Surfaced
   * by the mobile UI for any pair that doesn't trade on Binance —
   * primarily fiat/fiat pairs like USD/LYD.
   */
  static async getFxRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const baseU  = base.toUpperCase();
      const quoteU = quote.toUpperCase();
      const { getRate } = await import('../services/exchange/fxRateProvider.service');
      const rate = await getRate(baseU, quoteU);
      res.json({ base: baseU, quote: quoteU, ...rate });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/exchange/webhook/fulus
   * Public webhook — Fulus POSTs a `rate.created` event whenever a new LYD
   * parallel-market rate is published. We verify the X-Webhook-Signature HMAC
   * over the RAW body, then push the cash rate into the Fulus cache so quotes
   * reflect it instantly (no polling round-trip). Bank rates are acknowledged
   * but not yet fed into pricing.
   *
   * Always returns 2xx on a verified payload (even when we choose not to act on
   * it) so Fulus doesn't retry needlessly; only signature failures return 401.
   */
  static async fulusWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { verifyFulusSignature, noteFulusRate } = await import('../services/exchange/fulus.service');
      // The raw body is captured by express.json's `verify` hook (see index.ts).
      const raw = (req as any).rawBody ?? JSON.stringify(req.body);
      const sig = req.headers['x-webhook-signature'] as string | undefined;
      if (!verifyFulusSignature(sig, raw)) {
        logger.warn('[fulus.webhook] invalid signature', { hasSig: Boolean(sig) });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const body = req.body as {
        event?: string;
        data?: { currency?: string; rate?: string | number; rate_type?: string; bank_name?: string | null };
      };
      const d = body?.data;
      if (body?.event === 'rate.created' && d?.currency && d?.rate != null) {
        const rate = typeof d.rate === 'string' ? parseFloat(d.rate) : d.rate;
        // Only cash rates feed FIAT/LYD pricing; bank rates are logged for now.
        if (d.rate_type === 'bank') {
          logger.info('[fulus.webhook] bank rate (not yet priced)', { bank: d.bank_name, currency: d.currency, rate });
        } else if (Number.isFinite(rate)) {
          const accepted = noteFulusRate(d.currency, rate, 'webhook');
          // Drop every cache that can surface the old rate so the next quote,
          // public rates map, and admin panel reflect the webhook immediately.
          if (accepted) {
            const code = d.currency.toUpperCase();
            const { getRate, invalidateRate } = await import('../services/exchange/fxRateProvider.service');
            invalidateRate(code, 'LYD');
            invalidateRate('LYD', code);
            const { invalidateRatesCache } = await import('../routes/rates');
            invalidateRatesCache();

            // Force one fresh pricing pass. This persists the Fulus-backed
            // buy/sell row as isActive=false, so admin storage follows the
            // live feed without creating a manual override.
            const fresh = await getRate(code, 'LYD').catch(() => null);

            const io = req.app.get('io') as IOServer | undefined;
            io?.to('prices').emit('price:update', {
              baseCurrency: code,
              quoteCurrency: 'LYD',
              buyPrice: fresh?.buyPrice,
              sellPrice: fresh?.sellPrice,
              source: fresh?.source ?? 'live:fulus',
            });
            logger.info('[fulus.webhook] cash rate updated', { currency: code, rate, source: fresh?.source });
          }
        }
      }

      // Acknowledge regardless — an unverified-but-signed event we don't act on
      // is still a successful delivery from Fulus's perspective.
      return res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/exchange/quote
  static async createQuote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = quoteSchema.parse(req.body);
      if (body.side === 'BUY' && body.fiatAmount == null) {
        throw new AppError('fiatAmount required for BUY', 400);
      }
      if (body.side === 'SELL' && body.cryptoAmount == null) {
        throw new AppError('cryptoAmount required for SELL', 400);
      }

      // AIRTIGHT SETTLEMENT CURRENCY:
      // The wallet that funds a BUY / receives a SELL must be explicit and a
      // real wallet currency. We DO NOT silently default to USDT/USD — that
      // is exactly what caused trades to debit/credit the wrong wallet. If the
      // client doesn't say which currency, the quote is rejected.
      const requested = (body.side === 'SELL' ? body.receiveCurrency : body.fundingCurrency)?.toUpperCase();
      if (!requested) {
        throw new AppError(
          body.side === 'SELL'
            ? 'receiveCurrency is required (which wallet receives the proceeds)'
            : 'fundingCurrency is required (which wallet pays for this)',
          400,
        );
      }
      if (!isLedgerCurrency(requested)) {
        throw new AppError(`Unsupported settlement currency: ${requested}`, 400);
      }
      // Cannot settle an asset into/from itself (e.g. sell USDT → USDT).
      if (requested === body.asset) {
        throw new AppError(`Settlement currency must differ from the asset (${body.asset})`, 400);
      }

      // Long-tail coins (outside the ledger's currency set) have no
      // double-entry coverage yet. While FEATURE_ALT_TRADING is off, users
      // can still sell what they hold but not buy more.
      if (body.side === 'BUY' && !isLedgerCurrency(body.asset) && !isFeatureEnabled('altTrading')) {
        throw new AppError(`Buying ${body.asset} is temporarily unavailable`, 503);
      }

      const quote = await buildQuote({
        asset: body.asset,
        network: body.network,
        side: body.side,
        fiatAmount: body.fiatAmount,
        cryptoAmount: body.cryptoAmount,
        settlementCurrency: requested,
        userId: req.user!.id,
      });
      res.json({ quote });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/exchange/execute
  static async executeOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = executeSchema.parse(req.body);
      // Surface the quote before consumption so the client can re-render
      // even on the 400 expired path.
      const peek = await getQuote(body.quoteId);
      if (!peek || (peek.userId && peek.userId !== req.user!.id)) {
        throw new AppError('Quote expired or not found', 400);
      }

      // Step-up gate (biometric-or-code).
      //  - Trusted device + Face ID (biometricVerified) → no code needed.
      //  - New device or high-value → server code required (authenticator TOTP
      //    if 2FA on, else emailed code). The client may send the code as
      //    `stepUpCode` (preferred) or legacy `twoFactorCode` — both accepted.
      const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactorEnabled: true } });
      if (!me?.twoFactorEnabled && process.env.EXCHANGE_REQUIRE_2FA === '1') {
        throw new AppError('Enable 2FA before trading', 403);
      }
      try {
        await enforceStepUp({
          userId: req.user!.id,
          action: (peek as any).side === 'SELL' ? 'sell' : 'buy',
          valueUsd: Number((peek as any).fiatAmount ?? 0),
          req,
          code: body.stepUpCode ?? body.twoFactorCode,
          biometricVerified: body.biometricVerified === true,
        });
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401 && /security|verification|challenge|authenticator|code/i.test(error.message)) {
          return res.status(401).json({ requiresStepUp: true, error: error.message });
        }
        throw error;
      }

      const order = await executeQuote({
        userId: req.user!.id,
        quoteId: body.quoteId,
        idempotencyKey: body.idempotencyKey,
      });

      // Fire-and-forget socket notification to the user's room.
      const io = req.app.get('io') as IOServer | undefined;
      io?.to(`user:${req.user!.id}`).emit('order:executed', {
        id: order.id,
        asset: order.asset,
        network: order.network,
        type: order.type,
        status: order.status,
        cryptoAmount: order.cryptoAmount.toString(),
        quotedPrice: order.quotedPrice.toString(),
      });

      // Transactional email + push confirmation. Fire-and-forget — must
      // never throw or block the response. Honors per-user notification
      // preferences (defaults to true if the field is missing).
      const userId = req.user!.id;
      const side   = (order as any).type as 'BUY' | 'SELL';
      const status = (order as any).status as string;
      if (status === 'FILLED' || status === 'COMPLETED' || status === 'SETTLED') {
        (async () => {
          try {
            const u = await prisma.user.findUnique({
              where: { id: userId },
              select: { email: true, firstName: true, notificationPrefs: true as any },
            });
            if (!u) return;
            const prefs = (u as any).notificationPrefs ?? {};
            const fiatCurrency = (order as any).fiatCurrency || (peek as any).fiatCurrency || 'USD';
            const cryptoAmt = order.cryptoAmount.toString().replace(/\.?0+$/, '');
            const fiatAmt   = ((order as any).fiatAmount ?? (peek as any).fiatAmount ?? '0').toString().replace(/\.?0+$/, '');
            const rate      = order.quotedPrice.toString().replace(/\.?0+$/, '');
            const fees      = ((order as any).fee ?? (peek as any).fee ?? '0').toString().replace(/\.?0+$/, '');

            if (side === 'BUY') {
              if (prefs?.email?.trades !== false) {
                await sendBuyConfirmed({
                  to: u.email, firstName: u.firstName || 'there',
                  asset: order.asset, amount: cryptoAmt,
                  fiatSpent: fiatAmt, fiatCurrency,
                  rate, fees, orderId: order.id,
                });
              }
              if (prefs?.push?.trades !== false) {
                await pushTxEvent(userId, pushCopy.buy(cryptoAmt, order.asset), order.id);
              }
            } else if (side === 'SELL') {
              if (prefs?.email?.trades !== false) {
                await sendSellConfirmed({
                  to: u.email, firstName: u.firstName || 'there',
                  asset: order.asset, amount: cryptoAmt,
                  fiatReceived: fiatAmt, fiatCurrency,
                  rate, fees, orderId: order.id,
                });
              }
              if (prefs?.push?.trades !== false) {
                await pushTxEvent(userId, pushCopy.sell(cryptoAmt, order.asset, `${fiatAmt} ${fiatCurrency}`), order.id);
              }
            }
          } catch (err) {
            logger.warn('[exchange.execute] post-fill notify failed', { userId, orderId: order.id, err });
          }
        })();
      }

      res.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/exchange/orders
  static async listOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const [items, total] = await Promise.all([
        prisma.cryptoOrder.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.cryptoOrder.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({ orders: items, total, page, limit });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/exchange/orders/:id
  static async getOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await prisma.cryptoOrder.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!order) throw new AppError('Order not found', 404);
      res.json({ order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchange/search?q=doge
   * Returns matching Binance USDT pairs with live price.
   * Used by the mobile asset picker to support any tradeable token.
   *
   * Strategy: the full 24hr ticker list is cached in Redis for 20 s (it is
   * large — ~1 200 pairs). Per-query results are also cached for 10 s so
   * repeated identical searches (very common when a user types slowly) are
   * served entirely from memory without any Binance round-trip.
   */
  static async searchAssets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { redisGet: rGet, redisSet: rSet } = await import('../utils/redis');
      const q = String(req.query.q ?? '').toUpperCase().trim();
      const BINANCE_REST = process.env.BINANCE_REST_URL || 'https://api.binance.com';

      // ── 1. Per-query cache (10 s) ─────────────────────────────
      const qKey = `search:${q}`;
      const qCached = await rGet<{ results: unknown[] }>(qKey);
      if (qCached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(qCached);
      }

      // ── 2. Full ticker list cache (20 s) ──────────────────────
      type TickerRow = { symbol: string; lastPrice: string; priceChangePercent: string; volume: string };
      const allKey = 'search:all_tickers';
      let allTickers = await rGet<TickerRow[]>(allKey);
      let fromFallback = false;
      if (!allTickers) {
        try {
          const { data } = await axios.get<TickerRow[]>(
            `${BINANCE_REST}/api/v3/ticker/24hr`,
            { timeout: 8_000 },
          );
          allTickers = data;
          rSet(allKey, allTickers, 20).catch(() => { /* non-fatal */ });
        } catch (err) {
          // Binance is 451/geo-blocked on many production hosts. Don't 500 the
          // search/asset picker — fall back to a curated supported-asset set
          // priced via the resilient multi-provider price engine.
          logger.warn('[exchange.search] Binance ticker list failed — using fallback assets', {
            status: (err as any)?.response?.status,
          });
          fromFallback = true;
        }
      }

      let results: Array<{ symbol: string; price: number; change24h: number; volume24h: number; name?: string }>;
      if (allTickers && !fromFallback) {
        // ── 3a. Filter + rank the full Binance list ─────────────
        results = (allTickers as TickerRow[])
          .filter((t) => t.symbol.endsWith('USDT'))
          .map((t) => ({
            symbol:    t.symbol.replace('USDT', ''),
            price:     parseFloat(t.lastPrice),
            change24h: parseFloat(t.priceChangePercent),
            volume24h: parseFloat(t.volume),
          }))
          .filter((t) => !q || t.symbol.includes(q))
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 50);

        // ── 3a-bis. Broaden coverage with CoinGecko search — it aggregates
        //   listings across EVERY exchange, so tokens not on Binance still
        //   surface. Merge any coins the Binance list missed (no live price
        //   from CG search; the price engine fills it on selection). Only when
        //   the user has typed a query (CG search needs a term). ───
        if (q && q.length >= 2) {
          try {
            const cg = await axios.get<{ coins: Array<{ symbol: string; name: string; market_cap_rank: number | null }> }>(
              `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
              { timeout: 6_000 },
            );
            const have = new Set(results.map((r) => r.symbol));
            const extra = (cg.data?.coins ?? [])
              .map((c) => ({ symbol: c.symbol.toUpperCase(), name: c.name, rank: c.market_cap_rank ?? 9e9 }))
              .filter((c) => c.symbol.includes(q) && !have.has(c.symbol))
              .sort((a, b) => a.rank - b.rank)
              .slice(0, 25)
              .map((c) => ({ symbol: c.symbol, price: 0, change24h: 0, volume24h: 0, name: c.name }));
            results = [...results, ...extra];
          } catch {
            /* CG is best-effort — Binance results already returned */
          }
        }
      } else {
        // ── 3b. Fallback: curated supported assets, priced resiliently ──
        const { getMarketPrice } = await import('../services/exchange/priceEngine.service');
        const FALLBACK_ASSETS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'TRX', 'LINK', 'MATIC', 'DOT', 'AVAX'];
        const candidates = FALLBACK_ASSETS.filter((a) => !q || a.includes(q));
        const priced = await Promise.all(
          candidates.map(async (asset) => {
            if (asset === 'USDT' || asset === 'USDC') return { symbol: asset, price: 1, change24h: 0, volume24h: 0 };
            try {
              const p = await getMarketPrice(`${asset}USDT`);
              return { symbol: asset, price: p.toNumber(), change24h: 0, volume24h: 0 };
            } catch {
              return null; // no price from any provider — drop it
            }
          }),
        );
        results = priced.filter((r): r is NonNullable<typeof r> => r !== null);

        // When Binance is blocked, still give broad coverage via CoinGecko's
        // cross-exchange search so the picker isn't limited to 14 assets.
        if (q && q.length >= 2) {
          try {
            const cg = await axios.get<{ coins: Array<{ symbol: string; name: string; market_cap_rank: number | null }> }>(
              `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
              { timeout: 6_000 },
            );
            const have = new Set(results.map((r) => r.symbol));
            const extra = (cg.data?.coins ?? [])
              .map((c) => ({ symbol: c.symbol.toUpperCase(), name: c.name, rank: c.market_cap_rank ?? 9e9 }))
              .filter((c) => c.symbol.includes(q) && !have.has(c.symbol))
              .sort((a, b) => a.rank - b.rank)
              .slice(0, 25)
              .map((c) => ({ symbol: c.symbol, price: 0, change24h: 0, volume24h: 0, name: c.name }));
            results = [...results, ...extra];
          } catch {
            /* best-effort */
          }
        }
      }

      const payload = { results };
      // Don't cache the degraded fallback as long as the healthy path.
      rSet(qKey, payload, fromFallback ? 30 : 10).catch(() => { /* non-fatal */ });

      res.setHeader('X-Cache', 'MISS');
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchange/dex/quote?fromToken=ETH&toToken=USDT&amount=1000000000000000000&chain=ETH
   *
   * Returns the best on-chain swap quote from the 1inch aggregator.
   * `amount` must be in the source token's smallest unit (wei for ETH).
   * `chain` must be one of: ETH, BNB, POLYGON, AVAX (defaults to ETH).
   *
   * This is a read-only price check — no funds move. Use the
   * onchainSettlement service to execute the actual swap.
   */
  static async getDexQuote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const fromToken = String(req.query.fromToken ?? '').toUpperCase();
      const toToken   = String(req.query.toToken   ?? '').toUpperCase();
      const amount    = String(req.query.amount ?? '');
      const chain     = String(req.query.chain ?? 'ETH').toUpperCase();

      if (!fromToken || !toToken) throw new AppError('fromToken and toToken are required', 400);
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new AppError('amount must be a positive integer (token native units)', 400);
      }

      const chainId = (SUPPORTED_CHAINS[chain] ?? 1) as ChainId;
      const quote = await getDexQuote({ fromToken, toToken, amount, chainId });

      res.json({ quote });
    } catch (error: any) {
      if (error?.response?.status === 400) {
        return next(new AppError(error.response.data?.description ?? 'DEX quote failed', 400));
      }
      next(error);
    }
  }
}
