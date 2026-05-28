import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();

router.get('/', authenticate, NotificationController.getAll);
router.get('/unread-count', authenticate, NotificationController.getUnreadCount);
router.get('/latest-announcement', authenticate, NotificationController.getLatestAnnouncement);
router.put('/:id/read', authenticate, NotificationController.markRead);
router.put('/read-all', authenticate, NotificationController.markAllRead);

// Push token registration (called from mobile after login / on logout)
router.post('/register-token',  authenticate, NotificationController.registerToken);
router.delete('/register-token', authenticate, NotificationController.unregisterToken);

// Per-category notification preferences (email + push)
router.get('/preferences', authenticate, NotificationController.getPreferences);
router.put('/preferences', authenticate, NotificationController.updatePreferences);

export { router as notificationRouter };
