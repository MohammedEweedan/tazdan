import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { redisGet, redisSet, redisDel } from '../utils/redis';
import { collectFee } from '../services/fee/feeCollector.service';
import { postLedger, isLedgerCurrency } from '../services/ledger/ledger.service';
import { postAssetLedger, normaliseAsset } from '../services/ledger/assetLedger.service';
import { emitActivity } from '../utils/realtime';
import { sendP2PTradeUpdate } from '../services/email';
import { pushP2PTradeUpdate } from '../services/push.service';
import { logger } from '../utils/logger';

async function notifyTradeParties(
  tradeId: string, buyerId: string, sellerId: string,
  status: string, asset: string, amount: string,
) {
  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerId }, select: { email: true, firstName: true } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { email: true, firstName: true } }),
  ]);
  const sends: Promise<any>[] = [];
  if (buyer)  sends.push(sendP2PTradeUpdate({ to: buyer.email,  firstName: buyer.firstName,  status, asset, amount, tradeId }));
  if (seller) sends.push(sendP2PTradeUpdate({ to: seller.email, firstName: seller.firstName, status, asset, amount, tradeId }));
  sends.push(pushP2PTradeUpdate([buyerId, sellerId], status, asset, amount, tradeId));
  await Promise.all(sends).catch((e) => logger.warn('[email] p2p notify failed', { err: e }));
}

// ── Currencies that live in the Prisma Currency enum ────────────────
const ENUM_CURRENCIES = new Set([
  'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
  'USD','EUR','GBP','AED','SAR','EGP','LYD',
]);

const P2P_OFFERS_CACHE_KEY = 'p2p:offers:active';
const P2P_OFFERS_TTL = 10;

function resolveTicker(asset: string | null | undefined, fallback: string) {
  return asset ?? fallback;
}

function resolveListingAssets(listing: any) {
  const currency = resolveTicker(listing.baseAsset, listing.currency);
  const fiatCurrency = resolveTicker(listing.fiatAsset, listing.fiatCurrency);
  return {
    ...listing,
    currency,
    fiatCurrency,
    resolvedCurrency: currency,
    resolvedFiat: fiatCurrency,
  };
}

// ── Schemas ─────────────────────────────────────────────────────────

const createListingSchema = z.object({
  currency: z.string(),
  fiatCurrency: z.string().default('LYD'),
  side: z.enum(['BUY', 'SELL']),
  price: z.number().positive(),
  amount: z.number().positive(),
  minLimit: z.number().positive(),
  maxLimit: z.number().positive(),
  paymentMethods: z.array(z.string()).min(1),
  terms: z.string().max(1000).optional(),
  autoReply: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
  city: z.string().max(100).optional(),
  timeframeMins: z.number().int().min(5).max(10080).optional(),
});

const initTradeSchema = z.object({
  listingId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  note: z.string().max(500).optional(),
});

// ── Controller ──────────────────────────────────────────────────────

export class P2PController {
  // ── Listings ────────────────────────────────────────────────────

  /** Create a P2P listing */
  static async createListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createListingSchema.parse(req.body);

      const ticker    = data.currency.toUpperCase();
      const fiatTicker = data.fiatCurrency.toUpperCase();
      const isEnumCrypto = ENUM_CURRENCIES.has(ticker);
      const isEnumFiat   = ENUM_CURRENCIES.has(fiatTicker);

      const totalFiat = data.amount * data.price;
      if (data.minLimit > data.maxLimit) throw new AppError('Min limit must be <= max limit', 400);
      if (data.minLimit > totalFiat) throw new AppError(`Min limit must be <= total listing value (${totalFiat} ${fiatTicker})`, 400);
      if (data.maxLimit > totalFiat) throw new AppError(`Max limit must be <= total listing value (${totalFiat} ${fiatTicker})`, 400);

