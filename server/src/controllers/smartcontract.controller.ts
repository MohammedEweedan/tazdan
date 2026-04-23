import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const CONTRACT_FEES: Record<string, number> = {
  ESCROW: 30,
  VESTING: 50,
  MULTISIG: 75,
  TOKEN_LOCK: 25,
  PAYMENT_SPLITTER: 40,
  CUSTOM: 100,
};

const createContractSchema = z.object({
  type: z.enum(['ESCROW', 'VESTING', 'MULTISIG', 'TOKEN_LOCK', 'PAYMENT_SPLITTER', 'CUSTOM']),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  chain: z.enum(['BNB', 'ETH', 'SOL', 'AVAX', 'MATIC']),
  parameters: z.record(z.any()), // type-specific params
});

export class SmartContractController {
  /** Get fee schedule */
  static async getFees(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ fees: CONTRACT_FEES, templates: [
        { type: 'ESCROW', name: 'Escrow Contract', description: 'Hold funds until conditions are met. Release to seller or refund to buyer.', fee: CONTRACT_FEES.ESCROW },
        { type: 'VESTING', name: 'Token Vesting', description: 'Gradually release tokens over a set period. Great for team allocations.', fee: CONTRACT_FEES.VESTING },
        { type: 'MULTISIG', name: 'Multi-Signature Wallet', description: 'Require multiple approvals for transactions. Enhanced security.', fee: CONTRACT_FEES.MULTISIG },
        { type: 'TOKEN_LOCK', name: 'Token Lock', description: 'Lock tokens for a specified duration. Build investor confidence.', fee: CONTRACT_FEES.TOKEN_LOCK },
        { type: 'PAYMENT_SPLITTER', name: 'Payment Splitter', description: 'Automatically split incoming payments between multiple addresses.', fee: CONTRACT_FEES.PAYMENT_SPLITTER },
        { type: 'CUSTOM', name: 'Custom Contract', description: 'Custom smart contract deployment. Our team will review and deploy.', fee: CONTRACT_FEES.CUSTOM },
      ]});
    } catch (error) {
      next(error);
    }
  }

  /** Deploy a smart contract */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user || user.kycStatus !== 'APPROVED') {
        throw new AppError('KYC verification required to deploy contracts', 403);
      }

      const data = createContractSchema.parse(req.body);
      const fee = CONTRACT_FEES[data.type] || 100;

      // Check USDT balance
      const wallet = await prisma.wallet.findFirst({
        where: { userId: req.user!.id, currency: 'USDT' },
      });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
      const frozen = wallet ? parseFloat(wallet.frozen.toString()) : 0;
      if (balance - frozen < fee) {
        throw new AppError(`Insufficient USDT balance. Fee: ${fee} USDT`, 400);
      }

      const contract = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet!.id },
          data: { balance: { decrement: fee } },
        });

        await tx.transaction.create({
          data: {
            userId: req.user!.id,
            type: 'FEE',
            currency: 'USDT',
            amount: fee,
            fee: 0,
            balanceBefore: balance,
            balanceAfter: balance - fee,
            description: `Smart contract deployment fee: ${data.type} on ${data.chain}`,
            reference: `SC-${Date.now()}`,
          },
        });

        const c = await tx.smartContract.create({
          data: {
            userId: req.user!.id,
            type: data.type as any,
            name: data.name,
            description: data.description,
            chain: data.chain,
            parameters: data.parameters,
            platformFee: fee,
            status: 'DEPLOYING',
          },
        });

        return c;
      });

      // Simulate deployment
      setTimeout(async () => {
        try {
          const fakeAddress = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
          const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
          await prisma.smartContract.update({
            where: { id: contract.id },
            data: {
              status: 'DEPLOYED',
              contractAddress: fakeAddress,
              deployTxHash: fakeTxHash,
              deployedAt: new Date(),
            },
          });
          await prisma.notification.create({
            data: {
              userId: req.user!.id,
              title: 'Contract Deployed!',
              message: `Your ${data.type} contract "${data.name}" is live on ${data.chain}. Address: ${fakeAddress}`,
              type: 'success',
            },
          });
        } catch (e) {
          console.error('Contract deploy simulation failed:', e);
        }
      }, 5000);

      res.status(201).json({ contract, fee });
    } catch (error) {
      next(error);
    }
  }

  /** Get user's contracts */
  static async getMyContracts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const contracts = await prisma.smartContract.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ contracts });
    } catch (error) {
      next(error);
    }
  }
}
