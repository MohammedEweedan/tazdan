import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const linkedWalletSchema = z.object({
  address: z.string().min(1, 'Wallet address is required'),
  network: z.string().min(1, 'Network is required'),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class LinkedWalletController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId: req.user!.id },
        orderBy: { isDefault: 'desc' },
      });
      res.json({ wallets });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = linkedWalletSchema.parse(req.body);

      // If setting as default, unset other default wallets
      if (data.isDefault) {
        await prisma.linkedWallet.updateMany({
          where: { userId: req.user!.id },
          data: { isDefault: false },
        });
      }

      const wallet = await prisma.linkedWallet.create({
        data: {
          ...data,
          userId: req.user!.id,
        },
      });

      res.status(201).json({ wallet });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = linkedWalletSchema.partial().parse(req.body);

      // If setting as default, unset other default wallets
      if (data.isDefault) {
        await prisma.linkedWallet.updateMany({
          where: { userId: req.user!.id, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const wallet = await prisma.linkedWallet.update({
        where: { id, userId: req.user!.id },
        data,
      });

      if (!wallet) throw new AppError('Wallet not found', 404);

      res.json({ wallet });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const wallet = await prisma.linkedWallet.delete({
        where: { id, userId: req.user!.id },
      });

      if (!wallet) throw new AppError('Wallet not found', 404);

      res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
