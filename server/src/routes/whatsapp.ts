import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// WhatsApp webhook endpoints (no auth — Meta + Twilio call these).
// Meta:    /webhook/meta  (GET = handshake, POST = inbound)
// Twilio:  /webhook       (POST = inbound)
router.get('/webhook/meta',  WhatsAppController.verifyMetaWebhook);
router.post('/webhook/meta', WhatsAppController.receiveMetaMessage);
router.post('/webhook',      WhatsAppController.receiveMessage);

// Admin only routes
router.use(authenticate);
router.post('/send', WhatsAppController.sendMessage);
router.get('/messages', WhatsAppController.getMessages);
router.get('/stats', WhatsAppController.getStats);

export default router;
