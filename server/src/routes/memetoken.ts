import { Router } from 'express';
import { MemeTokenController } from '../controllers/memetoken.controller';
import { authenticate } from '../middleware/auth';

const memeTokenRouter = Router();

memeTokenRouter.get('/fees', authenticate, MemeTokenController.getFees);
memeTokenRouter.post('/', authenticate, MemeTokenController.create);
memeTokenRouter.get('/mine', authenticate, MemeTokenController.getMyTokens);
memeTokenRouter.get('/', authenticate, MemeTokenController.getAll);

export { memeTokenRouter };
