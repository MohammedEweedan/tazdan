import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { WalletController } from '../controllers/wallet.controller';

export const walletRouter = Router();

walletRouter.get('/summary/portfolio', authenticate, WalletController.getPortfolio);
walletRouter.get('/transactions', authenticate, WalletController.getAllTransactions);
walletRouter.post('/swap', authenticate, WalletController.swap);
walletRouter.get('/', authenticate, WalletController.getAll);
walletRouter.get('/:currency', authenticate, WalletController.getByCurrency);
walletRouter.get('/:currency/transactions', authenticate, WalletController.getTransactions);
