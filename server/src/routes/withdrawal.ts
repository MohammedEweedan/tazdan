import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { WithdrawalController } from '../controllers/withdrawal.controller';

export const withdrawalRouter = Router();

withdrawalRouter.post('/', authenticate, WithdrawalController.create);
withdrawalRouter.get('/', authenticate, WithdrawalController.getAll);
withdrawalRouter.put('/:id/cancel', authenticate, WithdrawalController.cancel);
