# Database

PostgreSQL via Prisma 5. Schema: `server/prisma/schema.prisma` — **96 models, 51 enums**; **53 migrations** in `server/prisma/migrations`. CI applies every migration to an empty database and checks the result matches the schema exactly (drift check against a shadow database).

## Domains (selection)

| Domain | Main models |
|---|---|
| Identity and access | `User` (incl. `staffRoles`), `RefreshToken` (sessions), `KnownDevice`, `StaffRole`, `SecurityEvent`, `APIKey`, `ApiKeyUsage` |
| Balances and ledger | `Wallet`, `UserWallet`, `LedgerAccount`, `LedgerEntry`, `AssetLedgerAccount`, `AssetLedgerEntry`, `Transaction`, `PlatformFee` |
| Payments | `Deposit`, `Withdrawal`, `Transfer`, `ClaimLink`, `Message` (chat payments), `Budget`, `Card`, `CardTransaction` |
| P2P | `P2PListing`, `P2PTrade`, `P2PDispute` |
| Remittance | `RemittanceCorridor`, `RemittanceBeneficiary`, `RemittanceQuote`, `RemittanceTransfer`, `RemittanceRoute`, `RemittancePayout`, `RemittanceSettlement`, `RemittanceRefund` |
| Treasury | `TreasuryPool`, `TreasuryMovement` |
| Risk and compliance | `RiskRule`, `RiskDecision`, `RiskEvent`, `ComplianceCase`, `CaseNote`, `WatchlistEntry`, `ScreeningResult`, `AMLFlag`, `KYCDocument` |
| Reconciliation | `ReconciliationRun`, `ReconciliationItem` |
| Providers | `Provider`, `ProviderCall` |
| Business | `BusinessProfile`, `BusinessTeamMember`, `BusinessPayoutBatch`, `BusinessPayout`, `BusinessWebhookEndpoint`, `BusinessWebhookDelivery` |
| Operations | `ControlSwitch`, `ControlSwitchEvent`, `ApprovalRequest`, `AuditLog`, `StateTransition`, `SystemMetricSample`, `AiInteraction`, `SupportEscalation` |
| Reference | `ExchangeRate`, `FxRateTick`, `PlatformSettings`, `PlatformBankAccount`, `MarketListing` |

## Database-enforced controls

Defined at the end of `20261006120000_operating_platform/migration.sql`:

| Control | Objects |
|---|---|
| Append-only (UPDATE/DELETE rejected) | `LedgerEntry`, `AssetLedgerEntry`, `AuditLog`, `StateTransition`, `ControlSwitchEvent`, `TreasuryMovement`, `RiskDecision`, `CaseNote`, `ProviderCall`, `SecurityEvent` |
| Purge escape hatch | DELETE only inside a transaction that runs `SET LOCAL tazdan.allow_purge = 'on'` (for retention jobs, never application code) |
| Balanced ledger groups | Deferred constraint trigger on `LedgerEntry` insert |
| Immutable price records | `RemittanceQuote` pricing fields cannot change; consumed once; no delete |
| Non-negative wallets | `Wallet.balance >= 0`, `Wallet.frozen >= 0` (`NOT VALID`: binds new writes, historical rows checked separately) |
| Positive amounts | Remittance quote/transfer/payout/refund/settlement, treasury movement, business payout |
| Treasury thresholds | `minimum >= 0`, `target >= minimum` |
| One open payout per transfer | Partial unique index on `RemittancePayout(transferId)` where status is PENDING or SUBMITTED |

## Migration practice

- Write schema changes in `schema.prisma`, generate SQL with `prisma migrate diff`, add hand-written controls at the end of the migration file, apply to the disposable test database, run the full suite.
- The production container runs `prisma migrate deploy` on start. Rehearse every migration on a restored production backup first ([DEPLOYMENT.md](DEPLOYMENT.md)).
- Data migrations must be targeted and reversible (example: `20261007100000_disable_placeholder_platform_banks` deactivates exact rows and deletes nothing).
