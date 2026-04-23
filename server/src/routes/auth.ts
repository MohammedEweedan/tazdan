import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.get('/me', authenticate, AuthController.me);
authRouter.post('/2fa/enable', authenticate, AuthController.enable2FA);
authRouter.post('/2fa/verify', authenticate, AuthController.verify2FA);
authRouter.post('/2fa/disable', authenticate, AuthController.disable2FA);
