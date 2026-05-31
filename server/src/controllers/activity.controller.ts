/**
 * Unified activity feed — joins every transaction-like model the user
 * has touched into a single time-ordered list. Powers the mobile home
 * `Activity` tab, the user statements export, and any admin "user
 * timeline" view.
 *
 * Sources:
 *   - Transaction      (the generic ledger)
 *   - Deposit
 *   - Withdrawal
 *   - P2PTrade         (as buyer or seller)
 *   - CardTransaction
 *   - OnRampTransaction
 *   - OffRampTransaction
 *   - CryptoOrder
 *
 * The endpoint runs the queries in parallel, merges them, sorts by
 * createdAt desc, then paginates. For users with very large histories
 * this can be migrated to a single $queryRaw UNION ALL later; the
 * parallel approach is correct and simple for the common case.
 */
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const KINDS = ['transaction', 'p2p_trade', 'card', 'deposit', 'withdrawal', 'onramp', 'offramp', 'crypto_order'] as const;
type Kind = typeof KINDS[number];

export interface Activity {
  id: string;
  kind: Kind;
  type: string;
  currency: string;
  amount: string;
  fee?: string;
  status?: string;
  reference?: string | null;
  counterparty?: { id?: string; username?: string | null; name?: string | null } | null;
  description?: string | null;
  metadata?: any;
  createdAt: string;
}

const listSchema = z.object({
  page:  z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type:  z.enum(['ALL', ...KINDS]).default('ALL'),
});

