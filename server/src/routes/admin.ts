import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/dashboard', AdminController.getDashboard);
adminRouter.put('/rates/:base/:quote', AdminController.updateRates);
adminRouter.get('/deposits', AdminController.getDeposits);
adminRouter.put('/deposits/:id/confirm', AdminController.confirmDeposit);
adminRouter.put('/deposits/:id/reject', AdminController.rejectDeposit);
adminRouter.get('/withdrawals', AdminController.getWithdrawals);
adminRouter.put('/withdrawals/:id/process', AdminController.processWithdrawal);
adminRouter.put('/withdrawals/:id/reject', AdminController.rejectWithdrawal);
adminRouter.get('/kyc', AdminController.getKYC);
adminRouter.put('/kyc/:userId/approve', AdminController.approveKYC);
adminRouter.put('/kyc/:userId/reject', AdminController.rejectKYC);
adminRouter.get('/users', AdminController.getUsers);
adminRouter.put('/users/:id/status', AdminController.updateUserStatus);
adminRouter.get('/settings', AdminController.getSettings);
adminRouter.put('/settings', AdminController.updateSettings);
adminRouter.get('/orders', AdminController.getOrders);
adminRouter.get('/audit-log', AdminController.getAuditLog);
adminRouter.get('/on-chain-txs', AdminController.getOnChainTxs);
adminRouter.put('/on-chain-txs/:id/sent', AdminController.markOnChainTxSent);
adminRouter.get('/aml-flags', AdminController.getAMLFlags);
adminRouter.put('/aml-flags/:id/resolve', AdminController.resolveAMLFlag);
