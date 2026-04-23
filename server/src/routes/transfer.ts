import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { TransferController } from '../controllers/transfer.controller';

export const transferRouter = Router();

transferRouter.use(authenticate);
transferRouter.post('/send', TransferController.send);
transferRouter.get('/history', TransferController.getHistory);