      // For SELL listings, verify seller has enough balance
      if (data.side === 'SELL') {
        if (isEnumCrypto) {
          const wallet = await prisma.wallet.findUnique({
            where: { userId_currency: { userId: req.user!.id, currency: ticker as any } },
          });
          if (!wallet) throw new AppError(`${ticker} wallet not found`, 404);
          const available = parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString());
          if (data.amount > available) throw new AppError(`Insufficient ${ticker} balance`, 400);
        } else {
          const uw = await prisma.userWallet.findUnique({ where: { userId: req.user!.id } });
          const alts = (uw?.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, string>;
          const available = parseFloat(alts[ticker] ?? '0');
          if (data.amount > available) throw new AppError(`Insufficient ${ticker} balance. Available: ${available}`, 400);
        }
      }

      const listing = await (prisma as any).p2PListing.create({
        data: {
          userId:        req.user!.id,
          currency:      isEnumCrypto ? ticker : 'USDT',
          baseAsset:     isEnumCrypto ? null : ticker,
          fiatCurrency:  isEnumFiat ? fiatTicker : 'USD',
          fiatAsset:     isEnumFiat ? null : fiatTicker,
          side:          data.side,
          price:         data.price,
          amount:        data.amount,
          minLimit:      data.minLimit,
          maxLimit:      data.maxLimit,
          paymentMethods: data.paymentMethods,
          terms:         data.terms,
          autoReply:     data.autoReply,
          anonymous:     data.anonymous ?? false,
          city:          data.city,
          timeframeMins: data.timeframeMins ?? 30,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true, kycStatus: true } },
        },
      });

      await redisDel(P2P_OFFERS_CACHE_KEY);
      const response = resolveListingAssets(listing);
      res.status(201).json({ listing: response });
    } catch (error) {
      next(error);
    }
  }

  /** Get active listings (public marketplace) */
  static async getListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const side = req.query.side as string | undefined;
      const currency = req.query.currency as string | undefined;

      const where: any = { status: 'ACTIVE' };
      if (side) where.side = side.toUpperCase();
      if (currency) {
        const ticker = currency.toUpperCase();
        where.OR = [
          { currency: ticker },
          { baseAsset: ticker },
        ];
      }

      const [listings, total] = await Promise.all([
        (prisma as any).p2PListing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, username: true, kycStatus: true } },
            _count: { select: { trades: true } },
          },
        }),
        (prisma as any).p2PListing.count({ where }),
      ]);

      const resolvedListings = listings.map(resolveListingAssets);
      res.json({ listings: resolvedListings, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/p2p/offers — public marketplace feed.
   *
   * Reshapes `P2PListing` rows into the `P2POffer` shape consumed by the
   * mobile + web UI. No auth required.
   */
  static async getOffers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit  = parseInt(req.query.limit as string)  || 50;
      const sideQ  = (req.query.side as string | undefined)?.toUpperCase();
      const currencyQ = (req.query.currency as string | undefined)?.toUpperCase();

      const canUseCache = !sideQ && !currencyQ && limit <= 100;
      let offers: any[] | undefined;

      if (canUseCache) {
        const cached = await redisGet<{ offers: any[] }>(P2P_OFFERS_CACHE_KEY);
        offers = cached?.offers;
      }

      const where: any = { status: 'ACTIVE' };
      if (sideQ === 'BUY' || sideQ === 'SELL') where.side = sideQ;
      if (currencyQ) {
        where.OR = [
          { currency: currencyQ },
          { baseAsset: currencyQ },
        ];
      }

      if (!offers) {
        const listings = await (prisma as any).p2PListing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 100),
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, username: true,
                kycStatus: true, country: true, avatarUrl: true,
                _count: { select: { p2pTradesAsBuyer: true, p2pTradesAsSeller: true } },
              },
            },
          },
        });

        offers = listings.map((l: any) => {
          const orders = (l.user._count?.p2pTradesAsBuyer ?? 0)
                       + (l.user._count?.p2pTradesAsSeller ?? 0);
          const remaining = Math.max(
            0,
            parseFloat(l.amount.toString()) - parseFloat(l.filled.toString()),
          );
          const trader = l.anonymous
            ? {
                handle: `@anon_${String(l.id).slice(0, 6)}`,
                name: 'Anonymous trader',
                rating: 4.7,
                orders,
                verified: l.user.kycStatus === 'APPROVED',
                avatarUrl: undefined,
                anonymous: true,
              }
            : {
                handle: l.user.username
                  ? `@${l.user.username}`
                  : `@${(l.user.firstName ?? 'user').toLowerCase()}`,
                name: `${l.user.firstName ?? ''} ${l.user.lastName ?? ''}`.trim() || 'Trader',
                rating: 4.7,
                orders,
                verified: l.user.kycStatus === 'APPROVED',
                avatarUrl: l.user.avatarUrl ?? undefined,
                anonymous: false,
              };
          return {
            id: l.id,
            side: l.side,
            trader,
            base: l.baseAsset ?? l.currency,
            quote: l.fiatAsset ?? l.fiatCurrency,
            price: l.price.toString(),
            available: remaining.toString(),
            minLimit: l.minLimit.toString(),
            maxLimit: l.maxLimit.toString(),
            paymentMethods: l.paymentMethods ?? [],
            country: l.anonymous ? undefined : (l.country ?? l.user.country ?? undefined),
            city: l.anonymous ? undefined : (l.city ?? undefined),
            timeframeMins: l.timeframeMins ?? 30,
          };
        });

        if (canUseCache) {
          await redisSet(P2P_OFFERS_CACHE_KEY, { offers }, P2P_OFFERS_TTL);
        }
      }

      if (offers && offers.length > limit) {
        offers = offers.slice(0, limit);
      }

      res.json({ offers });
    } catch (error) {
      next(error);
    }
  }

  /** Get my listings */
  static async getMyListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listings = await (prisma as any).p2PListing.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { trades: true } } },
      });
      const resolvedListings = listings.map(resolveListingAssets);
      res.json({ listings: resolvedListings });
    } catch (error) {
      next(error);
    }
  }

  /** Cancel a listing */
  static async cancelListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listing = await (prisma as any).p2PListing.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!listing) throw new AppError('Listing not found', 404);
      if (listing.status !== 'ACTIVE' && listing.status !== 'PAUSED')
        throw new AppError('Can only cancel active/paused listings', 400);

      await (prisma as any).p2PListing.update({
        where: { id: listing.id },
        data: { status: 'CANCELLED' },
      });

      await redisDel(P2P_OFFERS_CACHE_KEY);
      res.json({ message: 'Listing cancelled' });
    } catch (error) {
      next(error);
    }
  }

  // ── Trades ──────────────────────────────────────────────────────

  /** Initiate a trade on a listing */
  static async initiateTrade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = initTradeSchema.parse(req.body);

      const listing = await (prisma as any).p2PListing.findUnique({
        where: { id: data.listingId },
        include: { user: true },
      });
      if (!listing) throw new AppError('Listing not found', 404);
      if (listing.status !== 'ACTIVE') throw new AppError('Listing is not active', 400);
      if (listing.userId === req.user!.id) throw new AppError('Cannot trade with yourself', 400);

      // Check amount limits — data.amount is in crypto; minLimit/maxLimit are in fiat
      const listingPrice = parseFloat(listing.price.toString());
      const fiatAmount   = data.amount * listingPrice;
      const remaining    = parseFloat(listing.amount.toString()) - parseFloat(listing.filled.toString());
      const realTicker = (listing.baseAsset ?? listing.currency) as string;
      const resolvedFiat = listing.fiatAsset ?? listing.fiatCurrency;
      if (data.amount > remaining)
        throw new AppError(`Only ${remaining} ${realTicker} available`, 400);
      if (fiatAmount < parseFloat(listing.minLimit.toString()))
        throw new AppError(`Minimum is ${listing.minLimit} ${resolvedFiat}`, 400);
      if (fiatAmount > parseFloat(listing.maxLimit.toString()))
        throw new AppError(`Maximum is ${listing.maxLimit} ${resolvedFiat}`, 400);
      const reference = generateReference('P2P');

      // Determine buyer/seller
      const buyerId = listing.side === 'SELL' ? req.user!.id : listing.userId;
      const sellerId = listing.side === 'SELL' ? listing.userId : req.user!.id;

      const isEnumCrypto = ENUM_CURRENCIES.has(realTicker);

      // Lock escrow from seller's wallet. Wrapped in a transaction so the
      // `frozen` reservation and its double-entry ledger leg (seller USER →
      // SYSTEM_ESCROW) commit atomically — they can never drift apart.
      if (isEnumCrypto) {
        await prisma.$transaction(async (tx) => {
          const sellerWallet = await tx.wallet.findUnique({
            where: { userId_currency: { userId: sellerId, currency: realTicker as any } },
          });
          if (!sellerWallet) throw new AppError('Seller wallet not found', 404);
          const available = parseFloat(sellerWallet.balance.toString()) - parseFloat(sellerWallet.frozen.toString());
          if (data.amount > available) throw new AppError('Seller has insufficient balance for escrow', 400);
          await tx.wallet.update({
            where: { userId_currency: { userId: sellerId, currency: realTicker as any } },
            data: { frozen: { increment: new Decimal(data.amount) } },
          });
          if (isLedgerCurrency(realTicker)) {
            await postLedger(tx, {
              refType: 'p2p_escrow_lock',
              refId: listing.id,
              memo: `P2P escrow lock ${realTicker}`,
              legs: [
                { type: 'USER', userId: sellerId, currency: realTicker as any, amount: new Decimal(data.amount).neg() },
                { type: 'SYSTEM_ESCROW', currency: realTicker as any, amount: new Decimal(data.amount) },
              ],
            });
          }
        });
      } else {
        const uw = await prisma.userWallet.findUnique({ where: { userId: sellerId } });
        if (!uw) throw new AppError('Seller crypto wallet not provisioned', 404);
        const alts = (uw.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, string>;
        const available = parseFloat(alts[realTicker] ?? '0');
        if (data.amount > available) throw new AppError('Seller has insufficient balance for escrow', 400);
        await prisma.$transaction(async (tx) => {
          await postAssetLedger(tx as any, {
            refType: 'p2p_escrow_lock',
            refId: listing.id,
            memo: `P2P escrow lock ${realTicker}`,
            legs: [
              { type: 'USER', userId: sellerId, asset: normaliseAsset(realTicker), amount: new Decimal(data.amount).neg() },
              { type: 'SYSTEM_ESCROW', asset: normaliseAsset(realTicker), amount: new Decimal(data.amount) },
            ],
          }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
        });
      }

      const trade = await (prisma as any).p2PTrade.create({
        data: {
          listingId:    listing.id,
          buyerId,
          sellerId,
          currency:     isEnumCrypto ? realTicker : 'USDT',
          baseAsset:    isEnumCrypto ? null : realTicker,
          fiatCurrency: listing.fiatCurrency,
          fiatAsset:    listing.fiatAsset ?? null,
          cryptoAmount: data.amount,
          fiatAmount,
          price:        parseFloat(listing.price.toString()),
          escrowAmount: data.amount,
          status:       'ESCROW_FUNDED',
          reference,
          buyerNote:    listing.side === 'SELL' ? data.note : undefined,
          sellerNote:   listing.side === 'BUY' ? data.note : undefined,
          paymentMethod: data.paymentMethod || listing.paymentMethods[0],
          expiresAt:    new Date(Date.now() + (listing.timeframeMins ?? 30) * 60 * 1000),
        },
      });

      // Update listing filled amount
      await (prisma as any).p2PListing.update({
        where: { id: listing.id },
        data: {
          filled: { increment: new Decimal(data.amount) },
          status: parseFloat(listing.filled.toString()) + data.amount >= parseFloat(listing.amount.toString()) ? 'COMPLETED' : 'ACTIVE',
        },
      });

      // Notify seller
      await prisma.notification.create({
        data: {
          userId: sellerId,
          title: 'New P2P Trade',
          message: `Buyer wants ${data.amount} ${realTicker} for ${fiatAmount} ${resolvedFiat}. Ref: ${reference}`,
          type: 'p2p',
        },
      });

      res.status(201).json({ trade });
    } catch (error) {
      next(error);
    }
  }

  /** Mark payment sent (buyer action) */
  static async markPaymentSent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: { id: req.params.id, buyerId: req.user!.id },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (trade.status !== 'ESCROW_FUNDED') throw new AppError('Trade is not in the correct state', 400);

      await (prisma as any).p2PTrade.update({
        where: { id: trade.id },
        data: { status: 'PAYMENT_SENT' },
      });

      // Notify seller
      await prisma.notification.create({
        data: {
          userId: trade.sellerId,
          title: 'Payment Sent',
          message: `Buyer has marked payment as sent for trade ${trade.reference}. Please verify and release crypto.`,
          type: 'p2p',
        },
      });

      const realTickerPS = (trade.baseAsset ?? trade.currency) as string;
      notifyTradeParties(trade.id, trade.buyerId, trade.sellerId, 'PAYMENT_SENT', realTickerPS, trade.cryptoAmount?.toString() ?? '').catch(() => {});

      res.json({ message: 'Payment marked as sent' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seller confirms they received fiat payment → releases crypto from escrow
   * to buyer's wallet and moves trade to PAYMENT_CONFIRMED.
   * Buyer must then call /buyer-confirm to fully complete the trade.
   */
  static async confirmPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: { id: req.params.id, sellerId: req.user!.id },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (trade.status !== 'PAYMENT_SENT') throw new AppError('Buyer has not marked payment as sent', 400);

      // Release escrow: unfreeze from seller, transfer to buyer
      const realTicker = (trade.baseAsset ?? trade.currency) as string;
      const isEnumCrypto = ENUM_CURRENCIES.has(realTicker);

      await prisma.$transaction(async (tx: any) => {
        if (isEnumCrypto) {
          await tx.wallet.update({
            where: { userId_currency: { userId: trade.sellerId, currency: realTicker } },
            data: { balance: { decrement: trade.escrowAmount }, frozen: { decrement: trade.escrowAmount } },
          });
          await tx.wallet.upsert({
            where: { userId_currency: { userId: trade.buyerId, currency: realTicker } },
            update: { balance: { increment: trade.cryptoAmount } },
            create: { userId: trade.buyerId, currency: realTicker, balance: trade.cryptoAmount },
          });
          // Release escrow in the ledger: SYSTEM_ESCROW → buyer USER. Pairs
          // with the p2p_escrow_lock group; escrow nets back to zero.
          if (isLedgerCurrency(realTicker)) {
            await postLedger(tx, {
              refType: 'p2p_escrow_release',
              refId: trade.id,
              memo: `P2P escrow release ${realTicker}`,
              legs: [
                { type: 'SYSTEM_ESCROW', currency: realTicker as any, amount: new Decimal(trade.escrowAmount.toString()).neg() },
                { type: 'USER', userId: trade.buyerId, currency: realTicker as any, amount: new Decimal(trade.cryptoAmount.toString()) },
              ],
            }, { allowNegativeUser: true });
          }
        } else {
          const [sellerUW, buyerUW] = await Promise.all([
            tx.userWallet.findUnique({ where: { userId: trade.sellerId } }),
            tx.userWallet.findUnique({ where: { userId: trade.buyerId } }),
          ]);
          if (!sellerUW) throw new AppError('Seller crypto wallet not found', 404);
          if (!buyerUW)  throw new AppError('Buyer crypto wallet not found', 404);
          const sellerAlts = (sellerUW.altBalances && typeof sellerUW.altBalances === 'object' ? sellerUW.altBalances : {}) as Record<string, string>;
          const buyerAlts  = (buyerUW.altBalances  && typeof buyerUW.altBalances  === 'object' ? buyerUW.altBalances  : {}) as Record<string, string>;
          const escrow = parseFloat(trade.escrowAmount.toString());
          const crypto = parseFloat(trade.cryptoAmount.toString());
          const newSeller = Math.max(0, parseFloat(sellerAlts[realTicker] ?? '0') - escrow);
          const newBuyer  = parseFloat(buyerAlts[realTicker] ?? '0') + crypto;
          await tx.userWallet.update({ where: { userId: trade.sellerId }, data: { altBalances: { ...sellerAlts, [realTicker]: newSeller.toFixed(8) } } });
          await tx.userWallet.update({ where: { userId: trade.buyerId  }, data: { altBalances: { ...buyerAlts,  [realTicker]: newBuyer.toFixed(8)  } } });
          await postAssetLedger(tx as any, {
            refType: 'p2p_escrow_release',
            refId: trade.id,
            memo: `P2P escrow release ${realTicker}`,
            legs: [
              { type: 'SYSTEM_ESCROW', asset: normaliseAsset(realTicker), amount: new Decimal(trade.escrowAmount.toString()).neg() },
              { type: 'USER', userId: trade.buyerId, asset: normaliseAsset(realTicker), amount: new Decimal(trade.cryptoAmount.toString()) },
            ],
          }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
        }
        await (tx as any).p2PTrade.update({
          where: { id: trade.id },
          data: { status: 'PAYMENT_CONFIRMED' },
        });
      });

      await prisma.notification.create({
        data: {
          userId: trade.buyerId,
          title: 'Crypto Released',
          message: `${trade.cryptoAmount} ${realTicker} has been sent to your wallet. Please confirm receipt. Ref: ${trade.reference}`,
          type: 'p2p',
        },
      });

      res.json({ message: 'Payment confirmed, crypto sent to buyer' });
    } catch (error) {
      next(error);
    }
  }

  /** Buyer confirms they received the crypto → trade COMPLETED */
  static async buyerConfirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: { id: req.params.id, buyerId: req.user!.id },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (trade.status !== 'PAYMENT_CONFIRMED')
        throw new AppError('Seller has not confirmed payment yet', 400);

      await (prisma as any).p2PTrade.update({
        where: { id: trade.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const realTicker = (trade.baseAsset ?? trade.currency) as string;
      const isEnumCrypto = ENUM_CURRENCIES.has(realTicker);
      // Ledger currency for Transaction records — must be a valid enum value
      const ledgerCurrency = isEnumCrypto ? realTicker : 'USDT';

      // Look up the trading-fee percent (used by orders) and apply
      // half of it to each side of a P2P trade as the platform cut.
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: 'p2p_fee_percent' } })
        ?? await prisma.platformSettings.findUnique({ where: { key: 'trading_fee_percent' } });
      const feePercent = new Decimal(feeSetting?.value ?? '0.5');
      const cryptoAmount = new Decimal(trade.cryptoAmount.toString());
      const p2pFee = cryptoAmount.mul(feePercent).div(100);

      await prisma.$transaction(async (tx: any) => {
        const sellerWallet = isEnumCrypto ? await tx.wallet.findUnique({
          where: { userId_currency: { userId: trade.sellerId, currency: realTicker } },
        }) : null;
        const buyerWallet = isEnumCrypto ? await tx.wallet.findUnique({
          where: { userId_currency: { userId: trade.buyerId, currency: realTicker } },
        }) : null;
        await tx.transaction.createMany({
          data: [
            {
              userId: trade.sellerId, type: 'SELL', currency: ledgerCurrency,
              amount: new Decimal(-parseFloat(trade.cryptoAmount.toString())),
              fee: p2pFee,
              balanceBefore: parseFloat(sellerWallet?.balance.toString() || '0') + parseFloat(trade.cryptoAmount.toString()),
              balanceAfter:  parseFloat(sellerWallet?.balance.toString() || '0'),
              reference: trade.reference,
              description: `P2P Sale: ${trade.cryptoAmount} ${realTicker}`,
              metadata: { asset: realTicker, p2pFee: p2pFee.toString() },
            },
            {
              userId: trade.buyerId, type: 'BUY', currency: ledgerCurrency,
              amount: trade.cryptoAmount,
              fee: p2pFee,
              balanceBefore: parseFloat(buyerWallet?.balance.toString() || '0') - parseFloat(trade.cryptoAmount.toString()),
              balanceAfter:  parseFloat(buyerWallet?.balance.toString() || '0'),
              reference: trade.reference,
              description: `P2P Purchase: ${trade.cryptoAmount} ${realTicker}`,
              metadata: { asset: realTicker, p2pFee: p2pFee.toString() },
            },
          ],
        });

        // Pour the P2P trade fee into the platform wallet
        if (p2pFee.gt(0)) {
          await collectFee({
            tx,
            source:   'p2p_trade',
            sourceId: trade.id,
            payerId:  trade.sellerId,
            amount:   p2pFee,
            currency: realTicker,
            description: `P2P trade fee · ${realTicker}`,
            metadata: { buyerId: trade.buyerId, sellerId: trade.sellerId, reference: trade.reference },
          });
        }
      });

      await prisma.notification.create({
        data: {
          userId: trade.sellerId,
          title: 'Trade Completed',
          message: `Buyer confirmed receipt. Trade ${trade.reference} is fully complete.`,
          type: 'p2p',
        },
      });

      emitActivity(req, [trade.buyerId, trade.sellerId], { kind: 'p2p_trade', tradeId: trade.id });
      const realTickerC = (trade.baseAsset ?? trade.currency) as string;
      notifyTradeParties(trade.id, trade.buyerId, trade.sellerId, 'COMPLETED', realTickerC, trade.cryptoAmount?.toString() ?? '').catch(() => {});
      res.json({ message: 'Trade completed' });
    } catch (error) {
      next(error);
    }
  }

  /** Either party denies/rejects → auto-dispute */
  static async denyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: {
          id: req.params.id,
          OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
        },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (!['PAYMENT_SENT', 'PAYMENT_CONFIRMED'].includes(trade.status))
        throw new AppError('Can only deny during payment verification', 400);

      await (prisma as any).p2PTrade.update({
        where: { id: trade.id },
        data: { status: 'DISPUTED' },
      });

      const { reason } = req.body;
      await (prisma as any).p2PDispute.create({
        data: {
          tradeId: trade.id,
          raisedById: req.user!.id,
          reason: reason || 'Payment denied by counterparty',
        },
      });

      const otherId = req.user!.id === trade.buyerId ? trade.sellerId : trade.buyerId;
      await prisma.notification.create({
        data: {
          userId: otherId,
          title: 'Trade Disputed',
          message: `The counterparty denied the payment on trade ${trade.reference}. Support has been notified.`,
          type: 'p2p',
        },
      });

      const realTickerD = (trade.baseAsset ?? trade.currency) as string;
      notifyTradeParties(trade.id, trade.buyerId, trade.sellerId, 'DISPUTED', realTickerD, trade.cryptoAmount?.toString() ?? '').catch(() => {});
      res.json({ message: 'Trade disputed' });
    } catch (error) {
      next(error);
    }
  }

  /** Cancel a trade (either party, only if not yet paid) */
  static async cancelTrade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: {
          id: req.params.id,
          OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
        },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (!['AWAITING_ESCROW', 'ESCROW_FUNDED'].includes(trade.status)) {
        throw new AppError('Cannot cancel trade after payment is sent. Raise a dispute instead.', 400);
      }

      // Unfreeze escrow if it was funded. The `frozen` release and the ledger
      // refund (SYSTEM_ESCROW → seller USER) commit atomically; this pairs with
      // the p2p_escrow_lock group so escrow nets back to zero on cancel.
      if (trade.status === 'ESCROW_FUNDED') {
        const realTicker = (trade.baseAsset ?? trade.currency) as string;
        if (ENUM_CURRENCIES.has(realTicker)) {
          await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
              where: { userId_currency: { userId: trade.sellerId, currency: realTicker as any } },
              data: { frozen: { decrement: trade.escrowAmount } },
            });
            if (isLedgerCurrency(realTicker)) {
              await postLedger(tx, {
                refType: 'p2p_escrow_refund',
                refId: trade.id,
                memo: `P2P escrow refund ${realTicker}`,
                legs: [
                  { type: 'SYSTEM_ESCROW', currency: realTicker as any, amount: new Decimal(trade.escrowAmount.toString()).neg() },
                  { type: 'USER', userId: trade.sellerId, currency: realTicker as any, amount: new Decimal(trade.escrowAmount.toString()) },
                ],
              }, { allowNegativeUser: true });
            }
          });
        }
        else {
          await prisma.$transaction(async (tx) => {
            await postAssetLedger(tx as any, {
              refType: 'p2p_escrow_refund',
              refId: trade.id,
              memo: `P2P escrow refund ${realTicker}`,
              legs: [
                { type: 'SYSTEM_ESCROW', asset: normaliseAsset(realTicker), amount: new Decimal(trade.escrowAmount.toString()).neg() },
                { type: 'USER', userId: trade.sellerId, asset: normaliseAsset(realTicker), amount: new Decimal(trade.escrowAmount.toString()) },
              ],
            }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
          });
        }
      }

      await (prisma as any).p2PTrade.update({
        where: { id: trade.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // Return filled amount to listing
      await (prisma as any).p2PListing.update({
        where: { id: trade.listingId },
        data: {
          filled: { decrement: trade.cryptoAmount },
          status: 'ACTIVE',
        },
      });

      const realTickerX = (trade.baseAsset ?? trade.currency) as string;
      notifyTradeParties(trade.id, trade.buyerId, trade.sellerId, 'CANCELLED', realTickerX, trade.cryptoAmount?.toString() ?? '').catch(() => {});
      res.json({ message: 'Trade cancelled' });
    } catch (error) {
      next(error);
    }
  }

  /** Raise a dispute */
  static async raiseDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Strict validation: cap length and strip control chars. The reason is
      // shown to admins via notifications, so keep it plain text.
      const { reason: rawReason } = z
        .object({ reason: z.string().trim().min(10).max(1000) })
        .parse(req.body);

      // Drop anything outside printable ASCII.
      // eslint-disable-next-line no-control-regex
      const reason = rawReason.replace(/[^\x20-\x7E]/g, '').slice(0, 1000);
      if (reason.length < 10) {
        throw new AppError('Reason must be 10-1000 characters', 400);
      }

      const trade = await (prisma as any).p2PTrade.findFirst({
        where: {
          id: req.params.id,
          OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
        },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(trade.status)) {
        throw new AppError('Cannot dispute a completed/cancelled trade', 400);
      }

      await (prisma as any).p2PTrade.update({
        where: { id: trade.id },
        data: { status: 'DISPUTED' },
      });

      const dispute = await (prisma as any).p2PDispute.create({
        data: {
          tradeId: trade.id,
          raisedById: req.user!.id,
          reason,
        },
      });

      // Notify admins — do not embed user-supplied text in the title;
      // truncate body. The admin UI must still render this as text not HTML.
      const preview = reason.length > 140 ? `${reason.slice(0, 140)}…` : reason;
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: 'P2P Dispute Raised',
          message: `Dispute on trade ${trade.reference}: ${preview}`,
          type: 'p2p_dispute',
        })),
      });

      res.status(201).json({ dispute });
    } catch (error) {
      next(error);
    }
  }

  /** Get my trades */
  static async getMyTrades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const where = {
        OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
      };

      const [trades, total] = await Promise.all([
        (prisma as any).p2PTrade.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            listing: true,
            buyer: { select: { id: true, firstName: true, lastName: true, username: true } },
            seller: { select: { id: true, firstName: true, lastName: true, username: true } },
          },
        }),
        (prisma as any).p2PTrade.count({ where }),
      ]);

      const resolvedTrades = trades.map((trade: any) => ({
        ...trade,
        listing: trade.listing ? resolveListingAssets(trade.listing) : undefined,
      }));

      res.json({ trades: resolvedTrades, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }
}
