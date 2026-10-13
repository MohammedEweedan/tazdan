import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';
import { AdminExtrasController as X } from '../controllers/adminExtras.controller';
import { mediaUpload } from '../middleware/mediaUpload';
import { requirePermission as P } from '../services/platform/rbac';
import { maskPiiForStaff, companyDataOnly } from '../services/platform/pii';

export const adminRouter = Router();

// Every admin route needs staff access (requireAdmin: DB re-check, 2FA in
// production, optional IP allowlist) AND the specific permission named on the
// route. Admins without explicit staff roles keep SUPER_ADMIN for the mobile
// console; give them roles in the cockpit to apply least privilege.
adminRouter.use(authenticate, requireAdmin);
// Contact details, account numbers and document links are masked in every
// response for staff without customers.pii (see services/platform/pii.ts).
adminRouter.use(maskPiiForStaff);

adminRouter.get('/dashboard', P('cockpit.view'), AdminController.getDashboard);
adminRouter.get('/rates', P('fx.read'), AdminController.getRates);
adminRouter.post('/rates', P('fx.override'), AdminController.createRate);
adminRouter.put('/rates/:base/:quote', P('fx.override'), AdminController.updateRates);
adminRouter.delete('/rates/:base/:quote/override', P('fx.override'), AdminController.clearRateOverride);
adminRouter.post('/rates/:base/:quote/refresh', P('fx.override'), AdminController.refreshRateFromApi);
adminRouter.get('/deposits', P('transactions.read'), AdminController.getDeposits);
adminRouter.put('/deposits/:id/confirm', P('deposits.confirm'), AdminController.confirmDeposit);
adminRouter.put('/deposits/:id/reject', P('deposits.confirm'), AdminController.rejectDeposit);
adminRouter.get('/withdrawals', P('transactions.read'), AdminController.getWithdrawals);
adminRouter.put('/withdrawals/:id/process', P('withdrawals.approve'), AdminController.processWithdrawal);
adminRouter.put('/withdrawals/:id/reject', P('withdrawals.approve'), AdminController.rejectWithdrawal);
adminRouter.get('/kyc', P('customers.kyc.review'), AdminController.getKYC);
adminRouter.put('/kyc/:userId/approve', P('customers.kyc.review'), AdminController.approveKYC);
adminRouter.put('/kyc/:userId/reject', P('customers.kyc.review'), AdminController.rejectKYC);
adminRouter.get('/users', P('customers.read'), AdminController.getUsers);
adminRouter.post('/users', P('staff.manage'), AdminController.createUser);
adminRouter.get('/users/:id/balances', P('customers.read'), AdminController.getUserBalances);
adminRouter.put('/users/:id/status', P('customers.freeze'), AdminController.updateUserStatus);
adminRouter.put('/users/:id/freeze', P('customers.freeze'),   AdminController.freezeUser);
adminRouter.put('/users/:id/unfreeze', P('customers.freeze'), AdminController.unfreezeUser);

// Freeze a transaction: kind = order | withdrawal | deposit
adminRouter.put('/transactions/:kind/:id/freeze', P('controls.operate'), AdminController.freezeTransaction);

// Send a message AS the support user (admin reply)
adminRouter.post('/support/reply', P('support.reply'), AdminController.sendAsSupport);
adminRouter.get('/settings', P('cockpit.view'), AdminController.getSettings);
adminRouter.put('/settings', P('settings.manage'), AdminController.updateSettings);
adminRouter.get('/orders', P('transactions.read'), AdminController.getOrders);
adminRouter.get('/audit-log', P('audit.read'), AdminController.getAuditLog);
adminRouter.get('/on-chain-txs', P('transactions.read'), AdminController.getOnChainTxs);
adminRouter.put('/on-chain-txs/:id/sent', P('withdrawals.approve'), AdminController.markOnChainTxSent);
adminRouter.get('/aml-flags', P('compliance.read'), AdminController.getAMLFlags);
adminRouter.put('/aml-flags/:id/resolve', P('compliance.decide'), AdminController.resolveAMLFlag);

// Real-time platform metrics
adminRouter.get('/metrics', P('system.read'), AdminController.getMetrics);

// Aggregate exposure + total user holdings valuation
adminRouter.get('/exposure', P('treasury.read'), AdminController.getExposure);

// FX status — live scraped LYD parallel rates + USD/LYD order-book skew
adminRouter.get('/fx-status', P('fx.read'), AdminController.getFxStatus);

// Treasury safety — fund-integrity audit + ledger reconciliation + halt control
adminRouter.get('/fund-integrity', P('recon.read'), AdminController.getFundIntegrity);
adminRouter.post('/fund-integrity/reconcile', P('adjustments.approve'), AdminController.reconcileFundIntegrity);
adminRouter.post('/ledger/backfill-opening-balances', P('adjustments.approve'), AdminController.backfillLedgerOpeningBalances);
adminRouter.post('/clear-trading-halt', P('controls.operate'), AdminController.clearTradingHalt);
adminRouter.get('/operational-readiness', P('system.read'), AdminController.getOperationalReadiness);
adminRouter.post('/daily-close', P('recon.run'), AdminController.runDailyClose);
adminRouter.post('/audit-log/review', P('audit.read'), AdminController.markAuditLogReviewed);

