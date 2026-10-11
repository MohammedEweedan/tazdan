# API

Base URL `https://api.promrkts.com/api` (development `http://localhost:5001/api`). JSON over HTTPS. **405 endpoints** (static inventory, 2026-10-07); the complete list with auth class per route is generated in [API_ROUTES.md](API_ROUTES.md).

## Surfaces

| Prefix | Endpoints | Auth | Consumers |
|---|---|---|---|
| `/api/admin` | 88 | staff + permission | Mobile admin, cockpit |
| `/api/cockpit` | 70 | staff + permission | Control Cockpit |
| `/api/business` | 26 | customer (business team member) | Mobile business screens |
| `/api/auth` | 17 | public / customer | Apps |
| `/api/cards`, `/users`, `/p2p`, `/messages`, `/exchange`, `/deposits`, `/notifications`, `/security`, `/budgets`, `/wallets`, … | 184 | mostly customer (some public: health, features, rates, waitlist, provider webhooks) | Mobile app, website |
| `/api/remittance` | 11 | customer (+1 signed provider callback) | Mobile app, payout partners |
| `/api/v1` | 9 | API key | Business systems |

Auth classes across all routes: 196 customer, 163 staff-permission, 44 public (12 signed provider callbacks/webhooks; 9 `/api/v1` routes that authenticate with API keys inside the router), 2 optional.

## Authentication

- Customers and staff: `Authorization: Bearer <access token>` (15 minutes). Refresh via `/api/auth/refresh` with the refresh token (rotated each time).
- Business systems: `Authorization: Bearer tzk_…` or `X-Api-Key: tzk_…`.
- Step-up: when a request returns `401` with `code: "STEP_UP_REQUIRED"` and `requiresStepUp: true`, the client collects a 6-digit code and repeats the request with `stepUpCode` (body for transfers and remittances; message metadata for chat payments).

## Errors

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE", "details": { } }
```

| Code | Typical status | Meaning |
|---|---|---|
| `VALIDATION` | 400 | Bad input (zod `issues` included) |
| `AUTHENTICATION` | 401 | Missing or invalid credentials |
| `STEP_UP_REQUIRED` | 401 | A security code is needed |
| `AUTHORIZATION` | 403 | Not allowed |
| `COMPLIANCE_HOLD` | 403 | Refused by a compliance control (neutral wording) |
| `NOT_FOUND` | 404 | |
| `TRANSACTION_CONFLICT` | 409 | State changed concurrently, or price moved |
| `DUPLICATE_REQUEST` | 409 | Single-use resource already consumed (e.g. a quote) |
| `LIMIT_EXCEEDED` | 400 | Amount or count limit |
| `INSUFFICIENT_FUNDS` | 400 | |
| `RATE_LIMITED` | 429 | |
| `ACCOUNT_CLOSED` | 403 | Sign-in or refresh for an account the customer closed |
| `CLOSURE_BLOCKED` | 409 | Account cannot close yet; `details.blockers` lists what to settle |
| `FEATURE_DISABLED` | 503 | Kill switch, trading halt, feature off |
| `PROVIDER_UNAVAILABLE` / `PROVIDER_REJECTED` / `PROVIDER_NOT_ACTIVATED` | 502/503 | External dependency issue or sandbox in production |

## Idempotency

`POST /api/remittance/transfers` takes `idempotencyKey` in the body; `POST /api/business/bulk-pay` accepts and `POST /api/v1/payouts` requires an `Idempotency-Key` header. A repeated request returns the original result (`duplicate: true` / `replayed: true` / HTTP 200). See [TRANSACTIONS.md](TRANSACTIONS.md).

## Key flows

- Remittance: `GET /remittance/corridors` → `POST /remittance/beneficiaries` → `POST /remittance/quotes` → `POST /remittance/transfers` → `GET /remittance/transfers/:id` (`status` is customer-safe wording) → `POST /remittance/transfers/:id/cancel`. Tested end to end by `remittance.api.test.ts`.
- Swap: `GET /wallets/swap/quote?from&to&amount` → `POST /wallets/swap { from, to, amount, minCredited }`.
- Business: see [BUSINESS.md](BUSINESS.md) for `/business` and `/v1`.
- Provider callbacks: `POST /remittance/webhooks/:providerCode` with an HMAC signature over the raw body.

## Versioning

The customer API is unversioned and consumed by the mobile app; changes must stay backward compatible with released app versions (additive fields only). The public business API is versioned under `/v1`.
