# Security

## Authentication

| Item | Implementation |
|---|---|
| Passwords | bcrypt, cost 12 |
| Access tokens | JWT HS256, 15 minutes, carrying the session id (`sid`) |
| Sessions | `RefreshToken` rows (hashed), 7 days, rotated on every refresh; reuse of a rotated token revokes all sessions |
| Revocation | per-session denylist and per-user cutoff in Redis; "sign out other devices" and staff revocation take effect within one request |
| 2FA | TOTP with recovery code; required for on-chain withdrawals |
| Step-up | 6-digit code by email or TOTP for high-value or new-device actions; biometric confirmation accepted only on a trusted device |
| Staff bootstrap | no default passwords; production requires a strong `ADMIN_PASSWORD`; `create-admin` refuses in production unless explicitly allowed |
| Business API keys | `tzk_live_` / `tzk_test_` prefix, 192 bits of randomness, stored as SHA-256, scoped, expiring, revocable; act with the creator's current team role; a live key never works on a non-production server |

## Authorisation

- Customers: ownership checks on every resource (`userId` in every query).
- Staff: 12 roles, 49 permissions (`services/platform/rbac.ts`). All 163 staff routes declare a permission (route inventory: 0 role-only routes). Denials are recorded as `ACCESS_DENIED` security events. Contact details are masked for staff without `customers.pii`.
- Dual control: ledger adjustments above the single-control limit, goodwill refunds and FX overrides require a second staff member (the requester cannot approve). Business batches above the threshold require a second owner/admin.
- Business team roles: OWNER, ADMIN, ANALYST, DEVELOPER; a key can never do more than its creator may do in the app.

## Transport and HTTP

`helmet` security headers; CORS restricted to configured origins; 1 MB body limit; `trust proxy` behind nginx; global rate limit 300/min per IP plus endpoint limits (auth 10 per 15 min, withdrawals 10 per 10 min, webhooks 120/min, API keys 120/min per key, AI 40 per 10 min per staff member); IP strike bans. Rate-limit counters live in Redis and fail open on a Redis outage (account lockout still protects credentials).

## Webhooks and callbacks

- Payout partner callbacks: HMAC over the raw body, verified by the adapter before any state change; idempotent.
- Crypto withdrawal webhook: shared secret compared in constant time.
- WhatsApp webhook: refused in production without Twilio configuration.
- Outbound business webhooks: HMAC-SHA256 signature with timestamp (`Tazdan-Signature: t=…,v1=…`), HTTPS only, no redirects, private and link-local addresses refused in production (re-checked at send time).

## Data protection

- Secrets only in environment variables (production: repository-root `.env` on the droplet); CI scans for committed credentials.
- Raw API keys, refresh tokens and step-up codes are never stored (hashes only); webhook signing secrets are shown once.
- AI tools mask emails, phones and account numbers before anything leaves the platform; AI is off in production by default.
- Evidence tables are append-only at the database level; staff actions are audited with actor, IP, user agent, before/after and reason.

## Custody

The master seed is encrypted at rest with AES-256-GCM. With `MASTER_SEED_KMS_KEY_ID` set, a per-seed data key is wrapped by AWS KMS (database access alone cannot decrypt the seed); without it, a local key from `MASTER_SEED_ENC_KEY` is used — acceptable for development only, and setting the KMS key is a launch blocker — see [runbooks/custody-kms.md](runbooks/custody-kms.md). Hot-wallet limits: [runbooks/hot-wallet-limit.md](runbooks/hot-wallet-limit.md). Simulated on-chain broadcasts are refused in production.

## Supply chain and CI

`npm audit --omit=dev --audit-level=high` blocks server deploys; client dependencies are audited; deploys run only after CI passes on `master` and build the exact tested commit.

## Not yet done

External penetration test ([security/pentest-scope.md](security/pentest-scope.md)), SOC 2 / ISO 27001, mobile crash reporting DSN, DNS-rebinding-proof webhook connections.
