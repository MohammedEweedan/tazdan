/**
 * LiquidityPoolController — group-scoped pool actions.
 *
 * Two pool kinds (set at group creation):
 *   - SHARED_WALLET: open-ended pool, members deposit/withdraw any time.
 *                    Each member's share is tracked in USD-equivalent.
 *   - GOAL_BASED:    target amount + deadline. Status starts LOCKED;
 *                    deposits accumulate; no withdrawals until COMPLETED
 *                    (goal hit) or DISSOLVED (owner closes early →
 *                    funds returned pro-rata to contributors).
 *
 * Every action emits a Socket.IO `group:pool-updated` event into each
 * member's room AND posts a POOL_DEPOSIT / POOL_WITHDRAW / POOL_CLOSED
 * system message into the group chat so the timeline narrates itself.
 *
 * Settlement currency is USDT — all contributions are converted to
 * USDT at deposit time using getMarketPrice(SYMBOL+USDT). Withdrawals
 * pay out in USDT regardless of the deposit currency (simpler than
 * tracking per-asset balances; v2 can add multi-asset payout).
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { Server as IOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { getMarketPrice } from '../services/exchange/priceEngine.service';
import { isLedgerCurrency, postLedger } from '../services/ledger/ledger.service';

// Stablecoins that are pegged to USD at 1:1 — skip the price lookup.
const USD_PEGGED = new Set(['USDT', 'USDC', 'USD']);

function emit(req: AuthRequest, userIds: string[], event: string, payload: any) {
  const io = req.app.get('io') as IOServer | undefined;
  if (!io) return;
  for (const uid of new Set(userIds)) io.to(`user:${uid}`).emit(event, payload);
}

async function memberUserIds(groupId: string): Promise<string[]> {
  const rows = await (prisma as any).groupMember.findMany({
    where: { groupId, leftAt: null },
    select: { userId: true },
  });
  return rows.map((r: any) => r.userId);
}

/** Return the USD-equivalent of `amount` units of `currency`. */
async function toUsd(currency: string, amount: Decimal): Promise<Decimal> {
  if (USD_PEGGED.has(currency)) return amount;
  // Binance crypto pairs: e.g. BTCUSDT, ETHUSDT.
  try {
    const symbol = `${currency}USDT`;
    const price = await getMarketPrice(symbol);
    return amount.mul(price);
  } catch (e: any) {
    throw new AppError(
      `Cannot quote ${currency} → USD. Use USDT/USDC/USD or a major crypto.`,
      400,
    );
  }
}

function poolToWire(p: any) {
  return {
    id:              p.id,
    groupId:         p.groupId,
    name:            p.name,
    kind:            p.kind,
    status:          p.status,
    targetAmountUsd: p.targetAmountUsd ? String(p.targetAmountUsd) : null,
    deadline:        p.deadline ?? null,
    totalBalanceUsd: String(p.totalBalanceUsd),
    createdById:     p.createdById,
    createdAt:       p.createdAt,
    members:         Array.isArray(p.members) ? p.members.map((m: any) => ({
      id: m.id, userId: m.userId,
      totalContributedUsd: String(m.totalContributedUsd),
      totalWithdrawnUsd:   String(m.totalWithdrawnUsd),
    })) : undefined,
  };
}

// ── Schemas ────────────────────────────────────────────────────────

const depositSchema = z.object({
  currency: z.string().min(2).max(10),
  amount:   z.number().positive(),
  note:     z.string().max(280).optional(),
});

const withdrawSchema = z.object({
  amountUsd: z.number().positive(),
  note:      z.string().max(280).optional(),
});

// ── Helpers to refetch a pool with members in a consistent shape ───

async function loadPool(groupId: string) {
  return (prisma as any).liquidityPool.findUnique({
    where: { groupId },
    include: { members: true },
  });
}

// ── Controller ─────────────────────────────────────────────────────

