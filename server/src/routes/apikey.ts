import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { APIKeyController } from '../controllers/apikey.controller';

const router = Router();

router.get('/', authenticate, APIKeyController.getAll);
router.post('/', authenticate, APIKeyController.create);
router.put('/:id/revoke', authenticate, APIKeyController.revoke);
router.delete('/:id', authenticate, APIKeyController.delete);

export { router as apiKeyRouter };
