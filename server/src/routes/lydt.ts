import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { LydtController as L } from '../controllers/lydt.controller';

/** LYDT dinar token (sandbox). Supervisor actions live under /api/cockpit/lydt. */
export const lydtRouter = Router();

// Public: the reserve report is the transparency dashboard.
lydtRouter.get('/reserves', L.reserves);

lydtRouter.use(authenticate);
lydtRouter.get('/me', L.me);
lydtRouter.post('/issue', L.issue);
lydtRouter.post('/redeem', L.redeem);
lydtRouter.post('/transfer', L.transfer);
