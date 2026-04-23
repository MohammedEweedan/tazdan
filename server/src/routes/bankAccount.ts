import { Router } from 'express';
import { BankAccountController } from '../controllers/bankAccount.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', BankAccountController.getAll);
router.post('/', BankAccountController.create);
router.put('/:id', BankAccountController.update);
router.delete('/:id', BankAccountController.delete);

export default router;
