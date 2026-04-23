import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';

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

      if (data.minLimit > data.maxLimit) throw new AppError('Min limit must be <= max limit', 400);
      if (data.minLimit > data.amount) throw new AppError('Min limit must be <= total amount', 400);

      // For SELL listings, verify seller has enough balance
      if (data.side === 'SELL') {
        const wallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: data.currency as any } },
        });
        if (!wallet) throw new AppError(`${data.currency} wallet not found`, 404);
        const available = parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString());
        if (data.amount > available) throw new AppError(`Insufficient ${data.currency} balance`, 400);
      }

      const listing = await (prisma as any).p2PListing.create({
        data: {
          userId: req.user!.id,
          currency: data.currency,
          fiatCurrency: data.fiatCurrency,
          side: data.side,
          price: data.price,
          amount: data.amount,
          minLimit: data.minLimit,
          maxLimit: data.maxLimit,
          paymentMethods: data.paymentMethods,
          terms: data.terms,
          autoReply: data.autoReply,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true, kycStatus: true } },
        },
      });

      res.status(201).json({ listing });
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
      if (currency) where.currency = currency.toUpperCase();

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

      res.json({ listings, total, page, totalPages: Math.ceil(total / limit) });
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
      res.json({ listings });
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

      // Check amount limits
      const remaining = parseFloat(listing.amount.toString()) - parseFloat(listing.filled.toString());
      if (data.amount > remaining) throw new AppError(`Only ${remaining} ${listing.currency} available`, 400);
      if (data.amount < parseFloat(listing.minLimit.toString())) throw new AppError(`Minimum is ${listing.minLimit} ${listing.currency}`, 400);
      if (data.amount > parseFloat(listing.maxLimit.toString())) throw new AppError(`Maximum is ${listing.maxLimit} ${listing.currency}`, 400);

      const fiatAmount = data.amount * parseFloat(listing.price.toString());
      const reference = generateReference('P2P');

      // Determine buyer/seller
      const buyerId = listing.side === 'SELL' ? req.user!.id : listing.userId;
      const sellerId = listing.side === 'SELL' ? listing.userId : req.user!.id;

      // Lock escrow from seller's wallet
      const sellerWallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: sellerId, currency: listing.currency } },
      });
      if (!sellerWallet) throw new AppError('Seller wallet not found', 404);
      const available = parseFloat(sellerWallet.balance.toString()) - parseFloat(sellerWallet.frozen.toString());
      if (data.amount > available) throw new AppError('Seller has insufficient balance for escrow', 400);

      // Freeze escrow amount
      await prisma.wallet.update({
        where: { userId_currency: { userId: sellerId, currency: listing.currency } },
        data: { frozen: { increment: new Decimal(data.amount) } },
      });

      const trade = await (prisma as any).p2PTrade.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId,
          currency: listing.currency,
          fiatCurrency: listing.fiatCurrency,
          cryptoAmount: data.amount,
          fiatAmount,
          price: parseFloat(listing.price.toString()),
          escrowAmount: data.amount,
          status: 'ESCROW_FUNDED',
          reference,
          buyerNote: listing.side === 'SELL' ? data.note : undefined,
          sellerNote: listing.side === 'BUY' ? data.note : undefined,
          paymentMethod: data.paymentMethod || listing.paymentMethods[0],
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min to pay
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
          message: `Buyer wants ${data.amount} ${listing.currency} for ${fiatAmount} ${listing.fiatCurrency}. Ref: ${reference}`,
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

      res.json({ message: 'Payment marked as sent' });
    } catch (error) {
      next(error);
    }
  }

  /** Confirm payment received and release crypto (seller action) */
  static async confirmPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trade = await (prisma as any).p2PTrade.findFirst({
        where: { id: req.params.id, sellerId: req.user!.id },
      });
      if (!trade) throw new AppError('Trade not found', 404);
      if (trade.status !== 'PAYMENT_SENT') throw new AppError('Buyer has not marked payment as sent', 400);

      // Release escrow: unfreeze from seller, transfer to buyer
      await prisma.$transaction(async (tx: any) => {
        // Unfreeze and deduct from seller
        await tx.wallet.update({
          where: { userId_currency: { userId: trade.sellerId, currency: trade.currency } },
          data: {
            balance: { decrement: trade.escrowAmount },
            frozen: { decrement: trade.escrowAmount },
          },
        });

        // Credit buyer
        await tx.wallet.upsert({
          where: { userId_currency: { userId: trade.buyerId, currency: trade.currency } },
          update: { balance: { increment: trade.cryptoAmount } },
          create: { userId: trade.buyerId, currency: trade.currency, balance: trade.cryptoAmount },
        });

        // Update trade status
        await (tx as any).p2PTrade.update({
          where: { id: trade.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        // Create transaction records
        const sellerWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: trade.sellerId, currency: trade.currency } },
        });
        const buyerWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: trade.buyerId, currency: trade.currency } },
        });

        await tx.transaction.createMany({
          data: [
            {
              userId: trade.sellerId,
              type: 'SELL',
              currency: trade.currency,
              amount: new Decimal(-parseFloat(trade.cryptoAmount.toString())),
              balanceBefore: parseFloat(sellerWallet?.balance.toString() || '0') + parseFloat(trade.cryptoAmount.toString()),
              balanceAfter: parseFloat(sellerWallet?.balance.toString() || '0'),
              reference: trade.reference,
              description: `P2P Sale: ${trade.cryptoAmount} ${trade.currency}`,
            },
            {
              userId: trade.buyerId,
              type: 'BUY',
              currency: trade.currency,
              amount: trade.cryptoAmount,
              balanceBefore: parseFloat(buyerWallet?.balance.toString() || '0') - parseFloat(trade.cryptoAmount.toString()),
              balanceAfter: parseFloat(buyerWallet?.balance.toString() || '0'),
              reference: trade.reference,
              description: `P2P Purchase: ${trade.cryptoAmount} ${trade.currency}`,
            },
          ],
        });
      });

      // Notify buyer
      await prisma.notification.create({
        data: {
          userId: trade.buyerId,
          title: 'Trade Completed',
          message: `${trade.cryptoAmount} ${trade.currency} has been released to your wallet. Ref: ${trade.reference}`,
          type: 'p2p',
        },
      });

      res.json({ message: 'Payment confirmed, crypto released' });
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

      // Unfreeze escrow if it was funded
      if (trade.status === 'ESCROW_FUNDED') {
        await prisma.wallet.update({
          where: { userId_currency: { userId: trade.sellerId, currency: trade.currency } },
          data: { frozen: { decrement: trade.escrowAmount } },
        });
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

      res.json({ message: 'Trade cancelled' });
    } catch (error) {
      next(error);
    }
  }

  /** Raise a dispute */
  static async raiseDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason) throw new AppError('Reason is required', 400);

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

      // Mark trade as disputed
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

      // Notify admins
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'P2P Dispute Raised',
            message: `Dispute on trade ${trade.reference}: ${reason}`,
            type: 'p2p_dispute',
          },
        });
      }

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

      res.json({ trades, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }
}
