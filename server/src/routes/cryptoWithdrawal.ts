import { Router } from 'express';
import { authenticate, requireKYC } from '../middleware/auth';
import { CryptoWithdrawalController } from '../controllers/cryptoWithdrawal.controller';

export const cryptoWithdrawalRouter = Router();

// Crypto-out is the highest-risk AML surface — KYC is required just like
// fiat withdrawals (withdrawal.controller checks it inline for bank rails).
cryptoWithdrawalRouter.post('/initiate',      authenticate, requireKYC, CryptoWithdrawalController.initiate);
cryptoWithdrawalRouter.get ('/estimate-fee',  authenticate, CryptoWithdrawalController.estimate);
cryptoWithdrawalRouter.get ('/history',       authenticate, CryptoWithdrawalController.history);

// Unauthenticated but protected by X-Webhook-Secret header.
cryptoWithdrawalRouter.post('/webhook/deposit', CryptoWithdrawalController.depositWebhook);
