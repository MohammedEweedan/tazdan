import { Router, raw } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { DepositController } from '../controllers/deposit.controller';

export const depositRouter = Router();

depositRouter.get('/info/payment-methods', authenticate, DepositController.getPaymentMethods);

// Gateway (Stripe/MoonPay) flow.
depositRouter.post('/gateway/quote',    authenticate, DepositController.gatewayQuote);
depositRouter.post('/gateway/confirm',  authenticate, DepositController.gatewayConfirm);

// Webhooks are unauthenticated but HMAC-verified. raw() preserves the
// exact body bytes the provider signed.
depositRouter.post('/webhook/stripe',    raw({ type: '*/*', limit: '256kb' }), DepositController.webhookStripe);
depositRouter.post('/webhook/alchemy',   raw({ type: '*/*', limit: '512kb' }), DepositController.webhookAlchemy);
depositRouter.post('/webhook/trongrid',  raw({ type: '*/*', limit: '512kb' }), DepositController.webhookTrongrid);

// Bank-transfer (manual review) flow.
depositRouter.post('/', authenticate, upload.single('proof'), DepositController.create);
depositRouter.get('/', authenticate, DepositController.getAll);
depositRouter.get('/:id', authenticate, DepositController.getById);
depositRouter.put('/:id/cancel', authenticate, DepositController.cancel);

// CRITICAL: confirm credits the wallet. NEVER let the depositor confirm
// their own pending deposit — that's a money printer (no funds need to
// have actually been wired). Ops/admin verifies the wire landed in our
// bank account, *then* hits this endpoint to release the credit.
depositRouter.put('/:id/confirm', authenticate, requireAdmin, DepositController.confirm);
