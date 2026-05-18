import { Router } from 'express';
import { z } from 'zod';
import Expo from 'expo-server-sdk';
import { authenticate } from '../middleware/auth';
import { NotificationController } from '../controllers/notification.controller';
import { prisma } from '../utils/prisma';
import type { AuthRequest } from '../types';

const router = Router();

router.get('/', authenticate, NotificationController.getAll);
router.get('/unread-count', authenticate, NotificationController.getUnreadCount);
router.put('/:id/read', authenticate, NotificationController.markRead);
router.put('/read-all', authenticate, NotificationController.markAllRead);

const tokenSchema = z.object({ token: z.string().min(10).max(512) });

/** POST /api/notifications/register-token — store Expo push token for the current user */
router.post('/register-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    if (!Expo.isExpoPushToken(token)) {
      res.status(400).json({ error: 'Invalid Expo push token' });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { expoPushToken: token },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/notifications/register-token — clear push token on logout */
router.delete('/register-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { expoPushToken: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as notificationRouter };
