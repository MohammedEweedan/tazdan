import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// WhatsApp webhook endpoint (no auth required for incoming messages)
router.post('/webhook', WhatsAppController.receiveMessage);

// Admin only routes
router.use(authenticate);
router.post('/send', WhatsAppController.sendMessage);
router.get('/messages', WhatsAppController.getMessages);
router.get('/stats', WhatsAppController.getStats);

export default router;
