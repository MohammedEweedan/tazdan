import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { collectFee } from '../services/fee/feeCollector.service';
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

      // Balance check — enum currencies use Wallet, altcoins use altBalances
      let available = 0;
      if (isCryptoEnum || isFiat) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
        });
        if (!wallet) throw new AppError(`${currency} wallet not found`, 404);
        available = parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString());
      } else {
        const uw = await prisma.userWallet.findUnique({ where: { userId: req.user!.id } });
        const alts = (uw?.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, string>;
        available = parseFloat(alts[currency] ?? '0');
      }
      if (data.amount > available) throw new AppError(`Insufficient balance. Available: ${available} ${currency}`, 400);
      // (Step-up enforcement already ran above, before any state read.)

      const feeKey = isFiat ? 'withdrawal_fee_usd' : 'withdrawal_fee_usdt';
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: feeKey } });
      const fee = parseFloat(feeSetting?.value || '0');
      const netAmount = data.amount - fee;
      if (netAmount <= 0) throw new AppError('Amount too small after fee deduction', 400);

      const reference = generateReference('WDR');

      // Atomically freeze + create withdrawal record + log activity + collect fee
      const withdrawal = await prisma.$transaction(async (tx) => {
        if (isCryptoEnum || isFiat) {
          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
            data: { frozen: { increment: new Decimal(data.amount) } },
          });
        }
        const w = await tx.withdrawal.create({
          data: {
            userId: req.user!.id,
            currency: (isCryptoEnum || isFiat) ? (currency as any) : 'USDT',
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
        if (isCryptoEnum || isFiat) {
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

        // Fee → platform wallet (deposits + transfers are excluded; this is a withdrawal)
        if (fee > 0) {
          await collectFee({
            tx,
            source:   'withdrawal',
            sourceId: w.id,
            payerId:  req.user!.id,
            amount:   new Decimal(fee),
            currency,
            description: `Withdrawal fee · ${currency}`,
            metadata: { isFiat, network: data.network ?? null },
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

      await prisma.wallet.update({
        where: { userId_currency: { userId: req.user!.id, currency: withdrawal.currency } },
        data: { frozen: { decrement: withdrawal.amount } },
      });

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'CANCELLED' },
      });

      res.json({ message: 'Withdrawal cancelled' });
    } catch (error) {
      next(error);
    }
  }
}
