# Administration

Staff work happens in two places that share the same API and permissions:

- **Control Cockpit** (web, `/admin`) — the full operating console. See [CONTROL_COCKPIT.md](CONTROL_COCKPIT.md).
- **Mobile admin screens** (`mobile/app/admin`, 25 screens) — the original on-the-go console: users, deposits, withdrawals, KYC, P2P (with buyer/seller dispute outcomes), platform banks, settings, rates, messages, WhatsApp, waitlist and more.

## Permissions

All 88 `/api/admin` routes and 70 `/api/cockpit` routes require a specific staff permission (`P('…')`), plus 5 staff routes outside those routers (deposit confirmation, claim-link sweep, WhatsApp). Assign roles in Cockpit → Staff & roles. See [SECURITY.md](SECURITY.md).

## Creating staff accounts

```bash
cd server
ADMIN_EMAIL=ops@example.com STAFF_ROLES=OPERATIONS,SUPPORT npx ts-node scripts/create-admin.ts
# prompts for, or generates and prints once, a 12+ character password
```

`create-admin` refuses to run against production unless `ALLOW_PRODUCTION_ADMIN_CREATE=1`. The server bootstraps an administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD` only if none exists; production requires a strong password and there are no defaults.

## Platform settings worth knowing

| Key | Effect |
|---|---|
| `transfer_fee_<ccy>` | Flat fee for internal transfers |
| `business_payout_fee_<ccy>` | Flat fee per business payout (falls back to the transfer fee) |
| `withdrawal_fee_usd` / `withdrawal_fee_usdt` | Withdrawal fees |
| `ledger_trading_halt` | Set by reconciliation on a ledger break; cleared by an administrator after investigation |

Environment-level limits: `MANUAL_ADJUSTMENT_SINGLE_USD` (default 100), `STEP_UP_USD` (1,000), `BUSINESS_APPROVAL_THRESHOLD_USD` (10,000), `BUSINESS_PAYOUT_MAX_USD` (25,000), `API_KEY_RATE_PER_MIN` (120), `AI_LEVEL`, `AI_MODEL`.

## Platform bank accounts

Deposit instructions shown to customers come only from accounts an administrator enters (Platform banks). Never enter an account without the bank's written confirmation of its details. Nothing is seeded (CL-20).
