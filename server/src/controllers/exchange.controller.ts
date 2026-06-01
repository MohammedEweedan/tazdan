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
  type SupportedAsset,
} from '../services/exchange/priceEngine.service';
import { executeQuote } from '../services/exchange/orderExecution.service';
import { getDexQuote, SUPPORTED_CHAINS, type ChainId } from '../services/dex/oneinch';
import { isLedgerCurrency } from '../services/ledger/ledger.service';
import { enforceStepUp } from '../services/security/stepUp.service';
import { sendBuyConfirmed, sendSellConfirmed } from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';
import { logger } from '../utils/logger';

const quoteSchema = z.object({
  asset: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  network: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  fiatAmount: z.union([z.string(), z.number()]).optional(),
  cryptoAmount: z.union([z.string(), z.number()]).optional(),
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

      const quote = await buildQuote({
        asset: body.asset,
        network: body.network,
        side: body.side,
        fiatAmount: body.fiatAmount,
        cryptoAmount: body.cryptoAmount,
        settlementCurrency: requested,
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
      if (!peek) throw new AppError('Quote expired or not found', 400);

      // Step-up gate (biometric-or-code).
      //  - Trusted device + Face ID (biometricVerified) → no code needed.
      //  - New device or high-value → server code required (authenticator TOTP
      //    if 2FA on, else emailed code). The client may send the code as
      //    `stepUpCode` (preferred) or legacy `twoFactorCode` — both accepted.
      const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactorEnabled: true } });
      if (!me?.twoFactorEnabled && process.env.EXCHANGE_REQUIRE_2FA === '1') {
        throw new AppError('Enable 2FA before trading', 403);
      }
      await enforceStepUp({
        userId: req.user!.id,
        action: (peek as any).side === 'SELL' ? 'sell' : 'buy',
        valueUsd: Number((peek as any).fiatAmount ?? 0),
        req,
        code: body.stepUpCode ?? body.twoFactorCode,
        biometricVerified: body.biometricVerified === true,
      });

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
      if (!allTickers) {
        const { data } = await axios.get<TickerRow[]>(
          `${BINANCE_REST}/api/v3/ticker/24hr`,
          { timeout: 8_000 },
        );
        allTickers = data;
        rSet(allKey, allTickers, 20).catch(() => { /* non-fatal */ });
      }

      // ── 3. Filter + rank ──────────────────────────────────────
      const results = (allTickers as TickerRow[])
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

      const payload = { results };
      rSet(qKey, payload, 10).catch(() => { /* non-fatal */ });

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
