# Unfinished pages

## Control Cockpit (web, `client/src/app/admin`)

All 32 routes are built and listed in the navigation only when built (`BUILT` set in `CockpitShell.tsx`). Every page has been rendered against live API data and screenshotted. Pages that are read-only by design: fraud, finance, forecasts, system, security, audit.

## Mobile app (`mobile/app`)

| Screen | State |
|---|---|
| Send abroad (`remit/index`, `remit/new`, `remit/[id]`) | New in this programme; type-checked, not yet run on a device |
| Convert (`transfer.tsx`) | Rewired to real quotes and swaps; not yet run on a device |
| Receive → Bank tab | Fake IBAN removed; now explains bank deposits and opens Top up |
| Deposit (bank) | Shows only administrator-entered accounts; "not available" otherwise |
| Business → home | KYB banner wording corrected (payouts are refused, not "limited", until verification); owners can submit for verification; people who are not on a team see their invitations and can accept |
| Business → payouts | "Waiting for approval" section: a second owner/admin approves or rejects batches (the server refuses the maker) |
| `shader-test` | Development-only route (already restricted at baseline) |

## Website (public)

Unchanged by this programme except `robots.txt` disallowing `/admin`. The owner's own in-progress marketing work (landing page, security page, translations) is left untouched — see [DO_NOT_TOUCH.md](DO_NOT_TOUCH.md).
