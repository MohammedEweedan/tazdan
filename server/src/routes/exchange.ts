import { Router } from 'express';
import { ExchangeController } from '../controllers/exchange.controller';

export const exchangeRouter = Router();

exchangeRouter.get('/rates', ExchangeController.getRates);
exchangeRouter.get('/rates/:base/:quote', ExchangeController.getRatePair);
