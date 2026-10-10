# Change ledger — 2026-10 hardening and operating-platform programme

Branch `hardening/p0-stop-the-bleeding`, starting from commit `01de005` (see [BASELINE.md](BASELINE.md)). Changes are uncommitted at the time of writing. Each entry records what was wrong, why, what changed, how it was verified and what it touches. "Tests" names the suite that exercises the change; all suites listed pass (147 tests, 19 suites, against a disposable PostgreSQL database on 2026-10-07).

Priority follows the brief: **P0** financial correctness, broken behaviour, security; **P1** operating capability; **P2** assistance and analytics.

Contents: [P0 fixes](#p0--defects-in-existing-money-and-security-paths) · [P0 found during the final audit](#p0--found-during-the-final-forensic-audit) · [P1 platform](#p1--operating-platform) · [P2](#p2--assistance-and-analytics) · [Engineering](#engineering-and-delivery)

---

## P0 — defects in existing money and security paths

### CL-01 Admin "freeze user" destroyed reservations
- **Problem:** freezing a customer set every wallet's `frozen` to its full balance; unfreezing set `frozen` to 0.
- **Root cause:** `frozen` is the reservation ledger for pending withdrawals, budgets, claim links and P2P escrow, but freeze/unfreeze treated it as an on/off flag.
- **Existing behaviour:** unfreezing released money that was still committed to pending withdrawals and escrow, allowing it to be spent twice.
- **Change:** freeze sets `User.status = SUSPENDED`, revokes every session and sets a USER-scope kill switch that every money path checks; wallet reservations are never touched. Unfreeze restores `ACTIVE` and lifts the switch. Both are audited with a reason and notify the customer.
- **Why necessary:** money creation path.
- **Files:** `server/src/controllers/admin.controller.ts`.
- **Tests:** `cockpit.test.ts` — “freezes a customer without touching wallet reservations and blocks their money movement”.
- **Regression risk:** low — any code relying on `frozen == balance` to block spending now relies on status checks (all money paths call `assertMovementAllowed`).
- **Verification:** tests; cockpit smoke.
- **UI impact:** none (same buttons).
- **External dependency:** none.

### CL-02 Admin "freeze transaction" could rewrite settled transactions
- **Problem:** the action set any deposit/withdrawal status unconditionally.
- **Root cause:** plain `update` without a state guard.
- **Existing behaviour:** a completed withdrawal could be marked cancelled (and a confirmed deposit rejected) after money moved, desynchronising history and balances.
- **Change:** conditional transitions (`updateMany where status in [...]` + `assertTransitioned`); only non-terminal items can be held; every action audited with reason.
- **Files:** `admin.controller.ts`, `services/wallet/withdrawalHistory.ts`.
- **Tests:** no dedicated test yet (gap — see [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md)); neighbouring deposit/withdrawal flows covered by `concurrency.money.test.ts` and `integration.wallet.test.ts`.
- **Regression risk:** low.
- **Verification:** code review; type-check.
- **UI impact:** none. **External dependency:** none.

### CL-03 `POST /api/transfers/send` failed for USDT
- **Problem:** the default currency failed every time.
- **Root cause:** the query included currency variants (`USDT_ERC20`, `USDT_TRC20`) that are not values of the `Currency` enum, so Prisma rejected the query.
- **Change:** variants filtered to enum values (`WALLET_ENUM`); amounts handled as `Decimal`; kill-switch check added.
- **Files:** `transfer.controller.ts`.
- **Tests:** no dedicated test yet (gap). Verified by type-check and code review.
- **Regression risk:** low. **UI impact:** none. **External dependency:** none.

### CL-04 Transfers and chat payments skipped step-up
- **Problem:** `POST /api/transactions/transfer` (used by the mobile Send screen) and chat payments moved money without step-up; chat payments stored client-supplied `stepUpCode`/`biometricVerified` in message metadata.
- **Change:** risk-based step-up (`enforceRiskBasedStepUp`): a routine amount from a known device passes; high value or a new device needs a 6-digit code. Metadata is stripped of step-up fields before storage. Mobile Send, chat payments and business bulk-pay now pass the local biometric result and open the existing `StepUpModal` when the server asks for a code.
- **Files:** `transaction.controller.ts`, `message.controller.ts`, `claimLink.controller.ts`, `services/security/stepUp.service.ts`; mobile `src/components/exchange/SendWidget.tsx`, `app/messages/[id].tsx`, `app/business/bulk-pay.tsx`, `src/hooks/useStepUpAuth.ts`, `src/services/index.ts`, `src/services/business.ts`.
- **Tests:** chat-payment spending limits covered by `concurrency.money.test.ts` (step-up mocked there); the step-up decision itself has no dedicated test yet (gap); mobile type-check.
- **Regression risk:** medium — users on new devices now see a code prompt for payments that previously went through. Intended.
- **Verification:** tests; mobile `tsc` clean. Device testing of the modal flow is still to be done on a build.
- **UI impact:** existing step-up modal appears in two more places. **External dependency:** email delivery of codes (Resend) or TOTP.

### CL-05 Session list and "sign out other devices" did nothing
- **Problem:** Security → Sessions read a table nothing wrote; "revoke others" revoked nothing.
- **Change:** sessions are `RefreshToken` rows; access tokens carry a `sid` claim; revocation writes a Redis denylist entry and a cutoff; refresh-token reuse detection triggers only for rotated tokens (so signing out other devices no longer signs out the current one).
- **Files:** `middleware/auth.ts`, `controllers/auth.controller.ts`, `controllers/security.controller.ts`, `controllers/adminExtras.controller.ts`, `types/index.ts`.
- **Tests:** `integration.auth.test.ts` (lists real sessions and signs out every other device).
- **Regression risk:** medium — every login path now issues sessions through `issueSessionTokens`. Covered by the auth suite.
- **UI impact:** none. **External dependency:** Redis for instant revocation (falls back to token expiry without it).

### CL-06 P2P escrow double-reserved, and created money for long-tail assets
- **Problem:** the seller's funds were reserved twice; for assets held in `UserWallet.altBalances` the seller was never debited while the buyer was credited.
- **Change:** a single escrow module (`lockEscrow`, `releaseEscrowToBuyer`, `refundEscrowToSeller`, `clawBackFromBuyer`, `escrowState`) used by every P2P path, with conditional trade transitions and lifecycle records.
- **Files:** `services/p2p/escrow.ts`, `controllers/p2p.controller.ts`.
- **Tests:** `concurrency.money.test.ts` — “a P2P trade is refunded once when cancelled concurrently” (asserts the single-debit escrow model).
- **Regression risk:** medium — central P2P path rewritten; trades opened before deployment are handled by the `HELD_LEGACY` state.
- **UI impact:** none. **External dependency:** none.

### CL-07 Dispute resolution could not move escrow
- **Problem:** resolving a P2P dispute closed the dispute but left funds in escrow; its default status value was rejected by its own validator.
- **Change:** resolution requires `outcome: BUYER` (release escrow) or `SELLER` (refund seller) and moves the escrow in the same transaction. The mobile admin P2P screen now has "Release to buyer" / "Refund seller" with confirmation.
- **Files:** `adminExtras.controller.ts`; mobile `app/admin/p2p.tsx`, `src/services/index.ts`.
- **Tests:** no dedicated test of the dispute outcome yet (gap); escrow movements share the module covered by `concurrency.money.test.ts`; mobile type-check.
- **Regression risk:** low. **UI impact:** two buttons replace one. **External dependency:** none.

### CL-08 Referral rewards could be claimed twice
- **Change:** claim takes a row lock (`SELECT … FOR UPDATE`) and a conditional status transition.
- **Files:** `referral.controller.ts`. **Tests:** none yet (gap). **Risk:** low. **UI:** none.

### CL-09 Swap fabricated an on-chain hash; static fallback prices
- **Problem:** the swap receipt showed an invented transaction hash; quotes could use the static fallback price table.
- **Change:** swaps priced by `quoteConversion` from executable prices, refused when only `fallback:static` is available; no hash is invented for an internal ledger move; trading-halt check.
- **Files:** `wallet.controller.ts`, `services/exchange/conversion.service.ts`.
- **Tests:** none for the swap path yet (gap). **Risk:** low — swaps now fail closed when no live price exists. **UI:** receipt has no hash for internal swaps.

### CL-10 Mobile business portal called 26 endpoints that did not exist
- See [CL-34](#cl-34-business-platform).

### CL-11 Default administrator credentials
- **Problem:** the seed created an administrator with a default password; `create-admin` had defaults.
- **Change:** no default password anywhere. Production refuses to bootstrap an admin without a strong `ADMIN_PASSWORD`; development generates a random one; `create-admin` requires `ADMIN_EMAIL` and a 12+ character password (or prints a generated one once) and refuses in production unless `ALLOW_PRODUCTION_ADMIN_CREATE=1`.
- **Files:** `utils/seed.ts`, `scripts/create-admin.ts`, `scripts/simulate-platform-activity.ts`.
- **Tests:** none (startup path). **Risk:** low. **UI:** none.

### CL-12 Manual credits edited balances directly
- **Change:** admin credits/debits post a balanced journal against the `ADJUSTMENT` account through `postAdjustment`; amounts above `MANUAL_ADJUSTMENT_SINGLE_USD` (default 100) need a second approver (maker-checker).
- **Files:** `services/ledger/adjustments.service.ts`, `admin.controller.ts`.
- **Tests:** `balanceMutations.test.ts` — “admin manual credit posts a controlled adjustment journal”; `cockpit.test.ts` — “runs maker-checker: the requester cannot approve, a second approver executes exactly once”.
- **Risk:** low. **UI:** large credits show "sent for approval". **External dependency:** none.

### CL-13 Withdrawal fees and amounts
- **Change:** fee computed in the withdrawal currency (`feeInCurrency`), `Decimal` arithmetic, kill switches, withdrawal history kept in sync.
- **Files:** `withdrawal.controller.ts`, `services/wallet/withdrawalHistory.ts`. **Tests:** `integration.wallet.test.ts` — reservation once, one history row, release on cancel, kill switch; `concurrency.money.test.ts` — parallel requests never over-reserve.

### CL-14 Claim-link PIN could be brute-forced
- **Change:** 5 attempts per 24 h per link, constant-time comparison, kill switch, step-up.
- **Files:** `claimLink.controller.ts`. **Tests:** claim-once and claim-vs-cancel races in `concurrency.money.test.ts`; the PIN attempt cap has no dedicated test yet (gap).

### CL-15 Webhook and channel authentication
- **Change:** crypto-withdrawal webhook secret compared with `timingSafeEqual`; WhatsApp admin routes require `authenticate + requireAdmin`; the WhatsApp webhook is refused in production when Twilio is not configured.
- **Files:** `cryptoWithdrawal.controller.ts`, `routes/whatsapp.ts`, `whatsapp.controller.ts`. **Tests:** route inventory gate (auth class per route).

### CL-16 Production mocks
- **Problem:** the card issuer, on-ramp and off-ramp defaulted to `MOCK` in production; the on-ramp mock marked gateway deposits completed.
- **Change:** a provider guard (`assertAdapterUsable`) refuses MOCK and SANDBOX adapters when `NODE_ENV=production`; card issuance, freeze, unfreeze and cancel go through the issuer abstraction (`getActiveCardIssuer`); deposits use `getActiveOnRampProvider`.
- **Files:** `services/providers/guard.ts`, `services/cardIssuer/index.ts`, `services/onramp/index.ts`, `services/offramp/index.ts`, `card.controller.ts`, `deposit.controller.ts`.
- **Tests:** sandbox adapters exercised by `remittance.golden.test.ts`; the production refusal itself has no dedicated test yet (gap). **Risk:** low — production card and gateway-deposit features stay off until a real provider is configured. **External dependency:** card issuer, PSP.

### CL-17 Activity feed duplicates
- **Change:** deposit/withdrawal rows de-duplicated against their transaction mirror. **Files:** `activity.controller.ts`.

### CL-18 FX overrides never expired
- **Change:** an override is honoured until `overrideExpiresAt` (5 min – 24 h) and applied only through maker-checker (`FX_OVERRIDE`, spread ≤ 20%).
- **Files:** `services/exchange/fxRateProvider.service.ts`, `services/exchange/fxOverride.service.ts`. **Tests:** none dedicated yet (gap); maker-checker mechanics covered by `cockpit.test.ts`.

---

## P0 — found during the final forensic audit

### CL-19 Ledger reconciliation could halt trading on a false alarm
- **Problem:** `reconcileLedger` read account balances and entry sums in two separate queries.
- **Root cause:** under READ COMMITTED, a posting that committed between the two reads appeared as drift; drift sets the trading halt automatically.
- **Existing behaviour:** under live traffic the 5-minute reconciliation could stop all trading with no real discrepancy. Reproduced: the old code failed 3 of 3 runs of the new race test.
- **Change:** one SQL statement computes drift (single snapshot).
- **Files:** `services/ledger/reconcile.service.ts`.
- **Tests:** new `ledger.reconcile.test.ts` (40 concurrent postings with 12 concurrent reconciliations; no drift reported).
- **Regression risk:** low. **UI impact:** none. **External dependency:** none.

### CL-20 Customers were shown fabricated bank accounts
- **Problem:** the server seeded seven "Tazdan" deposit bank accounts on every boot and the mobile deposit flow showed them as where to wire money. They are textbook example IBANs and invented account numbers (one pairs a real US routing number with a made-up account). The app also hardcoded the same list as a fallback, and the Receive screen showed a fake personal IBAN with "Copy IBAN".
- **Root cause:** illustrative seed data and UI placeholders never replaced by real accounts.
- **Existing behaviour:** a customer following the instructions could send real money to an account Tazdan does not hold.
- **Change:** seeding removed; mobile fallback removed (a currency without an admin-configured account says bank deposits are not available); Receive → Bank now explains bank deposits and opens Top up. Migration `20261007100000_disable_placeholder_platform_banks` deactivates exactly the seeded rows (matched on bank, holder and full fabricated identifier; nothing deleted; admin-entered or edited accounts untouched).
- **Files:** `server/src/utils/seed.ts`, migration above, mobile `src/components/exchange/DepositWidget.tsx`, `app/receive.tsx`.
- **Tests:** migration applied to the test database (7 rows deactivated); mobile type-check.
- **Regression risk:** low — bank deposits show "not available" until an administrator enters real accounts.
- **UI impact:** the Receive bank tab and the deposit screen for unconfigured currencies.
- **External dependency:** real bank accounts must be entered in the admin before bank deposits are offered. **Action:** after the next production deploy, confirm no placeholder row is active.

### CL-41 The Convert screen reported conversions that never happened
- **Problem:** Home → More → Swap opened a screen whose exchange rate came from `Math.random()` ("dummy rate for demo") and whose button showed "Converted" without calling the server.
- **Existing behaviour:** a customer was told money had been converted; balances did not change.
- **Change:** the screen shows a live indicative quote from a new read-only endpoint (`GET /api/wallets/swap/quote`, priced exactly like the swap) and performs the real swap. The swap accepts `minCredited` and refuses to fill more than 0.5% below the amount shown (409, quote refreshed).
- **Files:** mobile `app/transfer.tsx`, `src/services/index.ts`; server `controllers/wallet.controller.ts`, `routes/wallet.ts`.
- **Tests:** none for the swap path yet (gap); server and mobile type-checks.
- **Regression risk:** low. **UI impact:** same layout; the rate and amount are now real and the button can fail with a reason. **External dependency:** live price feeds (the swap refuses static fallback prices).

### CL-42 Refunded transfers revealed compliance rejections
- **Problem:** a transfer rejected by the risk engine stored `failureReason = "Compliance rejection"`; the customer API masked it only while the state was `REJECTED`, so after the automatic refund the customer could read it. The receipt also returned raw internal states such as `MANUAL_REVIEW`.
- **Change:** the customer API returns fixed wording per state and a neutral `status` label; internal reasons never reach the customer.
- **Files:** `server/src/controllers/remittance.controller.ts`.
- **Tests:** `remittance.api.test.ts` (refund wording, no risk or provider fields in responses).

### CL-44 Five staff routes checked only "is an administrator"
- **Problem:** `PUT /api/deposits/:id/confirm` (credits a wallet), `POST /api/claim-links/sweep` and three WhatsApp routes required an ADMIN account but no specific permission, bypassing least-privilege roles — a support agent could confirm deposits through the legacy route.
- **Change:** `deposits.confirm`, `controls.operate`, `support.reply` / `support.read` respectively. The static route inventory now reports 0 admin-only routes (163 permission-gated).
- **Files:** `server/src/routes/deposit.ts`, `routes/claimLink.ts`, `routes/whatsapp.ts`.
- **Tests:** route inventory; full suite passes.

### CL-46 Withdrawals bypassed the risk engine, and kill switches did not stop on-chain withdrawals
- **Problem:** the risk rules were defined for withdrawals but no withdrawal path called the engine; destination wallet addresses were never screened; and the instant on-chain path (`POST /api/withdrawal/initiate`) did not check the `withdrawals` or `blockchain` kill switches.
- **Existing behaviour:** in an emergency, switching withdrawals off would not have stopped on-chain withdrawals; a payout to a watchlisted address would have gone out.
- **Change:** both kill switches are enforced on the on-chain path. A shared assessment (`services/risk/withdrawalRisk.ts`) screens the customer and the destination address and runs the risk engine (subject `WITHDRAWAL`). Blocking outcomes are refused with neutral wording and open a case. On the instant on-chain path, a review outcome is refused (it can still be submitted through the staff-approved withdrawal flow); on the staff-approved path the withdrawal enters the queue with a risk note shown to the approver in the cockpit, and a case is opened.
- **Files:** `server/src/services/risk/withdrawalRisk.ts`, `controllers/cryptoWithdrawal.controller.ts`, `controllers/withdrawal.controller.ts`; `client/src/app/admin/queues/withdrawals/page.tsx`.
- **Tests:** `integration.wallet.test.ts` — “screens the destination address: a watchlisted wallet is flagged for the approver and opens a case”. The on-chain path's refusal has no dedicated test yet (gap: requires 2FA and address allow-list setup).
- **Regression risk:** medium — every withdrawal now runs screening and the risk engine (a few extra queries); customers on new devices or with velocity signals see refusals on the instant path.
- **External dependency:** watchlist data (screening reports no coverage until lists are loaded).

### CL-21 Compliance queue ordered alphabetically by priority
- **Problem:** `orderBy priority desc` sorted the strings (`MEDIUM` before `CRITICAL`).
- **Change:** ordered by SLA due time (derived from priority), then age. **Files:** `controllers/cockpit/risk.controller.ts`.

### CL-22 Review cases stayed open after the decision
- **Change:** approving or rejecting a remittance in review closes its case with the decision as the resolution; a business batch the business itself rejects or cancels closes its review case when no line was blocked (otherwise a note is added and compliance decides).
- **Files:** `services/remittance/remittance.service.ts`, `services/business/payouts.service.ts`.
- **Tests:** `remittance.golden.test.ts`, `business.payouts.test.ts`.

### CL-23 Integrity reconciliation re-opened the same break every run
- **Change:** a break with an open exception is not duplicated; an OPEN exception whose break is gone is closed with an explanatory note (escalated ones stay with their owner).
- **Files:** `services/reconciliation/recon.service.ts`. **Tests:** `remittance.golden.test.ts` (opens one exception and clears it after repair).

### CL-24 Support escalations could be resolved twice
- **Problem:** resolving twice posted the system message twice; assign/resolve were unaudited.
- **Change:** conditional updates and audit records. **Files:** `admin.controller.ts`.

### CL-25 Approvals API advertised an unhandled type
- **Change:** `CUSTOMER_UNFREEZE` removed from the request enum and type (no handler was registered, so it was always refused). **Files:** `controllers/cockpit/operations.controller.ts`, `services/platform/approvals.service.ts`.

---

## P1 — operating platform

### CL-26 Staff RBAC and permission gating
- **Change:** 12 staff roles, 49 permissions (`services/platform/rbac.ts`); every `/api/admin` and `/api/cockpit` route declares its permission; an ADMIN without roles is treated as SUPER_ADMIN for compatibility with the mobile admin (shown as a banner in the cockpit).
- **Tests:** `cockpit.test.ts` (role without permission gets 403). **UI:** none on mobile.

### CL-27 Emergency controls (kill switches)
- **Change:** `ControlSwitch` per feature (9: withdrawals, deposits, p2p, fx, remittance, blockchain, cards, transfers, business_payouts) and per currency, corridor, provider or user, with reason, optional expiry and an append-only event log; `assertMovementAllowed` in every money path.
- **Tests:** `cockpit.test.ts`.

### CL-28 Database-level controls
- **Change (migration `20261006120000_operating_platform`):** append-only triggers on ledger entries, audit log, state transitions, security events, treasury movements and other evidence tables (DELETE only inside a transaction that sets `tazdan.allow_purge`); a deferred constraint trigger rejects unbalanced ledger groups at commit; remittance quotes are immutable; non-negative wallet checks added `NOT VALID` (enforced for new writes without failing on historical rows); positive-amount checks.
- **Regression risk:** **high for untested legacy paths** — any code that updates or deletes an evidence row, or posts an unbalanced group, now fails at the database. All 147 tests pass with the triggers in place; rehearse on a restored copy of production before deploying (see [DEPLOYMENT.md](../DEPLOYMENT.md)).

### CL-29 Remittance engine
- **Change:** corridors (12 Libya corridors, all `SANDBOX_ONLY`), beneficiaries (IBAN mod-97 and UK sort-code validation), immutable quotes, a 23-state lifecycle with an edge whitelist, compliance screening and risk decisioning, routing, treasury reservation, payout, provider callbacks (HMAC-verified), polling, refunds, goodwill refunds via maker-checker, reconciliation. See [REMITTANCE.md](../REMITTANCE.md).
- **Tests:** `remittance.golden.test.ts` (Tripoli→London £1,000 end to end; London→Tripoli into a wallet; failed payout refunded in full including fee; idempotency and single-use quotes under concurrency; ledger balanced; integrity exceptions).
- **External dependency:** licensed payout partners per corridor (sandbox rails only today).

### CL-43 Customers could not send a remittance from the app
- **Problem:** the remittance engine had no customer screens.
- **Change:** a "Send abroad" flow in the mobile app (Home → More): corridor → recipient (saved or new, with the server's bank-detail rules) → amount with a live locked quote, fee, rate, total and arrival estimate → purpose and optional source of funds → review → confirm with biometrics and, when the server asks, a 6-digit code. Transfers list and detail use neutral status wording ("Processing", "Delivered", "Refunded"…) and allow cancellation where the server permits. Sandbox corridors are labelled as test mode. English and Arabic strings (78 each).
- **Files:** mobile `app/remit/index.tsx`, `app/remit/new.tsx`, `app/remit/[id].tsx`, `src/services/remittance.ts`, `src/store/i18nStore.ts`, `app/(tabs)/index.tsx` (menu entry).
- **Tests:** `remittance.api.test.ts` — the exact HTTP sequence the screens use, idempotent retry, step-up on an unknown device, cancellation refunded in full; mobile type-check. The screens have not yet been exercised on a device build.
- **Regression risk:** low (new screens; one menu item added). **UI impact:** new screens using existing components. **External dependency:** live corridors need licensed payout partners; in production no corridor is available until one is `LIVE`, and the flow says so.

### CL-30 Treasury
- **Change:** pools per provider and currency, append-only movements (PREFUND, WITHDRAW, ADJUST_IN/OUT, RESERVE, RELEASE, CONSUME) with matching ledger journals, reservation under row lock, alerts (low liquidity, below target, high exposure, rapid depletion, concentration, overdue settlement). Pools start empty.
- **Tests:** `remittance.golden.test.ts`.

### CL-31 Reconciliation
- **Change:** provider-statement matching (missing internal/external, duplicate, amount, currency, fee, status, late settlement) and integrity checks (ledger cache, conservation, wallet read model, negative wallets, treasury pools, remittance clearing) on a schedule and on demand; resolution workflow.
- **Tests:** `remittance.golden.test.ts`, `ledger.reconcile.test.ts`.

### CL-32 Risk engine, screening and case management
- **Change:** 17 configurable rules (AML 7, fraud 7, sanctions 2, geography 1) with versioned edits; Jaro-Winkler watchlist screening against imported official lists (no list data is bundled — screening reports "no coverage" until one is loaded); compliance cases with SLA, transitions and case file.
- **Tests:** `remittance.golden.test.ts`, `business.payouts.test.ts` (screening hit holds a batch).

### CL-33 Control Cockpit (web)
- **Change:** 32 admin routes on the website under `/admin` (see [CONTROL_COCKPIT.md](../CONTROL_COCKPIT.md)), served by `/api/cockpit` (70 endpoints). Search, customer 360, transactions, ledger, queues, approvals, controls, remittance, FX, treasury, providers, reconciliation, compliance, fraud (link graph), support, finance, forecasts, businesses, system, security, audit, staff, assistant. English and Arabic interface strings; light and dark themes.
- **Tests:** `cockpit.test.ts`; Next.js production build; screenshots of every page at 1440 px (dark and light) and 390 px.
- **UI impact:** new surface; the public website is unchanged except `robots.txt` disallowing `/admin`.

### CL-34 Business platform
- **Problem:** the mobile business portal's endpoints did not exist.
- **Change:** `/api/business` (26 endpoints: profile, KYB submission, stats, API keys, team with invitations, bulk-pay preview and submit, payouts, batches with maker-checker, webhooks) and a public API `/api/v1` (9 endpoints, API-key authentication, per-key rate limit, mandatory `Idempotency-Key` on writes). Batches reserve funds up front, screen recipients, run the risk engine, require a second approver at or above the threshold (or a step-up for single-signatory businesses), hold for compliance on review outcomes, and post balanced journals per line. Webhooks are HMAC-signed, retried with backoff and SSRF-guarded. API keys are scoped, hashed, expire, and act with their creator's current role. Migration `20261007090000_business_payouts`.
- **Tests:** `business.payouts.test.ts` (8 tests).
- **UI impact:** mobile bulk-pay done screen states approval/review/paid; idempotency key on submit.
- **External dependency:** none for wallet-to-wallet payouts.

### CL-45 Business approvals, invitations and KYB submission in the app
- **Problem:** maker-checker for business batches had no approval screen (a second approver could only call the API), invitees could not accept invitations, owners could not submit KYB, and the KYB banner said payouts were "limited" when the server refuses them until approval.
- **Change:** a "Waiting for approval" section on the business payouts screen (approve/reject with confirmation); the business home shows invitations with Accept for people not on a team, a "Submit for verification" action for owners, the reviewer's note when KYB was rejected, and corrected wording.
- **Files:** mobile `app/business/invoices.tsx`, `app/business/index.tsx`, `src/services/business.ts`, `src/types/business.ts`.
- **Tests:** server behaviour covered by `business.payouts.test.ts`; mobile type-check; not yet run on a device.
- **UI impact:** additions to existing screens using their existing styles.

### CL-35 Observability
- **Change:** in-process request metrics (p50/p95/p99, error rates) with periodic `SystemMetricSample` snapshots; provider call log with latency and errors; system page in the cockpit.

---

## P2 — assistance and analytics

### CL-36 Forecasting
- **Change:** Holt linear smoothing with ~80% intervals for volume, revenue, sign-ups, remittances, support tickets and risk signals; treasury days-of-cover. Forecasts are hidden until a series has at least 7 active days.
- **Files:** `services/analytics/forecast.ts`, `controllers/cockpit/analytics.controller.ts`, `client/src/app/admin/forecasts`.

### CL-37 AI control layer
- **Change:** an operations assistant and two drafting functions (compliance case summary, support reply) using the Anthropic API (`claude-opus-5`, server-side refusal fallback). Read-only tools limited to the operator's permissions; drafts take effect only when a person with the right permission accepts them; every request, tool call and decision is logged (`AiInteraction`). Off by default in production (`AI_LEVEL`). See [AI_AUTOMATION.md](../AI_AUTOMATION.md).
- **Tests:** `ai.assistant.test.ts` (tool scoping, audit trail, acceptance rules, OFF switch; client mocked).
- **External dependency:** Anthropic API key and a data-processing agreement before enabling in production.

---

## Engineering and delivery

### CL-38 Tests that could not run
- **Change:** Jest transforms the ESM build of `ed25519-hd-key` and `@noble/*`; the two integration suites that failed to load now run.
- **Files:** `server/jest.config.ts`.

### CL-39 Deploy did not wait for CI
- **Change:** `deploy.yml` runs on `workflow_run` after CI succeeds on `master` and builds the exact commit CI tested. CI gained a migration-drift check against a shadow database, a route-inventory gate and a committed-secret scan, and runs on `hardening/**` branches.
- **Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.

### CL-40 Development API target
- **Change:** the website's development build calls `http://localhost:5001/api` instead of production (user request).
- **Files:** `client/next.config.js`, `client/src/lib/api.ts`, `client/src/lib/cockpit/api.ts`.

---

## Launch-readiness pass — 2026-10-08

All suites pass on 2026-10-08: 171 tests in 24 suites (three consecutive runs).

### CL-47 Fund-integrity audit compared the wrong things
- **Problem:** the audit compared Σ wallet balances with deposits − withdrawals + admin credits, per currency. Swaps and trades (Tazdan as counterparty), fees credited to the platform as USDT whatever their currency, P2P escrow, referrals and remittances all move value it could not see, so it reported discrepancies that were artefacts of the formula — including, almost certainly, part of the long-standing "~2,444 USDT" production warning. Its "Reconcile" button let one admin book an admin credit (SYSTEM_ONRAMP → PLATFORM) to make the warning go away.
- **Change:** the audit is rebuilt on the ledger: customer wallets + Tazdan-held ledger accounts vs net value through boundary accounts, per journal type, classified EVIDENCED / TRADE / UNBACKED. Every boundary posting is matched to its record (deposit or on-ramp, withdrawal, on-chain transaction, order, treasury movement, payout, adjustment); mismatches become reconciliation exceptions in the cockpit. Unbacked history (backfilled opening balances, simulator seeds, onboarding credits, earlier "reconciliations") is acknowledged once with a note — no money moves — and any unbacked value afterwards is a breach (halts trading when `FUND_AUDIT_HALT=1`). `scripts/diagnose-fund-integrity.ts` prints the breakdown and an exact bridge from the old number.
- **Files:** `server/src/services/ledger/fundIntegrity.service.ts`, `services/reconciliation/recon.service.ts`, `controllers/admin.controller.ts`, `controllers/cockpit/money.controller.ts`, `routes/cockpit.ts`, `scripts/diagnose-fund-integrity.ts`; `client/src/app/admin/reconciliation/page.tsx`; mobile admin screens point to the cockpit.
- **Tests:** `fundIntegrity.flows.test.ts` (own schema): deposits, transfer with a USD fee, swap, claim link, chat payment, P2P trade with fee, withdrawal, manual and onboarding credits leave every currency balanced with nothing unbacked; unbacked value, a posting without a record and wallet drift are each caught; the halt fires.
- **Production action:** run the diagnosis script, explain the residue, acknowledge each currency in Cockpit → Reconciliation → Fund integrity, then set `FUND_AUDIT_HALT=1`.

### CL-48 Onboarding credits bypassed dual control
- **Problem:** creating a customer with `initialBalances` credited any amount as outside money (SYSTEM_ONRAMP) with one person's say-so; manual credits above 100 USD already needed a second approver.
- **Change:** opening balances use the manual-credit path: a controlled adjustment up to the single-control limit, otherwise a LEDGER_ADJUSTMENT approval request.
- **Files:** `server/src/controllers/admin.controller.ts`, `mobile/app/admin/users.tsx`.
- **Tests:** `fundIntegrity.flows.test.ts` (small credit posts; 5,000 USD waits for approval).

### CL-49 Reconciliation checks raced concurrent postings
- **Problem:** the remittance-clearing and treasury-pool checks read their two sides in separate statements, so a payout committing in between appeared as a break (also an intermittent test failure).
- **Change:** each check is one SQL statement (one snapshot), as the ledger cache check already was (CL-19).
- **Files:** `server/src/services/reconciliation/recon.service.ts`.

### CL-50 In-app account deletion (App Store 5.1.1(v), Google Play)
- **Problem:** customers could create an account but not delete it — grounds for store rejection.
- **Change:** Profile → Delete account lists what must be settled (balances, reserved funds, pending deposits/withdrawals, open trades, links, transfers, cards, business batches), explains retention, and closes the account after a server-checked code. Closure is serialised against money movements, revokes sessions, API keys and push token, cancels listings and blocks sign-in (`ACCOUNT_CLOSED`). Personal data and KYC documents are anonymised after `ACCOUNT_RETENTION_YEARS` (default 5) by a daily job; ledger and audit records stay. Public instructions page at `/delete-account` (English and Arabic).
- **Files:** `server/prisma/migrations/20261008090000_account_closure`, `services/account/closure.service.ts`, `controllers/user.controller.ts`, `controllers/auth.controller.ts`, `routes/user.ts`; `mobile/app/settings/delete-account.tsx`, `app/(tabs)/profile.tsx`; `client/src/app/delete-account/page.tsx`.
- **Tests:** `account.closure.test.ts`.

### CL-51 Unlimited principal crypto exposure
- **Problem:** with the exchange geo-blocked, every customer crypto order filled against Tazdan with no limit on the open position.
- **Change:** principal fills are refused when they would take Tazdan's unhedged position past a per-asset or total USD limit (defaults 2,000 / 10,000; 0 stops them); reducing orders always pass; serialised per asset. Treasury records hedges (append-only `PrincipalHedge`); positions, limits and hedges are in Cockpit → Treasury.
- **Files:** `server/prisma/migrations/20261008100000_principal_exposure`, `services/exchange/principalExposure.service.ts`, `services/exchange/orderExecution.service.ts`, `controllers/cockpit/money.controller.ts`; `client/src/app/admin/treasury/page.tsx`.
- **Tests:** `principal.exposure.test.ts`.

### CL-52 Official sanctions lists, and a name matcher fit for real data
- **Problem:** no list data, so screening reported no coverage (business payouts all went to review; withdrawals were effectively unscreened). Loading real lists then exposed a matcher that flagged most common Arab names (a list name matched whenever its words appeared in the customer's name) and missed people listed under aliases; every re-screen re-raised matches already cleared.
- **Change:** UN, OFAC SDN (with aliases, addresses and its published digital-currency addresses) and the UK Sanctions List are downloaded daily and refreshed in place (stable ids, delistings deactivated, a much smaller download refused). New scorer: transliteration folding, rarity-weighted token alignment favouring the shorter name, one-word names scored against the whole name, every listed birth year compared (a year that rules the person out clears the match). A false-positive review suppresses that entry for that subject until the entry changes. On the live lists: 13/13 test variants of listed people found; with a birth date, 2 of 20 common names flagged (both exact names of listed people without a conflicting year).
- **Files:** `server/src/services/compliance/sanctionsLists.service.ts`, `services/compliance/screening.service.ts`, `utils/csv.ts`, `services/business/payouts.service.ts`, `controllers/cockpit/risk.controller.ts`, migration `20261008110000_watchlist_updated_at`; `client/src/app/admin/compliance/page.tsx`.
- **Tests:** `sanctions.lists.test.ts`.
- **External dependency:** PEP data and the EU list still need a vendor or registration token.

### CL-53 2FA secret could be replaced from a session; staff had no 2FA setup in the cockpit
- **Problem:** `POST /auth/2fa/enable` overwrote the secret while 2FA was on, so a stolen session could swap in its own authenticator. Production already required staff 2FA, but the cockpit showed a dead end and a cached refusal outlived enabling 2FA.
- **Change:** enabling refuses while 2FA is on; the admin gate tells the cockpit 2FA is required and the cockpit walks staff through setup; enabling or disabling 2FA clears the cached decision.
- **Files:** `server/src/controllers/auth.controller.ts`, `middleware/auth.ts`; `client/src/components/cockpit/TwoFactorSetup.tsx`, `CockpitShell.tsx`.

### CL-54 Deposit bank accounts: dual control, audit, web page
- **Problem:** anyone with `treasury.operate` could change the account customers pay into, unaudited, and delete accounts outright; only the mobile admin could manage them.
- **Change:** new accounts, payment-detail changes and reactivation need a second approver in production (`DEPOSIT_ACCOUNT_CHANGE`); deactivation is immediate; delete deactivates; all audited. Cockpit → Deposit accounts.
- **Files:** `server/src/services/platform/depositAccounts.service.ts`, `controllers/adminExtras.controller.ts`, `services/platform/approvals.service.ts`; `client/src/app/admin/treasury/deposit-accounts/page.tsx`; `mobile/app/admin/platform-banks.tsx`.

### CL-55 Bank top-up never showed where to pay
- **Problem:** choosing bank transfer created a deposit, showed "Deposit submitted ✓" and closed — the customer never saw the account or reference. P2P "top-up" closed without doing anything.
- **Change:** after a bank or agent top-up the page shows the account, amount and reference (tap to copy) with a success animation and sound; a currency with no active account says so before anything is created; P2P opens the marketplace.
- **Files:** `mobile/src/components/topup/TopupSheet.tsx`.

### CL-56 Confirmation sounds were silent everywhere
- **Problem:** the sound hook loaded `expo-av`, which had been removed from the app, so every confirmation fell back to haptics.
- **Change:** sounds play through `expo-audio` (SDK 54); without the native module the hook degrades to haptics. Needs a new native build.
- **Files:** `mobile/src/hooks/useTransactionSound.ts`, `mobile/package.json`, `mobile/app.json`.

### CL-57 Trading halt flag cached forever per process
- **Problem:** each API process cached the halt flag on first read and never re-read it, so a halt set by the scheduler worker (or lifted by a script) did not reach other processes.
- **Change:** re-read from the database every 5 seconds. `scripts/repair-unbalanced-ledger-groups.ts` repairs one-sided ledger groups left by deleted test users (adds SUSPENSE legs; nothing deleted).
- **Files:** `server/src/services/ledger/reconcile.service.ts`, `server/scripts/repair-unbalanced-ledger-groups.ts`.

### CL-58 Home screen polish (user request)
- **Change:** the hero backdrop is quieter and slower; More is a four-across icon grid plus an account list; recent activity is grouped by day with direction badges, neutral outgoing amounts and a text "See all"; assets are flat rows with an inline trend and value + 24h change instead of boxed cards.
- **Files:** `mobile/app/(tabs)/index.tsx`, `mobile/src/components/home/ShimmerBackdrop.tsx`, `mobile/src/store/i18nStore.ts`.
- **Regression risk:** visual only; device check needed.

---

## Customer experience and pricing pass — 2026-10-08 (later)

All suites pass: 181 tests in 28 suites.

### CL-59 Limits stated before confirming, never after a security code
- **Problem:** buy, sell, send, chat payments, claim links and withdrawals issued a security code first and then refused for the limit ("exceed your monthly limit"), with no date. Limits were rolling 24 h / 30 d windows, so no reset date could be given.
- **Change:** limits use calendar periods in `LIMITS_TIMEZONE` (default Africa/Tripoli): daily resets at local midnight, monthly on the 1st. `limitStatus` gives, per action, what is possible now, when each period resets (dd/mm/yyyy) and what the next level allows; `GET /api/users/me/limits` serves it. The limit check now runs before the step-up on all six paths; `LIMIT_EXCEEDED` errors carry the same details ("You can buy again from 01/11/2026, or raise your verification level"). The app shows a notice on Buy, Sell and Send before confirming and disables the slide.
- **Files:** `server/src/utils/kycLimits.ts`, controllers `exchange`, `transfer`, `transaction`, `message`, `claimLink`, `withdrawal`, `user`; `mobile/src/hooks/useLimits.ts`, `src/components/limits/LimitNotice.tsx`, Buy/Sell/Send widgets.
- **Tests:** `limits.test.ts` (Tripoli periods, reset dates, error details, no code issued for an over-limit transfer).
- **Regression risk:** calendar periods allow a month's limit at the end of one month and again at the start of the next (rolling windows did not).

### CL-60 The app valued local-currency amounts in dollars wrongly
- **Problem:** `/rates` returns units per US dollar (LYD ≈ 9.4), but Send, chat payments, remittance and top-up multiplied by it — 100 LYD was treated as ~$940, over-triggering Face ID and (with CL-59) false limit notices.
- **Change:** one helper (`usdValue` / `useUsdValue`) divides for fiat and uses live prices for crypto; unknown prices are never guessed.
- **Files:** `mobile/src/hooks/useForexRates.ts`, `app/messages/[id].tsx`, `app/remit/new.tsx`, `SendWidget.tsx`, `TopupSheet.tsx`.

### CL-61 Asking for a higher verification level removed the customer's limits
- **Problem:** any document upload set `kycStatus = PENDING`, so a verified customer following "raise my limit" dropped to Level 0 (no selling or withdrawing) until review; declining reset them to unverified.
- **Change:** uploads carry a level (IDENTITY / ADDRESS / SOURCE_OF_FUNDS). A verified customer stays verified while an upgrade is reviewed; declining rejects only the new documents. The staff queue lists upgrade requests under PENDING. New verification screen: level card with three-step progress, live limits with reset dates, what the next level unlocks, document-type choice, capture tiles with previews, review timeline and decline reason (English and Arabic).
- **Files:** `server/src/controllers/user.controller.ts`, `controllers/admin.controller.ts`; `mobile/app/kyc.tsx`, `src/store/i18nStore.ts`.
- **Tests:** `kyc.upgrade.test.ts`.

### CL-62 Contacts
- **Change:** `GET /api/contacts` (people you exchanged money with: transfers, chat payments, claimed links) and `GET /api/contacts/:id` (public details — name, @handle, photo, verified, member since — and every payment between you with totals; 404 for non-counterparts; never email or phone). Home shows a contacts row; the contact screen offers Send (pre-filled) and Message.
- **Files:** `server/src/controllers/contacts.controller.ts`, `routes/contacts.ts`; `mobile/app/contact/[id].tsx`, `src/services/contacts.ts`, `app/send.tsx`, `SendWidget.tsx`.
- **Tests:** `contacts.test.ts`.

### CL-63 Home: swipeable balances, clearer privacy, brand balance card
- **Change:** the balance swipes between the total, each currency held (in that currency, with its live rate) and crypto, with page dots; Top up on a currency page pre-selects it. An eye button in the header hides balances; holding a figure peeks. On scroll, a brand-blue card shows your photo, @handle, a large balance and today's move.
- **Files:** `mobile/app/(tabs)/index.tsx`, `src/components/ui/ScreenHeader.tsx`.

### CL-64 Live fiat rates
- **Change:** `GET /api/rates/live` gives each fiat currency's dollar value, 24 h change and hourly points. LYD uses the parallel-market ticks; other currencies use the international rate, with change and points only when the LYD-derived history agrees within 3% (mixed or stale feeds show the rate without a change). Fiat rows show "$1 = 9.37 LD", a live value, the change and a trend line, refreshed every 30 s.
- **Files:** `server/src/routes/rates.ts`; `mobile/src/hooks/useForexRates.ts`, `app/(tabs)/index.tsx`.

### CL-65 Dinar quotes could jump 46% when a feed paused
- **Problem:** in development the USD/LYD rate moved from 6.42 to 9.37 when the primary feed was rate-limited and the fallback took over, while other pairs kept a frozen value. Quotes followed silently.
- **Change:** a jump guard on LYD pairs: a move above `FX_MAX_JUMP_PCT` (8%) from the last accepted rate is held for 15 minutes (previous rate kept, error logged), then quoting pauses (503) until an approved FX override confirms the rate or `FX_JUMP_WINDOW_MS` (2 h) passes.
- **Files:** `server/src/services/exchange/fxRateProvider.service.ts`.
- **Tests:** `fx.jumpGuard.test.ts`.
- **Owner action:** confirm which feed reflects the real market in production and watch for `[fx] … moved` errors.
