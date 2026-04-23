import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { DepositController } from '../controllers/deposit.controller';

export const depositRouter = Router();

depositRouter.get('/info/payment-methods', authenticate, DepositController.getPaymentMethods);
depositRouter.post('/', authenticate, upload.single('proof'), DepositController.create);
depositRouter.get('/', authenticate, DepositController.getAll);
depositRouter.get('/:id', authenticate, DepositController.getById);
depositRouter.put('/:id/cancel', authenticate, DepositController.cancel);
