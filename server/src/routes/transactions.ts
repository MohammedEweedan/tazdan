/**
 * Transaction routes — unified financial operations.
 *
 * POST   /api/transactions/transfer — internal wallet-to-wallet transfer
 * GET    /api/transactions/recipient-check — can a recipient receive? (UX pre-check)
 * GET    /api/transactions          — list user's transactions (with filters)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { TransactionController } from '../controllers/transaction.controller';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

/**
 * POST /api/transactions/transfer
 * Internal wallet-to-wallet transfer.
 * Body: { receiverId, currency, amount, note?, fee? }
 */
router.post('/transfer', TransactionController.internalTransfer);

/**
 * GET /api/transactions/recipient-check?recipientId=<uuid>
 * Can this person receive a payment from me? { canReceive, reason?: 'SELF' | 'UNAVAILABLE' }
 * (per-customer limit inside the handler; never discloses why).
 */
router.get('/recipient-check', TransactionController.recipientCheck);

/**
 * GET /api/transactions
 * List user's transactions with optional filters.
 * Query: type?, currency?, page?, limit?
 */
router.get('/', TransactionController.list);

export default router;
