import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { BudgetController } from '../controllers/budget.controller';

export const budgetRouter = Router();

budgetRouter.use(authenticate);

budgetRouter.get('/', BudgetController.list);
budgetRouter.post('/', BudgetController.create);
budgetRouter.get('/:id', BudgetController.get);
budgetRouter.patch('/:id', BudgetController.update);
budgetRouter.post('/:id/auto', BudgetController.setAuto);
budgetRouter.post('/:id/contribute', BudgetController.contribute);
budgetRouter.post('/:id/withdraw', BudgetController.withdraw);
budgetRouter.delete('/:id', BudgetController.remove);

export default budgetRouter;
