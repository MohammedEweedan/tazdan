import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { withdrawalLimiter } from '../middleware/rateLimiters';
import { BusinessController as B } from '../controllers/business.controller';
import { BusinessTillsController as T } from '../controllers/businessTills.controller';
import { BusinessStorefrontController as SF } from '../controllers/businessStorefront.controller';

const router = Router();
router.use(authenticate);

router.get('/profile', B.profile);
router.patch('/profile', B.updateProfile);
router.post('/kyb/submit', B.submitKyb);

router.get('/pay-code', B.payCode);
router.post('/pay-code/apple-wallet', B.appleWalletLink);
router.post('/pay-code/google-wallet', B.googleWalletLink);
router.get('/stats', B.stats);

// Tills: checkout points with their own QR, kiosk feed and per-till metrics.
router.get('/tills', T.list);
router.post('/tills', T.create);
router.patch('/tills/:id', T.update);
router.get('/tills/:id/payments', T.payments);
router.get('/tills/:id/code', T.code);

// Business logo (shown on the QR, plaque and public profile).
router.post('/logo', SF.logo);

// Kiosk manager PIN (set by owner/admin; checked to leave kiosk mode).
router.get('/kiosk-pin', SF.pinStatus);
router.put('/kiosk-pin', SF.setPin);
router.post('/kiosk-pin/verify', SF.verifyPin);

// Public posts: offers, deals and news on the business's profile.
router.get('/posts', SF.posts);
router.post('/posts', SF.createPost);
router.patch('/posts/:id', SF.updatePost);
router.delete('/posts/:id', SF.deletePost);

// Till plaque orders (produced and shipped by the tazdan team).
router.get('/plaques', SF.plaques);
router.post('/plaques', SF.orderPlaques);
router.post('/plaques/:id/cancel', SF.cancelPlaque);

router.get('/api-keys', B.listApiKeys);
router.post('/api-keys', B.createApiKey);
router.delete('/api-keys/:id', B.revokeApiKey);

router.get('/team', B.listTeam);
router.post('/team/invite', B.invite);
router.patch('/team/:id/role', B.updateRole);
router.delete('/team/:id', B.removeMember);
router.get('/invitations', B.myInvitations);
router.post('/invitations/:id/accept', B.acceptInvitation);

router.post('/bulk-pay/preview', B.preview);
router.post('/bulk-pay', withdrawalLimiter, B.submit);
router.get('/payouts', B.listPayouts);
router.get('/payouts/:id', B.getPayout);
router.post('/payouts/:id/cancel', B.cancel);
router.get('/batches', B.listBatches);
router.get('/batches/:id', B.getBatch);
router.post('/batches/:id/approve', B.approve);
router.post('/batches/:id/reject', B.reject);

router.get('/webhooks', B.listWebhooks);
router.post('/webhooks', B.createWebhook);
router.delete('/webhooks/:id', B.deleteWebhook);
router.get('/webhooks/:id/deliveries', B.deliveries);

export { router as businessRouter };
