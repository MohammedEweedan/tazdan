# Technical debt

Ranked by risk to money or to operations. "Gap" items are things that work but are not protected by an automated test.

## High

| Item | Risk | Suggested action |
|---|---|---|
| New database triggers (append-only evidence, balanced ledger groups) have only been exercised by the test suite | An untested legacy path that updates or deletes an evidence row, or posts an unbalanced group, will start failing in production | Restore a recent production backup into staging, run `prisma migrate deploy`, replay a day of typical traffic or run the full suite against it, then deploy ([docs/DEPLOYMENT.md](../DEPLOYMENT.md)) |
| Crypto buy/sell fills against the platform when Binance is unreachable (it is geo-blocked from the production host) | Unhedged market exposure | Reachable venue or proxy; exposure limits; daily position report |
| Mobile changes are type-checked but not run on a device | Layout or flow bugs in Send abroad, Convert, step-up prompts, deposit, business approvals | Device build and a manual test pass before release |
| Persistent fund-integrity discrepancy reported by the production `[fund-integrity]` audit (≈2,444 USDT, recorded 2026-06) | Unexplained balance | Not re-verified in this programme (no production access); investigate before launch |

## Medium — test gaps on money paths

| Path | Currently verified by |
|---|---|
| `/api/transfers/send` | type-check and review |
| Risk-based step-up decision (`enforceRiskBasedStepUp`) | indirectly by `remittance.api.test.ts` (unknown device) |
| Claim-link PIN attempt cap | review |
| P2P dispute outcome (release vs refund) | review; escrow module covered by concurrency test |
| Referral claim lock | review |
| Swap and swap quote (`minCredited`) | review |
| FX override approval and expiry | review; maker-checker mechanics covered |
| Production refusal of mock/sandbox adapters (`assertAdapterUsable`) | review |
| Admin "freeze transaction" conditional transitions | review |
| Business team invitations (invite, accept, role changes) | review |

## Medium — design

| Item | Notes |
|---|---|
| Fee revenue mirrored to the platform user's wallet as well as the ledger | Two sources of truth for revenue; retire the wallet mirror |
| Display-only FX table in `wallet.controller` (`getAll`) | Used only to show approximate totals; replace with the FX service |
| Legacy wallet balances not fully backfilled into the ledger | Some postings use `allowNegativeUser` like the existing transfer path; run the backfill and then remove the allowance |
| Integrity reconciliation reads pools, ledger and transfers in separate queries | Can raise a transient exception under load (auto-cleared next run); move to a single snapshot transaction |
| Webhook SSRF guard resolves DNS before connecting | A DNS-rebinding window remains; pin the resolved address per request |
| In-process metrics and rate-limit memory store when Redis is absent | Per-process numbers in a clustered deployment |

## Low

| Item | Notes |
|---|---|
| `services/binance/index.ts` market-data mock is unused | Delete |
| Debug `console.log` in `adminExtras` upload handler and `fxRateProvider` | Replace with the logger |
| `services/onramp` MoonPay stub | Remove or implement |
| Card tier showcase uses sample card numbers | Marketing visual only |
| Liquidity-pool / group controllers unmounted | Delete or mount after a product decision |
| Static route inventory counts `/api/v1` API-key routes as "public" | Teach the script about `requireApiKey` |
