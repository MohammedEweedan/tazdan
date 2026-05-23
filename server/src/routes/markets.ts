import { Router } from 'express';
import { MarketsController } from '../controllers/markets.controller';

export const marketsRouter = Router();

// Public — no auth (used on landing + mobile dashboard)
marketsRouter.get('/ticker', MarketsController.tickers);
marketsRouter.get('/listings', MarketsController.listings);
marketsRouter.get('/icons', MarketsController.icons);
