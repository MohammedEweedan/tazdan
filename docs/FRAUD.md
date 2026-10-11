# Fraud

Fraud controls share the risk engine with AML ([COMPLIANCE.md](COMPLIANCE.md)); seven of its 17 rules are fraud rules. This document covers the signals, the account-takeover defences and the investigation tools.

## Account-takeover defences

| Control | Where |
|---|---|
| Refresh-token rotation with reuse detection (a replayed rotated token revokes every session) | `middleware/auth.ts` |
| Instant session revocation (Redis denylist + per-user cutoff) | Security → Sessions; cockpit customer page |
| Device trust: new devices must pass step-up; trusted devices listed and removable | `services/security/stepUp.service.ts` |
| Risk-based step-up on transfers, chat payments, claim links, remittances (new device or ≥ STEP_UP_USD, default 1,000 USD) | controllers |
| Mandatory TOTP 2FA, verified email and a 24-hour address allow-list for on-chain withdrawals | `cryptoWithdrawal.controller.ts` |
| Security-change signal: password reset/change and 2FA disable/recovery recorded as `SECURITY_CHANGE`; outbound money within 48 h goes to review | auth flows + `RECENT_SECURITY_CHANGE` |
| Brute-force limits on login, reset, verification and 2FA endpoints (10 per 15 min per IP) and IP strike bans (5 strikes per hour) | `rateLimiters.ts`, `ipBan.ts` |
| Claim-link PIN attempts capped (5 per 24 h) with constant-time comparison | `claimLink.controller.ts` |

## Fraud rules

`NEW_BENEFICIARY_HIGH_VALUE`, `BENEFICIARY_FANOUT_7D`, `BENEFICIARY_SHARED` (mule accounts), `NEW_DEVICE_HIGH_VALUE` (challenge), `SHARED_DEVICE`, `RECENT_SECURITY_CHANGE`, `YOUNG_ACCOUNT_HIGH_VALUE`. Thresholds and actions are edited in Compliance → Rules (versioned and audited).

## Investigation (cockpit → Fraud)

- Signal counts by type and the latest fraud and security signals, linked to the customer.
- **Linked-account graph**: customers joined by a shared device fingerprint (solid line) or a shared payout account (dashed). Hover isolates a cluster; clicking opens the customer.
- Pending withdrawals from customers with a recent risk score ≥ 40.
- Failed sign-ins by customer.
- Customer 360 shows sessions, devices, risk decisions, cases and security events; staff can freeze the account (status + user kill switch, reservations untouched) and revoke sessions.

## Limits

Internal transfers, chat payments and P2P are protected by step-up, limits and concurrency guards but are not yet scored by the risk engine. There is no device-intelligence vendor or behavioural biometrics; device fingerprints are derived from user agent and device id headers.
