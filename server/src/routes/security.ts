import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { SecurityController } from '../controllers/security.controller';

const router = Router();

router.get('/overview', authenticate, SecurityController.getOverview);
router.get('/login-history', authenticate, SecurityController.getLoginHistory);
router.get('/sessions', authenticate, SecurityController.getSessions);
router.delete('/sessions/:id', authenticate, SecurityController.revokeSession);
router.delete('/sessions', authenticate, SecurityController.revokeAllSessions);

export { router as securityRouter };
