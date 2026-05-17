import { Router } from 'express';
import { PlatformBanksController } from '../controllers/platformBanks.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Authenticated read — only logged-in users need to see deposit rails.
router.use(authenticate);
router.get('/', PlatformBanksController.list);

export default router;
