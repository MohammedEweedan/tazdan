# Business platform

Business accounts pay other Tazdan customers in bulk, from the app or through an API. Code: `server/src/services/business/`; routes `/api/business` (26 endpoints, signed-in team members) and `/api/v1` (9 endpoints, API keys); mobile screens `mobile/app/business` (home, bulk pay, payouts with approvals, team, API keys).

## Accounts and roles

A business is a `BusinessProfile` owned by one user; its money is the owner's wallets. Team members join by invitation (they accept in the app) with a role:

| Action | OWNER | ADMIN | DEVELOPER | ANALYST |
|---|---|---|---|---|
| View dashboard, payouts, keys, webhooks | ✓ | ✓ | ✓ | ✓ |
| Edit profile | ✓ | ✓ | | |
| Change approval threshold, submit KYB | ✓ | | | |
| Manage team (only the owner grants or removes admin) | ✓ | ✓ | | |
| Create batches, cancel payouts, approve/reject batches | ✓ | ✓ | | |
| Manage API keys and webhooks | ✓ | ✓ | ✓ | |

## Verification (KYB)

Payouts are refused until KYB is approved. The owner submits for review; a KYB case opens for compliance, who approve or reject in the cockpit (the owner is notified, with the reason on rejection).

## Bulk payouts

1. **Preview** — rows validated (handle or email resolves to an active customer; not the business itself; amount, decimals and the per-payout limit `BUSINESS_PAYOUT_MAX_USD`); fees computed; available balance and whether approval is needed shown.
2. **Submit** — optional `Idempotency-Key`; KYB and kill switch (`business_payouts`) checked; business and each recipient screened; risk engine per line. Funds for every payable line are **reserved at once**.
3. **Approval** — at or above the threshold (business setting, default `BUSINESS_APPROVAL_THRESHOLD_USD` 10,000 USD) a second OWNER/ADMIN must approve in the app (the maker cannot); a single-signatory business confirms with a step-up code instead; API-created batches always wait for a person.
4. **Compliance** — a line the risk engine flags holds the batch for compliance, who release or reject it in the cockpit; blocked lines fail with neutral wording.
5. **Execution** — each line in its own transaction: claim, settle its slice of the reservation, credit the recipient, post a balanced journal (business −(amount+fee), recipient +amount, PLATFORM +fee), notify. A failed line is rolled back and its reservation released. Batch ends `EXECUTED`, `PARTIAL` or `FAILED`.

## Public API (`/api/v1`)

Authentication: `Authorization: Bearer tzk_…` or `X-Api-Key`. Scopes: `PAYOUTS`, `BALANCES`, `RATES`, `WEBHOOKS`, `READ_ONLY` (any GET). Per-key rate limit. Writes require an `Idempotency-Key` (8+ characters); a retry returns the original result with 200.

| Method and path | Scope |
|---|---|
| `GET /v1/balances` | BALANCES |
| `GET /v1/rates?base=&quote=` | RATES |
| `POST /v1/payouts` (one recipient or `recipients[]`) | PAYOUTS |
| `GET /v1/payouts`, `GET /v1/payouts/:id` | PAYOUTS |
| `GET /v1/batches/:id` | PAYOUTS |
| `GET/POST/DELETE /v1/webhooks` | WEBHOOKS |

Internal risk fields never appear in responses.

## Webhooks

Events: `payout.completed`, `payout.failed`, `payout.cancelled`, `batch.pending_approval`, `batch.compliance_review`, `batch.completed`, `batch.rejected`. Each delivery is a row claimed with a conditional update, sent with `Tazdan-Signature: t=<unix>,v1=<HMAC-SHA256(secret, "t.body")>`, `Tazdan-Event` and `Tazdan-Delivery` headers, retried with exponential backoff (up to 8 attempts, then `DEAD`). Receivers should reject timestamps older than five minutes. Endpoints must be HTTPS; private addresses are refused in production.

## Tests

`business.payouts.test.ts`: KYB gate; preview validation; reservation and balanced journals; idempotent retry; maker-checker; compliance hold and release; cancellation and rejection release funds; step-up for single signatories; API keys bound to roles; `/api/v1` idempotency; signed webhook delivery; HTTP API shape.
