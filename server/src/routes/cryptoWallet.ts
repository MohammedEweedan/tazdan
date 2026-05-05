import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CryptoWalletController } from '../controllers/cryptoWallet.controller';

export const cryptoWalletRouter = Router();

cryptoWalletRouter.get('/addresses', authenticate, CryptoWalletController.getAddresses);
cryptoWalletRouter.get('/balances', authenticate, CryptoWalletController.getBalances);
cryptoWalletRouter.get(
  '/deposit-address/:asset/:network',
  authenticate,
  CryptoWalletController.getDepositAddress,
);
cryptoWalletRouter.post('/export', authenticate, CryptoWalletController.exportWallet);
