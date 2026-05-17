import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';
import { AdminExtrasController as X } from '../controllers/adminExtras.controller';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/dashboard', AdminController.getDashboard);
adminRouter.get('/rates', AdminController.getRates);
adminRouter.post('/rates', AdminController.createRate);
adminRouter.put('/rates/:base/:quote', AdminController.updateRates);
adminRouter.delete('/rates/:base/:quote/override', AdminController.clearRateOverride);
adminRouter.post('/rates/:base/:quote/refresh', AdminController.refreshRateFromApi);
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
adminRouter.put('/users/:id/freeze',   AdminController.freezeUser);
adminRouter.put('/users/:id/unfreeze', AdminController.unfreezeUser);

// Freeze a transaction: kind = order | withdrawal | deposit
adminRouter.put('/transactions/:kind/:id/freeze', AdminController.freezeTransaction);

// Send a message AS the support user (admin reply)
adminRouter.post('/support/reply', AdminController.sendAsSupport);
adminRouter.get('/settings', AdminController.getSettings);
adminRouter.put('/settings', AdminController.updateSettings);
adminRouter.get('/orders', AdminController.getOrders);
adminRouter.get('/audit-log', AdminController.getAuditLog);
adminRouter.get('/on-chain-txs', AdminController.getOnChainTxs);
adminRouter.put('/on-chain-txs/:id/sent', AdminController.markOnChainTxSent);
adminRouter.get('/aml-flags', AdminController.getAMLFlags);
adminRouter.put('/aml-flags/:id/resolve', AdminController.resolveAMLFlag);

// Real-time platform metrics
adminRouter.get('/metrics', AdminController.getMetrics);

// Support escalations
adminRouter.get('/escalations', AdminController.getEscalations);
adminRouter.put('/escalations/:id/assign', AdminController.assignEscalation);
adminRouter.put('/escalations/:id/resolve', AdminController.resolveEscalation);

// ── Extended admin coverage (every model the dashboard can see) ──
adminRouter.get('/p2p/listings',     X.listP2PListings);
adminRouter.get('/p2p/trades',       X.listP2PTrades);
adminRouter.get('/p2p/disputes',     X.listP2PDisputes);
adminRouter.put('/p2p/disputes/:id/resolve', X.resolveP2PDispute);

adminRouter.get('/cards',                X.listCards);
adminRouter.get('/card-transactions',    X.listCardTransactions);

adminRouter.get('/messages',         X.listMessages);
adminRouter.get('/message-reports',  X.listMessageReports);
adminRouter.get('/user-blocks',      X.listUserBlocks);

adminRouter.get('/referrals',        X.listReferralRewards);

adminRouter.get('/api-keys',         X.listApiKeys);
adminRouter.put('/api-keys/:id/revoke', X.revokeApiKey);
adminRouter.get('/sessions',         X.listSessions);
adminRouter.delete('/sessions/:id',  X.revokeSession);
adminRouter.get('/login-history',    X.listLoginHistory);

adminRouter.get('/whatsapp/messages', X.listWhatsAppMessages);
adminRouter.get('/whatsapp/stats',    X.whatsappStats);

adminRouter.get('/onramps',          X.listOnRamps);
adminRouter.get('/offramps',         X.listOffRamps);

adminRouter.get('/markets',          X.listMarkets);
adminRouter.put('/markets/:id/toggle', X.toggleMarket);

adminRouter.get('/onchain-transactions', X.listOnChainTransactions);
adminRouter.get('/withdrawal-whitelist', X.listWithdrawalWhitelist);

adminRouter.get('/transfers',        X.listTransfers);

adminRouter.get('/notifications',    X.listNotifications);
adminRouter.post('/notifications/broadcast', X.broadcastNotification);

// Platform bank accounts (deposit rails admins manage)
adminRouter.get('/platform-banks',          X.listPlatformBanks);
adminRouter.post('/platform-banks',         X.createPlatformBank);
adminRouter.put('/platform-banks/:id',      X.updatePlatformBank);
adminRouter.delete('/platform-banks/:id',   X.deletePlatformBank);
