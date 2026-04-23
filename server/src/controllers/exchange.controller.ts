import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';

export class ExchangeController {
  static async getRates(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await prisma.exchangeRate.findMany({ where: { isActive: true } });
      res.json({ rates });
    } catch (error) {
      next(error);
    }
  }

  static async getRatePair(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const rate = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: base.toUpperCase() as any, quoteCurrency: quote.toUpperCase() as any } },
      });
      res.json({ rate });
    } catch (error) {
      next(error);
    }
  }
}
