import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ReferralController } from '../controllers/referral.controller';

const router = Router();

router.get('/dashboard', authenticate, ReferralController.getDashboard);
router.post('/claim', authenticate, ReferralController.claimRewards);

export { router as referralRouter };
