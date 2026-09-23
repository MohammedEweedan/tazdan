import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { assertTransitioned, releaseReserve, reserveFunds } from '../services/wallet/atomicWallet';
import { enforceKycLimit } from '../utils/kycLimits';
import { emitActivity } from '../utils/realtime';
import { enforceStepUp } from '../services/security/stepUp.service';

const FIAT_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD']);

const withdrawalSchema = z.object({
  currency: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER']).optional(),
  walletAddress: z.string().optional(),
  network: z.enum(['TRC20', 'ERC20']).optional(),
  bankAccountId: z.string().uuid().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  stepUpCode: z.string().regex(/^\d{6}$/).optional(),
});

export class WithdrawalController {
  /**
   * Create a withdrawal request.
   * Fiat withdrawals require KYC APPROVED + a saved bank account.
   * Crypto withdrawals require a wallet address + network.
   * Funds are frozen atomically with the Withdrawal record creation.
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = withdrawalSchema.parse(req.body);
      const currency = data.currency.toUpperCase();
      const isFiat = FIAT_CURRENCIES.has(currency);
      const isCryptoEnum = ['USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX'].includes(currency);

      // Only assets held in the Wallet table can be reserved while a
      // withdrawal waits for review. Long-tail coins used to be recorded as a
      // USDT withdrawal with nothing reserved; refuse them until they have a
      // proper reservation path.
      if (!isFiat && !isCryptoEnum) {
        throw new AppError(`Withdrawals of ${currency} are not supported yet`, 400);
      }

      // Step-up: withdrawals ≥ threshold or from an unrecognized device require
      // a fresh 6-digit confirmation (email or authenticator). Throws 401 and
      // auto-issues a code on first call until satisfied.
      {
        const { enforceStepUp } = await import('../services/security/stepUp.service');
        let valueUsd = data.amount;
        if (!['USD', 'USDT', 'USDC'].includes(currency)) {
          try {
            if (isCryptoEnum && currency !== 'USDT') {
              const { getMarketPrice } = await import('../services/exchange/priceEngine.service');
              valueUsd = data.amount * Number(await getMarketPrice(`${currency}USDT`));
            } else {
              const { getRate } = await import('../services/exchange/fxRateProvider.service');
              const pair = await getRate(currency, 'USD');
              valueUsd = data.amount * Number(pair.buyPrice || pair.sellPrice || 1);
            }
          } catch { /* fall back to raw amount */ }
        }
        await enforceStepUp({ userId: req.user!.id, action: 'withdrawal', valueUsd, req, code: data.stepUpCode });
      }

      // KYC gate for fiat withdrawals
      if (isFiat) {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true } });
        if (user?.kycStatus !== 'APPROVED') {
          res.status(403).json({ error: 'KYC verification required for fiat withdrawals' });
          return;
        }
      }

      // Crypto validation
      if (!isFiat) {
        if (!data.walletAddress) throw new AppError('Wallet address is required for crypto withdrawals', 400);
        if (!data.network) throw new AppError('Network (TRC20/ERC20) is required for crypto withdrawals', 400);
        if (data.network === 'TRC20' && !data.walletAddress.startsWith('T')) throw new AppError('Invalid TRC20 address', 400);
        if (data.network === 'ERC20' && !data.walletAddress.startsWith('0x')) throw new AppError('Invalid ERC20 address', 400);
      }

      // Fiat requires a bank account
      let bankAccountDetails: { bankName?: string; accountNumber?: string; accountName?: string } = {};
      if (isFiat) {
        if (!data.bankAccountId && !data.bankName) throw new AppError('Bank account required for fiat withdrawals', 400);
        if (data.bankAccountId) {
          const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: data.bankAccountId, userId: req.user!.id },
          });
          if (!bankAccount) throw new AppError('Bank account not found', 404);
          bankAccountDetails = {
            bankName: bankAccount.bankName,
            accountNumber: bankAccount.accountNumber ?? undefined,
            accountName: bankAccount.accountName,
          };
        } else {
          bankAccountDetails = { bankName: data.bankName, accountNumber: data.accountNumber, accountName: data.accountName };
        }
      }

      await enforceKycLimit(req.user!.id, 'WITHDRAW', data.amount, currency);

      // Early, friendly balance check. The authoritative check is the atomic
      // reservation inside the transaction below.
      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
      });
      if (!wallet) throw new AppError(`${currency} wallet not found`, 404);
      const available = parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString());
      if (data.amount > available) throw new AppError(`Insufficient balance. Available: ${available} ${currency}`, 400);

      const feeKey = isFiat ? 'withdrawal_fee_usd' : 'withdrawal_fee_usdt';
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: feeKey } });
      const fee = parseFloat(feeSetting?.value || '0');
      const netAmount = data.amount - fee;
      if (netAmount <= 0) throw new AppError('Amount too small after fee deduction', 400);

      const reference = generateReference('WDR');

      // Atomically reserve + create the withdrawal record + log activity.
      // The fee is booked when an admin completes the withdrawal, not here.
      const withdrawal = await prisma.$transaction(async (tx) => {
        // Checked and applied in one statement: concurrent requests can never
        // reserve more than the spendable balance.
        await reserveFunds(tx, req.user!.id, currency, data.amount);
        const w = await tx.withdrawal.create({
          data: {
            userId: req.user!.id,
            currency: currency as any,
            amount: data.amount,
            fee,
            netAmount,
            paymentMethod: isFiat ? 'BANK_TRANSFER' : (data.paymentMethod as any ?? undefined),
            walletAddress: data.walletAddress,
            network: data.network,
            bankName: bankAccountDetails.bankName ?? data.bankName,
            accountNumber: bankAccountDetails.accountNumber ?? data.accountNumber,
            accountName: bankAccountDetails.accountName ?? data.accountName,
            reference,
          },
        });

        // Log the activity so it shows up in the user's transaction history.
        // We capture amount as negative because it's leaving the wallet.
        {
          await tx.transaction.create({
            data: {
              userId: req.user!.id,
              type: 'WITHDRAWAL',
              currency: currency as any,
              amount: new Decimal(-data.amount),
              fee: new Decimal(fee),
              balanceBefore: new Decimal(available),
              balanceAfter:  new Decimal(available - data.amount),
              reference,
              description: isFiat
                ? `Withdrawal to ${bankAccountDetails.bankName ?? data.bankName ?? 'bank'}`
                : `Withdrawal ${data.network} → ${data.walletAddress?.slice(0, 8)}…`,
              metadata: { withdrawalId: w.id, network: data.network ?? null } as any,
            },
          });
        }

        return w;
      });

      // Notify admins
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: 'New Withdrawal Request',
          message: `Withdrawal of ${data.amount} ${currency}${!isFiat ? ` to ${data.walletAddress} (${data.network})` : ` via bank`}. Ref: ${reference}`,
          type: 'withdrawal',
        })),
      });

      emitActivity(req, [req.user!.id], { kind: 'withdrawal' });
      res.status(201).json({ withdrawal });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.withdrawal.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({ withdrawals, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Only pending withdrawals can be cancelled', 400);

      // Unfreeze + cancel atomically. No ledger leg: cancelling only releases
      // the `frozen` reservation — no real balance moved (settlement is the
      // only ledgered step, and a PENDING withdrawal never settled). The
      // conditional transition stops a cancel racing an admin approval.
      await prisma.$transaction(async (tx) => {
        const moved = await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, userId: req.user!.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        assertTransitioned(moved, 'Only pending withdrawals can be cancelled');
        await releaseReserve(tx, req.user!.id, withdrawal.currency, withdrawal.amount);
      });

      res.json({ message: 'Withdrawal cancelled' });
    } catch (error) {
      next(error);
    }
  }
}
