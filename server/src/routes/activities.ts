import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ActivityController } from '../controllers/activity.controller';

const router = Router();
router.use(authenticate);

// GET /api/activities — unified, paginated, time-ordered timeline.
router.get('/', ActivityController.list);

export default router;
