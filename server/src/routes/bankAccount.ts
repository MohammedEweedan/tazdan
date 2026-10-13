import { Router } from 'express';
import { BankAccountController } from '../controllers/bankAccount.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.param('country', (_req, res, next, value) => {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value)) { res.status(400).json({ error: 'Invalid country code' }); return; }
  next();
});

router.get('/banks/:country', BankAccountController.getBanksByCountry);
router.get('/', BankAccountController.getAll);
router.post('/', BankAccountController.create);
router.put('/:id', BankAccountController.update);
router.delete('/:id', BankAccountController.delete);

export default router;
