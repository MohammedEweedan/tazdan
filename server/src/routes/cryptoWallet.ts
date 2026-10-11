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
// Self-custody key export is disabled. Exporting a deposit-address key while
// the platform keeps crediting that address (and keeps the custodial ledger
// and USDT balances) leaves the same funds spendable twice. It stays off
// until custody moves to an omnibus wallet and export becomes a withdrawal.
cryptoWalletRouter.post('/export', authenticate, (_req, res) => {
  res.status(410).json({ error: 'Wallet key export is not available.' });
});
