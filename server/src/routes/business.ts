import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { withdrawalLimiter } from '../middleware/rateLimiters';
import { BusinessController as B } from '../controllers/business.controller';

const router = Router();
router.use(authenticate);

router.get('/profile', B.profile);
router.patch('/profile', B.updateProfile);
router.post('/kyb/submit', B.submitKyb);
router.get('/stats', B.stats);

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
