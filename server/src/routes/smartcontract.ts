import { Router } from 'express';
import { SmartContractController } from '../controllers/smartcontract.controller';
import { authenticate } from '../middleware/auth';

const smartContractRouter = Router();

smartContractRouter.get('/fees', authenticate, SmartContractController.getFees);
smartContractRouter.post('/', authenticate, SmartContractController.create);
smartContractRouter.get('/mine', authenticate, SmartContractController.getMyContracts);

export { smartContractRouter };
