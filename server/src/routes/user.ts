import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { UserController } from '../controllers/user.controller';

export const userRouter = Router();

userRouter.put('/profile', authenticate, UserController.updateProfile);
userRouter.put('/password', authenticate, UserController.changePassword);
userRouter.post('/kyc', authenticate, upload.array('documents', 3), UserController.submitKYC);
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