export const LiquidityPoolController = {
  /**
   * POST /api/groups/:id/pool/deposit
   *
   * Moves `amount` of `currency` from the member's Wallet into the pool.
   * The amount is converted to USD-equivalent and added to both the
   * pool's totalBalanceUsd and the member's totalContributedUsd.
   *
   * The wallet deduction reuses the same balance/Transaction mechanism
   * as 1-to-1 transfers: a `Transfer` row is created (sender = user,
   * receiver = pool's creator-as-custodian — placeholder until v2 adds
   * a dedicated platform-pool account), and a Transaction is recorded
   * against the user's wallet so this shows up in their activity feed.
   *
   * For v1 simplicity, the underlying funds are tracked in USD-equivalent
   * only; the actual crypto balance lives in a virtual sub-ledger keyed
   * by LiquidityPoolContribution rows. We don't move on-chain or to a
   * second wallet — the pool is a logical ledger on top of the user's
   * own wallet, debited via a Transaction marked TRANSFER_OUT.
   */
  async deposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const parsed = depositSchema.parse(req.body);

      // Membership + group activity check.
      const membership = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: me } },
        include: { group: true },
      });
      if (!membership || membership.leftAt) throw new AppError('Not a member', 403);
      if (membership.group.dissolvedAt) throw new AppError('Group dissolved', 410);

      const pool = await loadPool(groupId);
      if (!pool) throw new AppError('No pool on this group', 404);
      if (pool.status === 'DISSOLVED' || pool.status === 'COMPLETED') {
        throw new AppError('Pool is closed', 400);
      }

      const amountDec = new Decimal(parsed.amount);
      const amountUsd = await toUsd(parsed.currency, amountDec);

      // For v1 we require USDT/USDC/USD for actual settlement — these
      // are the wallets we can reliably debit. Crypto deposits would
      // need a price-locked sub-ledger; we'll add that in v2.
      if (!USD_PEGGED.has(parsed.currency) || parsed.currency === 'USDC') {
        throw new AppError(
          'For v1, pool deposits must be in USDT or USD. Crypto support coming soon.',
          400,
        );
      }

      const result = await prisma.$transaction(async (tx: any) => {
        // Debit user's wallet.
        const wallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: me, currency: parsed.currency as any } },
        });
        if (!wallet || new Decimal(wallet.balance).lt(amountDec)) {
          throw new AppError('Insufficient balance', 400);
        }
        const newBal = new Decimal(wallet.balance).sub(amountDec);
        await tx.wallet.update({
          where: { id: wallet.id },
          data:  { balance: newBal },
        });

        // Record a TRANSFER_OUT transaction so it shows in the user's activity feed.
        const ref = `POOL-${uuidv4().slice(0, 8).toUpperCase()}`;
        await tx.transaction.create({
          data: {
            userId:        me,
            type:          'TRANSFER_OUT',
            currency:      parsed.currency as any,
            amount:        amountDec,
            balanceBefore: wallet.balance,
            balanceAfter:  newBal,
            description:   `Deposit to pool: ${pool.name}`,
            reference:     ref,
          },
        });

        if (isLedgerCurrency(parsed.currency)) {
          const legs = parsed.currency === 'USDT'
            ? [
                { type: 'USER' as const, userId: me, currency: 'USDT' as any, amount: amountDec.neg() },
                { type: 'SYSTEM_ESCROW' as const, currency: 'USDT' as any, amount: amountDec },
              ]
            : [
                { type: 'USER' as const, userId: me, currency: parsed.currency as any, amount: amountDec.neg() },
                { type: 'SYSTEM_FX' as const, currency: parsed.currency as any, amount: amountDec },
                { type: 'SYSTEM_FX' as const, currency: 'USDT' as any, amount: amountUsd.neg() },
                { type: 'SYSTEM_ESCROW' as const, currency: 'USDT' as any, amount: amountUsd },
              ];
          await postLedger(tx, {
            refType: 'liquidity_pool_deposit',
            refId: ref,
            memo: `Pool deposit ${pool.id}`,
            legs,
          }, { allowNegativeUser: true });
        }

        // Upsert pool membership (in case they joined the group after pool creation).
        const pm = await tx.liquidityPoolMember.upsert({
          where: { poolId_userId: { poolId: pool.id, userId: me } },
          create: { poolId: pool.id, userId: me, totalContributedUsd: amountUsd },
          update: { totalContributedUsd: { increment: amountUsd } },
        });

        // Add the contribution row.
        const contrib = await tx.liquidityPoolContribution.create({
          data: {
            poolId:    pool.id,
            userId:    me,
            direction: 'DEPOSIT',
            amount:    amountDec,
            currency:  parsed.currency,
            amountUsd,
          },
        });

        // Update pool balance.
        const updated = await tx.liquidityPool.update({
          where: { id: pool.id },
          data:  { totalBalanceUsd: { increment: amountUsd } },
          include: { members: true },
        });

        // GOAL_BASED auto-flips to COMPLETED when target is hit.
        let finalPool = updated;
        if (
          updated.kind === 'GOAL_BASED' &&
          updated.targetAmountUsd &&
          new Decimal(updated.totalBalanceUsd).gte(new Decimal(updated.targetAmountUsd))
        ) {
          finalPool = await tx.liquidityPool.update({
            where: { id: pool.id },
            data:  { status: 'COMPLETED' },
            include: { members: true },
          });
        }

        // System message in the group chat.
        const sysMsg = await tx.groupMessage.create({
          data: {
            groupId,
            senderId: me,
            type:     'POOL_DEPOSIT',
            content:  '',
            metadata: {
              poolId:    pool.id,
              contribId: contrib.id,
              amount:    String(amountDec),
              currency:  parsed.currency,
              amountUsd: String(amountUsd),
              note:      parsed.note ?? null,
            },
          },
        });

        return { pool: finalPool, sysMsg, pm };
      });

      const ids = await memberUserIds(groupId);
      emit(req, ids, 'group:pool-updated', poolToWire(result.pool));
      emit(req, ids, 'group:message', {
        id:            result.sysMsg.id,
        groupId,
        senderId:      me,
        type:          result.sysMsg.type,
        content:       '',
        attachmentUrl: null,
        metadata:      result.sysMsg.metadata,
        replyToId:     null,
        editedAt:      null,
        deletedAt:     null,
        createdAt:     result.sysMsg.createdAt,
      });

      res.status(201).json({ pool: poolToWire(result.pool) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/groups/:id/pool/withdraw
   *
   * SHARED_WALLET: caller can withdraw up to their net contributed share.
   * GOAL_BASED:    blocked until status === COMPLETED or DISSOLVED.
   * Payout is in USDT to the caller's USDT wallet.
   */
  async withdraw(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const parsed = withdrawSchema.parse(req.body);

      const membership = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: me } },
      });
      if (!membership || membership.leftAt) throw new AppError('Not a member', 403);

      const pool = await loadPool(groupId);
      if (!pool) throw new AppError('No pool on this group', 404);

      if (pool.kind === 'GOAL_BASED' && pool.status !== 'COMPLETED' && pool.status !== 'DISSOLVED') {
        throw new AppError('Goal-based pools are locked until the goal is met or the pool is closed', 400);
      }

      const amountUsd = new Decimal(parsed.amountUsd);
      const myMember = pool.members.find((m: any) => m.userId === me);
      if (!myMember) throw new AppError('You have not contributed to this pool', 400);

      const myShare = new Decimal(myMember.totalContributedUsd).sub(new Decimal(myMember.totalWithdrawnUsd));
      if (myShare.lt(amountUsd)) {
        throw new AppError('Withdrawal exceeds your available share', 400);
      }
      if (new Decimal(pool.totalBalanceUsd).lt(amountUsd)) {
        throw new AppError('Pool balance insufficient', 400);
      }

      const result = await prisma.$transaction(async (tx: any) => {
        // Credit caller's USDT wallet.
        const wallet = await tx.wallet.upsert({
          where:  { userId_currency: { userId: me, currency: 'USDT' as any } },
          create: { userId: me, currency: 'USDT' as any, balance: amountUsd, frozen: 0 },
          update: { balance: { increment: amountUsd } },
        });
        const ref = `POOL-W-${uuidv4().slice(0, 8).toUpperCase()}`;
        await tx.transaction.create({
          data: {
            userId:        me,
            type:          'TRANSFER_IN',
            currency:      'USDT' as any,
            amount:        amountUsd,
            balanceBefore: new Decimal(wallet.balance).sub(amountUsd),
            balanceAfter:  wallet.balance,
            description:   `Withdraw from pool: ${pool.name}`,
            reference:     ref,
          },
        });

        await postLedger(tx, {
          refType: 'liquidity_pool_withdrawal',
          refId: ref,
          memo: `Pool withdrawal ${pool.id}`,
          legs: [
            { type: 'SYSTEM_ESCROW', currency: 'USDT' as any, amount: amountUsd.neg() },
            { type: 'USER', userId: me, currency: 'USDT' as any, amount: amountUsd },
          ],
        }, { allowNegativeUser: true });

        await tx.liquidityPoolMember.update({
          where: { poolId_userId: { poolId: pool.id, userId: me } },
          data:  { totalWithdrawnUsd: { increment: amountUsd } },
        });

        const contrib = await tx.liquidityPoolContribution.create({
          data: {
            poolId:    pool.id,
            userId:    me,
            direction: 'WITHDRAW',
            amount:    amountUsd, // tracked in USDT
            currency:  'USDT',
            amountUsd,
          },
        });

        const updated = await tx.liquidityPool.update({
          where: { id: pool.id },
          data:  { totalBalanceUsd: { decrement: amountUsd } },
          include: { members: true },
        });

        const sysMsg = await tx.groupMessage.create({
          data: {
            groupId,
            senderId: me,
            type:     'POOL_WITHDRAW',
            content:  '',
            metadata: {
              poolId:    pool.id,
              contribId: contrib.id,
              amountUsd: String(amountUsd),
              note:      parsed.note ?? null,
            },
          },
        });

        return { pool: updated, sysMsg };
      });

      const ids = await memberUserIds(groupId);
      emit(req, ids, 'group:pool-updated', poolToWire(result.pool));
      emit(req, ids, 'group:message', {
        id:            result.sysMsg.id,
        groupId,
        senderId:      me,
        type:          result.sysMsg.type,
        content:       '',
        attachmentUrl: null,
        metadata:      result.sysMsg.metadata,
        replyToId:     null,
        editedAt:      null,
        deletedAt:     null,
        createdAt:     result.sysMsg.createdAt,
      });

      res.status(200).json({ pool: poolToWire(result.pool) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/groups/:id/pool/close
   *
   * Owner-only. Dissolves the pool and returns any remaining balance
   * pro-rata to contributors (by net contributed share). For GOAL_BASED
   * pools that hit COMPLETED, this finalises the payout phase.
   */
  async close(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;

      const membership = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: me } },
      });
      if (!membership || membership.leftAt) throw new AppError('Not a member', 403);
      if (membership.role !== 'OWNER') throw new AppError('Only the owner can close the pool', 403);

      const pool = await loadPool(groupId);
      if (!pool) throw new AppError('No pool on this group', 404);
      if (pool.status === 'DISSOLVED') throw new AppError('Pool already dissolved', 400);

      const totalUsd = new Decimal(pool.totalBalanceUsd);

      const result = await prisma.$transaction(async (tx: any) => {
        if (totalUsd.gt(0)) {
          // Pro-rata refund: each member's payout = (their net share / sum of net shares) * pool balance.
          const netShares = pool.members.map((m: any) => ({
            userId: m.userId,
            net:    new Decimal(m.totalContributedUsd).sub(new Decimal(m.totalWithdrawnUsd)),
          }));
          const totalNet = netShares.reduce((acc: Decimal, x: any) => acc.add(x.net), new Decimal(0));
          if (totalNet.gt(0)) {
            for (const s of netShares) {
              if (s.net.lte(0)) continue;
              const payout = totalUsd.mul(s.net).div(totalNet);
              await tx.wallet.upsert({
                where:  { userId_currency: { userId: s.userId, currency: 'USDT' as any } },
                create: { userId: s.userId, currency: 'USDT' as any, balance: payout, frozen: 0 },
                update: { balance: { increment: payout } },
              });
              const ref = `POOL-CL-${uuidv4().slice(0, 8).toUpperCase()}`;
              await tx.transaction.create({
                data: {
                  userId:        s.userId,
                  type:          'TRANSFER_IN',
                  currency:      'USDT' as any,
                  amount:        payout,
                  balanceBefore: 0,
                  balanceAfter:  payout,
                  description:   `Pool close payout: ${pool.name}`,
                  reference:     ref,
                },
              });
              await postLedger(tx, {
                refType: 'liquidity_pool_close_payout',
                refId: ref,
                memo: `Pool close payout ${pool.id}`,
                legs: [
                  { type: 'SYSTEM_ESCROW', currency: 'USDT' as any, amount: payout.neg() },
                  { type: 'USER', userId: s.userId, currency: 'USDT' as any, amount: payout },
                ],
              }, { allowNegativeUser: true });
              await tx.liquidityPoolMember.update({
                where: { poolId_userId: { poolId: pool.id, userId: s.userId } },
                data:  { totalWithdrawnUsd: { increment: payout } },
              });
              await tx.liquidityPoolContribution.create({
                data: {
                  poolId:    pool.id,
                  userId:    s.userId,
                  direction: 'WITHDRAW',
                  amount:    payout,
                  currency:  'USDT',
                  amountUsd: payout,
                },
              });
            }
          }
        }

        const updated = await tx.liquidityPool.update({
          where: { id: pool.id },
          data:  { status: 'DISSOLVED', totalBalanceUsd: 0 },
          include: { members: true },
        });

        const sysMsg = await tx.groupMessage.create({
          data: {
            groupId,
            senderId: me,
            type:     'POOL_CLOSED',
            content:  '',
            metadata: { poolId: pool.id, distributedUsd: String(totalUsd) },
          },
        });

        return { pool: updated, sysMsg };
      });

      const ids = await memberUserIds(groupId);
      emit(req, ids, 'group:pool-updated', poolToWire(result.pool));
      emit(req, ids, 'group:message', {
        id:            result.sysMsg.id,
        groupId,
        senderId:      me,
        type:          result.sysMsg.type,
        content:       '',
        attachmentUrl: null,
        metadata:      result.sysMsg.metadata,
        replyToId:     null,
        editedAt:      null,
        deletedAt:     null,
        createdAt:     result.sysMsg.createdAt,
      });

      res.json({ pool: poolToWire(result.pool) });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/groups/:id/pool/contributions — full audit log for the pool. */
  async contributions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const membership = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: me } },
      });
      if (!membership || membership.leftAt) throw new AppError('Not a member', 403);

      const pool = await loadPool(groupId);
      if (!pool) throw new AppError('No pool on this group', 404);

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const rows = await (prisma as any).liquidityPoolContribution.findMany({
        where: { poolId: pool.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({
        contributions: rows.map((r: any) => ({
          id:        r.id,
          userId:    r.userId,
          direction: r.direction,
          amount:    String(r.amount),
          currency:  r.currency,
          amountUsd: String(r.amountUsd),
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};
