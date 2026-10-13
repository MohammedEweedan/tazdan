import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload, verifyUploads, discardUploadsOnFailure } from '../middleware/upload';
import { UserController } from '../controllers/user.controller';

export const userRouter = Router();

userRouter.put('/profile', authenticate, UserController.updateProfile);
userRouter.put('/password', authenticate, UserController.changePassword);
// Documents are content-checked and stripped of location metadata; a
// rejected submission deletes its files.
userRouter.post('/kyc', authenticate, discardUploadsOnFailure, upload.array('documents', 3), verifyUploads, UserController.submitKYC);
userRouter.get('/kyc', authenticate, UserController.getKYCStatus);
userRouter.get('/notifications', authenticate, UserController.getNotifications);
userRouter.put('/notifications/:id/read', authenticate, UserController.markNotificationRead);
userRouter.get('/referrals', authenticate, UserController.getReferrals);
userRouter.post('/bank-accounts', authenticate, UserController.addBankAccount);
userRouter.get('/bank-accounts', authenticate, UserController.getBankAccounts);
userRouter.post('/linked-wallets', authenticate, UserController.linkUSDTWallet);
userRouter.get('/linked-wallets', authenticate, UserController.getLinkedWallets);
userRouter.delete('/linked-wallets/:id', authenticate, UserController.deleteLinkedWallet);
userRouter.get('/statement', authenticate, UserController.generateStatement);
// Account deletion (closure) — App Store 5.1.1(v) / Google Play account deletion.
userRouter.get('/me/limits', authenticate, UserController.getLimits);
userRouter.get('/me/closure', authenticate, UserController.getClosure);
// No IP limiter: customers share mobile IPs; the step-up code caps attempts per challenge.
userRouter.post('/me/close', authenticate, UserController.closeAccount);
