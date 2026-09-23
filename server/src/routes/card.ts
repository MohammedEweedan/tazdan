import { Router } from 'express';
import { CardController } from '../controllers/card.controller';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../utils/features';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Public: tier catalogue (used by landing / dashboard upgrade flow)
router.get('/tiers', CardController.tiers);

// Authenticated user endpoints
router.use(authenticate);

router.get('/', CardController.list);
// New card activity is behind FEATURE_CARDS (off in production until a real
// issuer is integrated). Reading, freezing and cancelling stay available.
router.post('/', requireFeature('cards'), CardController.create);
router.get('/physical-fee', CardController.physicalFee);
router.get('/:id', CardController.getOne);
router.patch('/:id', CardController.update);
router.delete('/:id', CardController.cancel);

router.post('/:id/freeze', CardController.freeze);
router.post('/:id/unfreeze', CardController.unfreeze);

router.get('/:id/transactions', CardController.transactions);
// Simulated purchases exist only for development. There is no card network
// behind them, so in production they would book fees and cashback for
// spending that never happened.
router.post('/:id/transactions', (_req, _res, next) => {
  if (process.env.NODE_ENV === 'production') return next(new AppError('Not found', 404));
  next();
}, CardController.recordTransaction);
router.post('/:id/topup', requireFeature('cards'), CardController.topup);
router.post('/:id/order-physical', requireFeature('cards'), CardController.orderPhysical);
router.post('/:id/fund-from-budget', requireFeature('cards'), CardController.fundFromBudget);

export const cardRouter = router;
export default router;