export class ActivityController {
  /**
   * GET /api/activities
   * Query: page, limit, type (ALL or one of the kinds above)
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, type } = listSchema.parse(req.query);
      const userId = req.user!.id;

      // We over-fetch from every source then merge. The over-fetch
      // count is the (page * limit) cap so we have enough rows to sort
      // accurately across sources after the merge.
      const take = page * limit;

      const want = (k: Kind) => type === 'ALL' || type === k;

      const [
        txs,
        deposits,
        withdrawals,
        p2pTrades,
        cardTxs,
        onramps,
        offramps,
        cryptoOrders,
      ] = await Promise.all([
        want('transaction')
          ? prisma.transaction.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            })
          : Promise.resolve([] as any[]),
        want('deposit')
          ? prisma.deposit.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            })
          : Promise.resolve([] as any[]),
        want('withdrawal')
          ? prisma.withdrawal.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            })
          : Promise.resolve([] as any[]),
        want('p2p_trade')
          ? (prisma as any).p2PTrade.findMany({
              where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
              orderBy: { createdAt: 'desc' },
              take,
              include: {
                buyer:  { select: { id: true, username: true, firstName: true, lastName: true } },
                seller: { select: { id: true, username: true, firstName: true, lastName: true } },
              },
            }).catch(() => [])
          : Promise.resolve([] as any[]),
        want('card')
          ? prisma.cardTransaction.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            }).catch(() => [])
          : Promise.resolve([] as any[]),
        want('onramp')
          ? prisma.onRampTransaction.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            }).catch(() => [])
          : Promise.resolve([] as any[]),
        want('offramp')
          ? prisma.offRampTransaction.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            }).catch(() => [])
          : Promise.resolve([] as any[]),
        want('crypto_order')
          ? prisma.cryptoOrder.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take,
            }).catch(() => [])
          : Promise.resolve([] as any[]),
      ]);

      const merged: Activity[] = [];

      for (const t of txs as any[]) {
        merged.push({
          id: t.id,
          kind: 'transaction',
          type: t.type,
          currency: t.currency,
          amount: t.amount.toString(),
          fee: t.fee?.toString(),
          reference: t.reference ?? null,
          description: t.description ?? null,
          metadata: t.metadata ?? null,
          createdAt: t.createdAt.toISOString(),
        });
      }
      for (const d of deposits as any[]) {
        merged.push({
          id: d.id,
          kind: 'deposit',
          type: 'DEPOSIT',
          currency: d.currency,
          amount: d.amount.toString(),
          status: d.status,
          reference: d.reference,
          description: `Deposit via ${d.paymentMethod ?? 'unknown'}${d.bankName ? ` (${d.bankName})` : ''}`,
          createdAt: d.createdAt.toISOString(),
        });
      }
      for (const w of withdrawals as any[]) {
        merged.push({
          id: w.id,
          kind: 'withdrawal',
          type: 'WITHDRAWAL',
          currency: w.currency,
          amount: w.amount.toString(),
          fee: w.fee?.toString(),
          status: w.status,
          reference: w.reference,
          description: w.walletAddress
            ? `Withdrawal · ${w.network ?? 'crypto'} → ${String(w.walletAddress).slice(0, 8)}…`
            : `Withdrawal · ${w.bankName ?? 'bank'}`,
          createdAt: w.createdAt.toISOString(),
        });
      }
      for (const tr of p2pTrades as any[]) {
        const isBuyer = tr.buyerId === userId;
        const cp = isBuyer ? tr.seller : tr.buyer;
        const ticker = tr.baseAsset ?? tr.currency;
        merged.push({
          id: tr.id,
          kind: 'p2p_trade',
          type: isBuyer ? 'P2P_BUY' : 'P2P_SELL',
          currency: ticker,
          amount: tr.cryptoAmount.toString(),
          status: tr.status,
          reference: tr.reference,
          counterparty: cp ? {
            id: cp.id,
            username: cp.username,
            name: `${cp.firstName ?? ''} ${cp.lastName ?? ''}`.trim() || null,
          } : null,
          description: `${isBuyer ? 'Bought' : 'Sold'} ${tr.cryptoAmount} ${ticker} · ${tr.fiatAmount} ${tr.fiatAsset ?? tr.fiatCurrency}`,
          createdAt: tr.createdAt.toISOString(),
        });
      }
      for (const c of cardTxs as any[]) {
        merged.push({
          id: c.id,
          kind: 'card',
          type: c.type,
          currency: c.currency,
          amount: c.amount.toString(),
          status: c.declined ? 'DECLINED' : 'APPROVED',
          reference: c.reference,
          description: c.merchant
            ? `Card · ${c.merchant}${c.country ? ` (${c.country})` : ''}`
            : `Card · ${c.category ?? c.type}`,
          metadata: c.metadata,
          createdAt: c.createdAt.toISOString(),
        });
      }
      for (const r of onramps as any[]) {
        merged.push({
          id: r.id,
          kind: 'onramp',
          type: 'ONRAMP',
          currency: r.fiatCurrency,
          amount: r.fiatAmount.toString(),
          fee: r.feeAmount?.toString(),
          status: r.status,
          reference: r.reference,
          description: `On-ramp · ${r.fiatAmount} ${r.fiatCurrency} → ${r.cryptoAmount} ${r.cryptoCurrency}`,
          createdAt: r.createdAt.toISOString(),
        });
      }
      for (const r of offramps as any[]) {
        merged.push({
          id: r.id,
          kind: 'offramp',
          type: 'OFFRAMP',
          currency: r.cryptoCurrency,
          amount: r.cryptoAmount.toString(),
          fee: r.feeAmount?.toString(),
          status: r.status,
          reference: r.reference,
          description: `Off-ramp · ${r.cryptoAmount} ${r.cryptoCurrency} → ${r.fiatAmount} ${r.fiatCurrency}`,
          createdAt: r.createdAt.toISOString(),
        });
      }
      // NOTE: crypto BUY/SELL orders are intentionally NOT merged here. Each
      // executed order already creates a `Transaction` row (see
      // orderExecution.service) which represents the trade with the correct
      // fiat side. Merging cryptoOrders too produced a duplicate, phantom
      // entry per trade (e.g. a bogus "+9,733,255 USDT" credit). The
      // `cryptoOrders` fetch is retained for the type filter / future use.
      void cryptoOrders;

      // Sort the merged list by createdAt desc, then paginate.
      merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const total = merged.length;
      const skip = (page - 1) * limit;
      const items = merged.slice(skip, skip + limit);

      res.json({ items, total, page, limit, hasMore: skip + items.length < total });
    } catch (err) {
      if (err instanceof z.ZodError) return next(new AppError('Invalid query', 400));
      next(err);
    }
  }
}
