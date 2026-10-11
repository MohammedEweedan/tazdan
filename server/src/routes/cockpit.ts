/**
 * /api/cockpit — Tazdan Control Cockpit API.
 *
 * Every route: authenticate → requireAdmin (DB re-check, staff 2FA in
 * production, optional IP allowlist) → requirePermission(<specific>).
 * Existing operational queues (deposits, withdrawals, KYC, disputes…) stay
 * on /api/admin and are permission-gated there too.
 */
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { requirePermission as P } from '../services/platform/rbac';
import { CockpitOverviewController as O } from '../controllers/cockpit/overview.controller';
import { CockpitCustomersController as C } from '../controllers/cockpit/customers.controller';
import { CockpitOperationsController as X } from '../controllers/cockpit/operations.controller';
import { CockpitMoneyController as M } from '../controllers/cockpit/money.controller';
import { CockpitRiskController as K } from '../controllers/cockpit/risk.controller';
import { CockpitAnalyticsController as A } from '../controllers/cockpit/analytics.controller';
import { CockpitAiController as AI } from '../controllers/cockpit/ai.controller';
import { aiLimiter } from '../middleware/rateLimiters';
// Registers approval handlers (side-effect imports).
import '../services/ledger/adjustments.service';
import '../services/remittance/refunds.service';
import '../services/exchange/fxOverride.service';

export const cockpitRouter = Router();
cockpitRouter.use(authenticate, requireAdmin);

cockpitRouter.get('/me', P('cockpit.view'), O.me);
cockpitRouter.get('/overview', P('cockpit.view'), O.overview);
cockpitRouter.get('/overview/series', P('cockpit.view'), O.series);
cockpitRouter.get('/system', P('system.read'), O.system);
cockpitRouter.get('/search', P('cockpit.view'), X.search);

cockpitRouter.get('/customers', P('customers.read'), C.list);
cockpitRouter.get('/customers/:id', P('customers.read'), C.detail);
cockpitRouter.post('/customers/:id/freeze', P('customers.freeze'), C.freeze);
cockpitRouter.post('/customers/:id/unfreeze', P('customers.freeze'), C.unfreeze);
cockpitRouter.post('/customers/:id/restrictions', P('customers.limits'), C.restrict);
cockpitRouter.post('/customers/:id/revoke-sessions', P('customers.sessions.revoke'), C.revokeSessions);
cockpitRouter.post('/customers/:id/devices/:deviceId/revoke', P('customers.sessions.revoke'), C.revokeDevice);
cockpitRouter.post('/customers/:id/cases', P('compliance.case.manage'), C.openCase);

cockpitRouter.get('/transactions', P('transactions.read'), X.transactions);
cockpitRouter.get('/transactions/:kind/:id', P('transactions.read'), X.transactionDetail);

cockpitRouter.get('/ledger/summary', P('ledger.read'), X.ledgerSummary);
cockpitRouter.get('/ledger/entries', P('ledger.read'), X.ledgerEntries);

cockpitRouter.get('/controls', P('controls.read'), X.controls);
cockpitRouter.post('/controls', P('controls.operate'), X.setControl);

cockpitRouter.get('/approvals', P('cockpit.view'), X.approvals);
cockpitRouter.post('/approvals', P('cockpit.view'), X.requestApproval);       // per-type permission checked inside
cockpitRouter.post('/approvals/:id/decide', P('cockpit.view'), X.decideApproval); // per-type permission checked inside

cockpitRouter.get('/audit', P('audit.read'), X.audit);
cockpitRouter.get('/security', P('security.read'), X.security);

cockpitRouter.get('/staff', P('staff.manage'), X.staff);
cockpitRouter.put('/staff/:id/roles', P('staff.manage'), X.setStaffRoles);

// Remittance control centre
cockpitRouter.get('/remittance', P('remittance.read'), M.remittanceOverview);
cockpitRouter.get('/remittance/transfers', P('remittance.read'), M.remittanceList);
cockpitRouter.get('/remittance/transfers/:id', P('remittance.read'), M.remittanceDetail);
cockpitRouter.post('/remittance/transfers/:id/review', P('compliance.decide'), M.remittanceReview);
cockpitRouter.post('/remittance/transfers/:id/retry', P('remittance.operate'), M.remittanceRetry);
cockpitRouter.post('/remittance/transfers/:id/refund', P('remittance.operate'), M.remittanceRefund);
cockpitRouter.put('/remittance/corridors/:code/status', P('remittance.configure'), M.corridorStatus);
cockpitRouter.put('/remittance/corridors/:code/pricing', P('remittance.configure'), M.corridorPricing);

