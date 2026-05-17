import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { getBankFetchService } from '../services/banking';

const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(5, 'Account number must be at least 5 characters'),
  accountName: z.string().min(1, 'Account name is required'),
  branch: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class BankAccountController {
  static async getBanksByCountry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { country } = req.params;
      
      // Use the new BankFetchService with provider fallback chain
      const bankService = getBankFetchService({
        ibanComApiKey: process.env.IBAN_COM_API_KEY,
        useIbanCom: process.env.USE_IBAN_COM === 'true',
        useOpenIban: process.env.USE_OPENIBAN !== 'false',
        useLocalFallback: process.env.ENABLE_LOCAL_BANK_CACHE !== 'false',
      });
      
      const banks = await bankService.getBanks(country);
      
      // Transform Bank objects to simple string array for backward compatibility
      const bankNames = banks.map(bank => bank.name);
      
      res.json({ banks: bankNames });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { userId: req.user!.id },
        orderBy: { isDefault: 'desc' },
      });
      res.json({ bankAccounts });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = bankAccountSchema.parse(req.body);

      // If setting as default, unset other default accounts
      if (data.isDefault) {
        await prisma.bankAccount.updateMany({
          where: { userId: req.user!.id },
          data: { isDefault: false },
        });
      }

      const bankAccount = await prisma.bankAccount.create({
        data: {
          ...data,
          userId: req.user!.id,
        },
      });

      res.status(201).json({ bankAccount });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = bankAccountSchema.partial().parse(req.body);

      // If setting as default, unset other default accounts
      if (data.isDefault) {
        await prisma.bankAccount.updateMany({
          where: { userId: req.user!.id, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const bankAccount = await prisma.bankAccount.update({
        where: { id, userId: req.user!.id },
        data,
      });

      if (!bankAccount) throw new AppError('Bank account not found', 404);

      res.json({ bankAccount });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const bankAccount = await prisma.bankAccount.delete({
        where: { id, userId: req.user!.id },
      });

      if (!bankAccount) throw new AppError('Bank account not found', 404);

      res.json({ message: 'Bank account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
