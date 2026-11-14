import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { payeeLookupLimiter } from '../middleware/rateLimiters';
import { PayController } from '../controllers/pay.controller';

/** Pay tab: who a scanned code or typed @handle belongs to, plus the
 *  business Apple Wallet card download. Money moves through
 *  POST /api/transactions/transfer like any other send. */
export const payRouter = Router();

// Before `authenticate`: Safari opens this without the app's token; the
// short-lived signed link is the credential.
payRouter.get('/wallet/apple/:token', payeeLookupLimiter, PayController.applePass);

payRouter.use(authenticate);
payRouter.get('/recent', PayController.recent);
payRouter.get('/payee/:ref', payeeLookupLimiter, PayController.payee);
// A merchant's live offers, deals and news (KYB-approved business accounts only).
payRouter.get('/payee/:ref/posts', payeeLookupLimiter, PayController.posts);