// FX, treasury, providers, reconciliation
cockpitRouter.get('/fx', P('fx.read'), M.fx);
cockpitRouter.post('/fx/overrides', P('fx.override'), M.fxOverrideRequest);
cockpitRouter.get('/treasury', P('treasury.read'), M.treasury);
cockpitRouter.post('/treasury/movements', P('treasury.operate'), M.treasuryMove);
cockpitRouter.put('/treasury/pools/:id/thresholds', P('treasury.operate'), M.treasuryPoolThresholds);
cockpitRouter.get('/treasury/principal', P('treasury.read'), M.principal);
cockpitRouter.post('/treasury/principal/hedges', P('treasury.operate'), M.principalHedge);
cockpitRouter.put('/treasury/principal/limits', P('controls.operate'), M.principalLimits);
cockpitRouter.get('/providers', P('providers.read'), M.providers);
cockpitRouter.put('/providers/:code/status', P('providers.control'), M.providerStatus);
cockpitRouter.get('/providers/:code/calls', P('providers.read'), M.providerCalls);
cockpitRouter.get('/reconciliation', P('recon.read'), M.recon);
cockpitRouter.post('/reconciliation/runs', P('recon.run'), M.reconRun);
cockpitRouter.post('/reconciliation/items/:id/resolve', P('recon.resolve'), M.reconResolve);
cockpitRouter.get('/reconciliation/fund-integrity', P('recon.read'), M.fundIntegrity);
cockpitRouter.post('/reconciliation/fund-integrity/baseline', P('adjustments.approve'), M.fundBaseline);

// Compliance, fraud, support, businesses
cockpitRouter.get('/compliance', P('compliance.read'), K.compliance);
cockpitRouter.get('/compliance/cases/:id', P('compliance.read'), K.caseDetail);
cockpitRouter.post('/compliance/cases/:id/transition', P('compliance.case.manage'), K.caseTransition);
cockpitRouter.post('/compliance/cases/:id/notes', P('compliance.case.manage'), K.caseNote);
cockpitRouter.post('/compliance/screening/:id/review', P('compliance.decide'), K.screeningReview);
cockpitRouter.get('/compliance/rules', P('compliance.read'), K.rules);
cockpitRouter.put('/compliance/rules/:code', P('rules.manage'), K.updateRule);
cockpitRouter.get('/compliance/watchlist', P('compliance.read'), K.watchlist);
cockpitRouter.post('/compliance/watchlist/import', P('watchlist.manage'), K.watchlistImport);
cockpitRouter.post('/compliance/watchlist/refresh', P('watchlist.manage'), K.watchlistRefresh);
cockpitRouter.get('/fraud', P('fraud.read'), K.fraud);
cockpitRouter.get('/support', P('support.read'), K.support);
cockpitRouter.get('/support/customers/:userId', P('support.read'), K.supportContext);
cockpitRouter.get('/businesses', P('businesses.read'), K.businesses);
cockpitRouter.get('/businesses/:id', P('businesses.read'), K.businessDetail);
cockpitRouter.post('/businesses/:id/kyb', P('businesses.kyb.review'), K.kybDecision);
cockpitRouter.post('/businesses/batches/:id/review', P('compliance.decide'), K.batchReview);

// Finance and forecasting
cockpitRouter.get('/finance', P('finance.read'), A.finance);
cockpitRouter.get('/forecasts', P('forecast.read'), A.forecasts);

// AI control layer (read-only tools, drafts need a person to accept)
cockpitRouter.get('/ai/status', P('ai.use'), AI.status);
cockpitRouter.post('/ai/ask', P('ai.use'), aiLimiter, AI.ask);
cockpitRouter.post('/ai/cases/:id/summary', P('ai.use'), P('compliance.read'), aiLimiter, AI.caseSummary);
cockpitRouter.post('/ai/support/:id/draft', P('ai.use'), P('support.read'), aiLimiter, AI.supportDraft);
cockpitRouter.post('/ai/interactions/:id/decision', P('ai.use'), AI.decide);
cockpitRouter.get('/ai/interactions', P('ai.use'), AI.interactions);
cockpitRouter.get('/ai/interactions/:id', P('ai.use'), AI.interaction);
