import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CryptoWithdrawalController } from '../controllers/cryptoWithdrawal.controller';

export const cryptoWithdrawalRouter = Router();

cryptoWithdrawalRouter.post('/initiate',      authenticate, CryptoWithdrawalController.initiate);
cryptoWithdrawalRouter.get ('/estimate-fee',  authenticate, CryptoWithdrawalController.estimate);
cryptoWithdrawalRouter.get ('/history',       authenticate, CryptoWithdrawalController.history);

// Unauthenticated but protected by X-Webhook-Secret header.
cryptoWithdrawalRouter.post('/webhook/deposit', CryptoWithdrawalController.depositWebhook);
