import { Router } from 'express';
import { GeoController } from '../controllers/geo.controller';

const router = Router();

// All public — no auth required. The country / bank pickers run on the
// auth screens (signup, KYC) before a JWT is available.
router.get('/',                       GeoController.listCountries);
router.get('/:cca2',                  GeoController.getCountry);
router.get('/:cca2/banks',            GeoController.getBanks);
router.get('/:cca2/payment-methods',  GeoController.getPaymentMethods);

export default router;
