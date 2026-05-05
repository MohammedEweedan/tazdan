/**
 * Crypto-asset withdrawal endpoints (separate from fiat /api/withdrawals).
 *
 * Mounted at /api/withdrawal (singular, matches spec).
 */
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Server as IOServer } from 'socket.io';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import {
  initiateWithdrawal,
  processDeposit,
  estimateFee,
} from '../services/wallet/onchainSettlement.service';

const initiateSchema = z.object({
  asset: z.enum(['ETH', 'BTC', 'SOL', 'USDT']),
  network: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(String),
  toAddress: z.string().min(10),
  twoFactorCode: z.string().min(6).max(8).optional(),
});

const estimateSchema = z.object({
  asset: z.string(),
  network: z.string(),
});

// Minimal webhook payload. In production we should verify a signing
// secret (e.g. Alchemy signing key, Trongrid IP allow-list).
const depositWebhookSchema = z.object({
  txHash: z.string().min(10),
  asset: z.string(),
  network: z.string(),
  fromAddress: z.string(),
  toAddress: z.string(),
  amount: z.union([z.string(), z.number()]).transform(String),
  confirmations: z.number().int().min(0),
});

export class CryptoWithdrawalController {
  // POST /api/withdrawal/initiate
  static async initiate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = initiateSchema.parse(req.body);

      // Enforce 2FA when the user has it enabled (spec: non-negotiable
      // for withdrawals). If 2FA isn't set up we still allow the action
      // but flag it — production SHOULD require 2FA unconditionally.
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (user?.twoFactorEnabled) {
        if (!body.twoFactorCode) throw new AppError('2FA code required', 401);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const speakeasy = require('speakeasy');
        const ok = speakeasy.totp.verify({
          secret: user.twoFactorSecret!,
          encoding: 'base32',
          token: body.twoFactorCode,
          window: 2,
        });
        if (!ok) throw new AppError('Invalid 2FA code', 401);
      }

      // TODO: whitelist first-time addresses (24hr email-confirm delay).
      const tx = await initiateWithdrawal({
        userId: req.user!.id,
        asset: body.asset,
        network: body.network,
        amount: body.amount,
        toAddress: body.toAddress,
      });

      const io = req.app.get('io') as IOServer | undefined;
      io?.to(`user:${req.user!.id}`).emit('withdrawal:submitted', {
        id: tx.id, txHash: tx.txHash, status: tx.status,
      });

      res.status(201).json({ transaction: tx });
    } catch (e) {
      next(e);
    }
  }

  // GET /api/withdrawal/estimate-fee?asset=ETH&network=ERC20
  static async estimate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { asset, network } = estimateSchema.parse(req.query);
      res.json(estimateFee(asset, network));
    } catch (e) { next(e); }
  }

  // GET /api/withdrawal/history
  static async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10) || 20);
      const where = { userId: req.user!.id, type: 'WITHDRAWAL' };
      const [items, total] = await Promise.all([
        prisma.onChainTransaction.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.onChainTransaction.count({ where }),
      ]);
      res.json({ transactions: items, total, page, limit });
    } catch (e) { next(e); }
  }

  /**
   * POST /api/withdrawal/webhook/deposit
   * Secured by a shared secret header (X-Webhook-Secret).
   */
  static async depositWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const secret = process.env.DEPOSIT_WEBHOOK_SECRET;
      if (!secret) throw new AppError('Deposit webhook not configured', 503);
      if (req.headers['x-webhook-secret'] !== secret) {
        throw new AppError('Invalid webhook secret', 401);
      }
      const body = depositWebhookSchema.parse(req.body);
      const row = await processDeposit(body);

      const io = req.app.get('io') as IOServer | undefined;
      io?.to(`user:${row.userId}`).emit('deposit:update', {
        id: row.id, txHash: row.txHash, status: row.status, confirmations: row.confirmations,
      });

      res.json({ ok: true, id: row.id, status: row.status });
    } catch (e) { next(e); }
  }
}
