import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthController } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);   // rotates refresh token
authRouter.post('/logout', AuthController.logout);     // revokes presented refresh token
authRouter.get('/me', authenticate, AuthController.me);
authRouter.get('/verify-email', AuthController.verifyEmail);
authRouter.post('/verify-email-code', authenticate, AuthController.verifyEmailCode);
authRouter.post('/resend-verification', authenticate, AuthController.resendVerification);
authRouter.post('/forgot-password', AuthController.forgotPassword);
authRouter.post('/reset-password', AuthController.resetPassword);
authRouter.post('/2fa/enable', authenticate, AuthController.enable2FA);
authRouter.post('/2fa/verify', authenticate, AuthController.verify2FA);
authRouter.post('/2fa/disable', authenticate, AuthController.disable2FA);
