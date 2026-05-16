import { Router, raw } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { DepositController } from '../controllers/deposit.controller';

export const depositRouter = Router();

depositRouter.get('/info/payment-methods', authenticate, DepositController.getPaymentMethods);

// Gateway (Stripe/MoonPay) flow.
depositRouter.post('/gateway/quote',    authenticate, DepositController.gatewayQuote);
depositRouter.post('/gateway/confirm',  authenticate, DepositController.gatewayConfirm);

// Webhook is unauthenticated (signed by provider). raw() preserves
// the exact body bytes the provider signed; without this the HMAC
// check fails because express.json() re-serialises numbers and
// reorders keys.
depositRouter.post(
  '/webhook/stripe',
  raw({ type: '*/*', limit: '256kb' }),
  DepositController.webhookStripe,
);

// Bank-transfer (manual review) flow.
depositRouter.post('/', authenticate, upload.single('proof'), DepositController.create);
depositRouter.get('/', authenticate, DepositController.getAll);
depositRouter.get('/:id', authenticate, DepositController.getById);
depositRouter.put('/:id/cancel', authenticate, DepositController.cancel);
