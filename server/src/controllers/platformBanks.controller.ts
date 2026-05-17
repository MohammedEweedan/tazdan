/**
 * Public read-only access to the platform's deposit-rail bank accounts.
 * Users see this when picking which bank to send their fiat deposit to.
 * Admin CRUD is in admin extras controller.
 */
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export class PlatformBanksController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const currency = (req.query.currency as string | undefined)?.toUpperCase();
      const country  = (req.query.country  as string | undefined)?.toUpperCase();
      const where: any = { isActive: true };
      if (currency) where.currency = currency;
      if (country)  where.country  = country;
      const items = await (prisma as any).platformBankAccount.findMany({
        where,
        orderBy: [{ currency: 'asc' }, { createdAt: 'asc' }],
      });
      res.json({ items });
    } catch (e) { next(e); }
  }
}
