import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { ClaimLinkController } from '../controllers/claimLink.controller';

const router = Router();

// Sender-side (authed)
router.post('/',           authenticate, ClaimLinkController.create);
router.get ('/mine',       authenticate, ClaimLinkController.listMine);
router.post('/:id/cancel', authenticate, ClaimLinkController.cancel);

// Public preview — used by the claim screen BEFORE the recipient signs in.
// Returns only what the sender chose to share publicly.
router.get('/by-token/:token', ClaimLinkController.previewByToken);

// Recipient-side (authed). Path mirrors the public preview so the mobile
// claim screen needs a single base URL.
router.post('/by-token/:token/claim', authenticate, ClaimLinkController.claim);

// Expiry sweep — refunds expired links. Admin-only: it changes money state,
// so it must never be callable anonymously.
router.post('/sweep', authenticate, requireAdmin, ClaimLinkController.sweepExpired);

export { router as claimLinkRouter };
