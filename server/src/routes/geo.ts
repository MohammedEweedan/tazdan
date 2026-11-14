import { Router } from 'express';
import { GeoController } from '../controllers/geo.controller';

const router = Router();

// Country codes go into provider URLs and cache keys: two letters only.
router.param('cca2', (_req, res, next, value) => {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value)) { res.status(400).json({ error: 'Invalid country code' }); return; }
  next();
});

// All public — no auth required. The country / bank pickers run on the
// auth screens (signup, KYC) before a JWT is available.
router.get('/',                       GeoController.listCountries);
router.get('/:cca2',                  GeoController.getCountry);
router.get('/:cca2/banks',            GeoController.getBanks);
router.get('/:cca2/payment-methods',  GeoController.getPaymentMethods);

export default router;
