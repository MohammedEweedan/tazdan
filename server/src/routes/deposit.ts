import { Router, raw } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { upload, verifyUploads, discardUploadsOnFailure } from '../middleware/upload';
import { requireHeaderSecret, requireHmacSignature } from '../middleware/webhookGuards';
import { prisma } from '../utils/prisma';
import { assertNotSelf } from '../services/platform/segregation';
import type { AuthRequest } from '../types';
import type { NextFunction, Response } from 'express';
import { DepositController } from '../controllers/deposit.controller';
import { requirePermission } from '../services/platform/rbac';

export const depositRouter = Router();

depositRouter.get('/info/payment-methods', authenticate, DepositController.getPaymentMethods);

// Gateway (Stripe/MoonPay) flow.
depositRouter.post('/gateway/quote',    authenticate, DepositController.gatewayQuote);
depositRouter.post('/gateway/confirm',  authenticate, DepositController.gatewayConfirm);

// Webhooks are unauthenticated but HMAC-verified. raw() preserves the
// exact body bytes the provider signed.
depositRouter.post('/webhook/stripe',    raw({ type: '*/*', limit: '256kb' }), DepositController.webhookStripe);
// The guards verify in constant time over the raw bytes and refuse in
// production when the provider secret is missing.
depositRouter.post('/webhook/alchemy',   raw({ type: '*/*', limit: '512kb' }), requireHmacSignature('ALCHEMY_WEBHOOK_SIGNING_KEY', 'x-alchemy-signature'), DepositController.webhookAlchemy);
depositRouter.post('/webhook/trongrid',  raw({ type: '*/*', limit: '512kb' }), requireHeaderSecret('TRON_WEBHOOK_API_KEY', 'x-api-key'), DepositController.webhookTrongrid);

// Bank-transfer (manual review) flow.
// Proof images are content-checked and stripped of metadata; a rejected
// request deletes its upload.
depositRouter.post('/', authenticate, discardUploadsOnFailure, upload.single('proof'), verifyUploads, DepositController.create);
depositRouter.get('/', authenticate, DepositController.getAll);
depositRouter.get('/:id', authenticate, DepositController.getById);
depositRouter.put('/:id/cancel', authenticate, DepositController.cancel);

// CRITICAL: confirm credits the wallet. NEVER let the depositor confirm
// their own pending deposit — that's a money printer (no funds need to
// have actually been wired). Ops/admin verifies the wire landed in our
// bank account, *then* hits this endpoint to release the credit.
depositRouter.put('/:id/confirm', authenticate, requireAdmin, requirePermission('deposits.confirm'), notOwnDeposit, DepositController.confirm);

/** A staff member never confirms (credits) their own deposit. */
async function notOwnDeposit(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const d = await prisma.deposit.findUnique({ where: { id: String(req.params.id) }, select: { userId: true } });
    if (d) assertNotSelf(req.user!.id, [d.userId], 'confirm_deposit', { ipAddress: req.ip, path: req.originalUrl });
    next();
  } catch (e) { next(e); }
}