// Production-safe manual wallet credit
adminRouter.post('/manual-credit', P('adjustments.request'), AdminController.manualCredit);

// Backfill historical fees from existing orders/withdrawals/P2P trades
adminRouter.post('/backfill-fees', P('settings.manage'), AdminController.backfillFees);

// Dev-only: directly credit a user's wallet (simulator / testing use only)
adminRouter.post('/seed-balance', P('staff.manage'), AdminController.seedBalance);

// Support escalations
adminRouter.get('/escalations', P('support.read'), AdminController.getEscalations);
adminRouter.put('/escalations/:id/assign', P('support.reply'), AdminController.assignEscalation);
adminRouter.put('/escalations/:id/resolve', P('support.reply'), AdminController.resolveEscalation);

// ── Extended admin coverage (every model the dashboard can see) ──
adminRouter.get('/p2p/listings', P('transactions.read'),     X.listP2PListings);
adminRouter.get('/p2p/trades', P('transactions.read'),       X.listP2PTrades);
adminRouter.get('/p2p/disputes', P('transactions.read'),     X.listP2PDisputes);
adminRouter.put('/p2p/disputes/:id/resolve', P('disputes.resolve'), X.resolveP2PDispute);

adminRouter.get('/cards', P('transactions.read'),                X.listCards);
adminRouter.get('/card-transactions', P('transactions.read'),    X.listCardTransactions);

adminRouter.get('/messages', P('support.read'),         X.listMessages);
adminRouter.get('/message-reports', P('support.read'),  X.listMessageReports);
adminRouter.get('/user-blocks', P('support.read'),      X.listUserBlocks);

adminRouter.get('/referrals', P('finance.read'),        X.listReferralRewards);

adminRouter.get('/api-keys', P('security.read'),         X.listApiKeys);
adminRouter.put('/api-keys/:id/revoke', P('controls.operate'), X.revokeApiKey);
adminRouter.get('/sessions', P('security.read'),         X.listSessions);
adminRouter.delete('/sessions/:id', P('customers.sessions.revoke'),  X.revokeSession);
adminRouter.get('/login-history', P('security.read'),    X.listLoginHistory);

adminRouter.get('/whatsapp/messages', P('support.read'), X.listWhatsAppMessages);
adminRouter.get('/whatsapp/stats', P('support.read'),    X.whatsappStats);

adminRouter.get('/onramps', P('transactions.read'),          X.listOnRamps);
adminRouter.get('/offramps', P('transactions.read'),         X.listOffRamps);

adminRouter.get('/markets', P('cockpit.view'),          X.listMarkets);
adminRouter.put('/markets/:id/toggle', P('settings.manage'), X.toggleMarket);

adminRouter.get('/onchain-transactions', P('transactions.read'), X.listOnChainTransactions);
adminRouter.get('/withdrawal-whitelist', P('security.read'), X.listWithdrawalWhitelist);

adminRouter.get('/transfers', P('transactions.read'),        X.listTransfers);

// Waitlist — view signups, send the launch blast, resend confirmations
adminRouter.get('/waitlist', P('cockpit.view'),                X.listWaitlist);
adminRouter.post('/waitlist/launch', P('settings.manage'),        X.broadcastWaitlist);
adminRouter.post('/waitlist/:id/resend', P('settings.manage'),    X.resendWaitlistConfirmation);
adminRouter.delete('/waitlist/:id', P('settings.manage'),         X.deleteWaitlistEntry);

adminRouter.get('/notifications', P('cockpit.view'),                          X.listNotifications);
adminRouter.post('/notifications/broadcast', P('settings.manage'),               X.broadcastNotification);
adminRouter.get('/notifications/:broadcastId/recipients', P('cockpit.view'),  X.getBroadcastRecipients);
adminRouter.post('/media-upload', P('settings.manage'),
  (req, res, next) => {
    mediaUpload.single('file')(req, res, (err) => {
      if (err) {
        console.error('[media-upload] multer error:', err);
        return res.status(400).json({ error: err.message ?? 'Multer error' });
      }
      next();
    });
  },
  X.uploadMedia,
);

// Platform bank accounts (deposit rails admins manage)
adminRouter.get('/platform-banks', P('cockpit.view'), companyDataOnly,          X.listPlatformBanks);
adminRouter.post('/platform-banks', P('treasury.operate'), companyDataOnly,         X.createPlatformBank);
adminRouter.put('/platform-banks/:id', P('treasury.operate'), companyDataOnly,      X.updatePlatformBank);
adminRouter.delete('/platform-banks/:id', P('treasury.operate'), companyDataOnly,   X.deletePlatformBank);

// Data browser — raw paginated reads of every core model
adminRouter.get('/data/transactions', P('customers.pii'),   X.listRawTransactions);
adminRouter.get('/data/wallets', P('customers.pii'),        X.listRawWallets);
adminRouter.get('/data/bank-accounts', P('customers.pii'),  X.listRawBankAccounts);
adminRouter.get('/data/p2p-trades', P('customers.pii'),     X.listRawP2PTrades);
adminRouter.get('/data/platform-fees', P('finance.read'),  X.listPlatformFees);
