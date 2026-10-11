import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { requirePermission } from '../services/platform/rbac';

const router = Router();

// WhatsApp webhook endpoints (no auth — Meta + Twilio call these).
// Meta:    /webhook/meta  (GET = handshake, POST = inbound)
// Twilio:  /webhook       (POST = inbound)
router.get('/webhook/meta',  WhatsAppController.verifyMetaWebhook);
router.post('/webhook/meta', WhatsAppController.receiveMetaMessage);
router.post('/webhook',      WhatsAppController.receiveMessage);

// Admin only routes
router.use(authenticate, requireAdmin);
router.post('/send', requirePermission('support.reply'), WhatsAppController.sendMessage);
router.get('/messages', requirePermission('support.read'), WhatsAppController.getMessages);
router.get('/stats', requirePermission('support.read'), WhatsAppController.getStats);

export default router;
