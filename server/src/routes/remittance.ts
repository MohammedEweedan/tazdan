import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { RemittanceController as R } from '../controllers/remittance.controller';

export const remittanceRouter = Router();

// Provider callbacks: unauthenticated, signature-verified by the adapter over the raw body.
remittanceRouter.post('/webhooks/:providerCode', R.webhook);

remittanceRouter.get('/corridors', authenticate, R.corridors);
remittanceRouter.get('/beneficiaries', authenticate, R.listBeneficiaries);
remittanceRouter.post('/beneficiaries', authenticate, R.addBeneficiary);
remittanceRouter.delete('/beneficiaries/:id', authenticate, R.archiveBeneficiary);
remittanceRouter.post('/quotes', authenticate, R.quote);
remittanceRouter.post('/transfers', authenticate, R.create);
remittanceRouter.get('/transfers', authenticate, R.list);
remittanceRouter.get('/transfers/:id', authenticate, R.get);
remittanceRouter.post('/transfers/:id/cancel', authenticate, R.cancel);
remittanceRouter.get('/transfers/:id/receipt', authenticate, R.receipt);
