import { Router } from 'express';
import { CardController } from '../controllers/card.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public: tier catalogue (used by landing / dashboard upgrade flow)
router.get('/tiers', CardController.tiers);

// Authenticated user endpoints
router.use(authenticate);

router.get('/', CardController.list);
router.post('/', CardController.create);
router.get('/physical-fee', CardController.physicalFee);
router.get('/:id', CardController.getOne);
router.patch('/:id', CardController.update);
router.delete('/:id', CardController.cancel);

router.post('/:id/freeze', CardController.freeze);
router.post('/:id/unfreeze', CardController.unfreeze);

router.get('/:id/transactions', CardController.transactions);
router.post('/:id/transactions', CardController.recordTransaction);
router.post('/:id/topup', CardController.topup);
router.post('/:id/order-physical', CardController.orderPhysical);
router.post('/:id/fund-from-budget', CardController.fundFromBudget);

export const cardRouter = router;
export default router;
