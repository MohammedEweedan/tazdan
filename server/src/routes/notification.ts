import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();

router.get('/', authenticate, NotificationController.getAll);
router.get('/unread-count', authenticate, NotificationController.getUnreadCount);
router.get('/latest-announcement', authenticate, NotificationController.getLatestAnnouncement);
router.put('/:id/read', authenticate, NotificationController.markRead);
router.put('/read-all', authenticate, NotificationController.markAllRead);

export { router as notificationRouter };
