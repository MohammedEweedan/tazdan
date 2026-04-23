import { Router } from 'express';
import { LinkedWalletController } from '../controllers/linkedWallet.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', LinkedWalletController.getAll);
router.post('/', LinkedWalletController.create);
router.put('/:id', LinkedWalletController.update);
router.delete('/:id', LinkedWalletController.delete);

export default router;
