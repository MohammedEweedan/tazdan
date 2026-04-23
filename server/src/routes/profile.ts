import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ProfileController } from '../controllers/profile.controller';

export const profileRouter = Router();

// Authenticated routes
profileRouter.get('/me', authenticate, ProfileController.getMyProfile);
profileRouter.put('/me', authenticate, ProfileController.updateProfile);

// Public route (no auth)
profileRouter.get('/:username', ProfileController.getPublicProfile);
