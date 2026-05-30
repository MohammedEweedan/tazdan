import { Router } from 'express';
import { RecurringBuyController } from '../controllers/recurringBuy.controller';
import { authenticate } from '../middleware/auth';

export const recurringBuyRouter = Router();

recurringBuyRouter.use(authenticate);

recurringBuyRouter.get('/', RecurringBuyController.list);
recurringBuyRouter.post('/', RecurringBuyController.create);
recurringBuyRouter.put('/:id', RecurringBuyController.update);
recurringBuyRouter.delete('/:id', RecurringBuyController.remove);
recurringBuyRouter.post('/:id/run', RecurringBuyController.runNow);

export default recurringBuyRouter;
