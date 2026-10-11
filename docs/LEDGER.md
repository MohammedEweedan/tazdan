# Ledger

Tazdan keeps a double-entry ledger in PostgreSQL. Every money movement is a **journal**: a group of legs (`LedgerEntry` rows sharing a `groupId`) whose signed amounts sum to zero per currency. Account balances (`LedgerAccount.balance`) are a cache of their entries; wallet balances (`Wallet.balance`, `Wallet.frozen`) are the customer-facing read model updated in the same transaction.

## Accounts

| Type | Meaning | Fund class |
|---|---|---|
| `USER` | A customer's spendable balance in one currency | CUSTOMER |
| `SYSTEM_ESCROW` | P2P (and liquidity-pool) funds held in escrow | CUSTOMER |
| `REMITTANCE_CLEARING` | Customer funds collected for a remittance, not yet paid out | CUSTOMER |
| `SYSTEM_ONRAMP` | External rail deposits enter from | SETTLEMENT |
| `SYSTEM_OFFRAMP` | External rail withdrawals and payouts exit to | SETTLEMENT |
| `SYSTEM_CHAIN` | On-chain custody | SETTLEMENT |
| `SYSTEM_FX` | FX conversion counterparty | SETTLEMENT |
| `PARTNER_SETTLEMENT` | Amounts owed to or by payout partners | SETTLEMENT |
| `TREASURY` | Prefunded liquidity at partners and banks | SETTLEMENT |
| `SUSPENSE` | Unidentified or unmatched value | SETTLEMENT |
| `ADJUSTMENT` | Controlled operator corrections (maker-checked) | SETTLEMENT |
| `PLATFORM` | Fee and FX revenue | CORPORATE |

Fund classes (`FUND_CLASS` in `services/ledger/ledger.service.ts`) let finance and regulators separate customer money from settlement and corporate money ([regulatory/CUSTOMER_FUNDS.md](regulatory/CUSTOMER_FUNDS.md)). Currencies represented: USDT, BTC, ETH, BNB, SOL, XRP, ADA, DOGE, MATIC, DOT, AVAX, USD, EUR, GBP, AED, SAR, EGP, LYD, TRY, TND.

## Posting

`postLedger(tx, { refType, refId, memo, legs })` — always inside the caller's transaction:

1. Rejects an empty journal and checks the signed sum per currency is zero (to 1e-12).
2. Finds or creates each account, inserts the legs with one `groupId`, updates cached balances.
3. Refuses to take a `USER` account negative unless the caller passes `allowNegativeUser` (used only where legacy wallets may not yet be fully represented in the ledger; see [audit/TECHNICAL_DEBT.md](audit/TECHNICAL_DEBT.md)).

The database enforces the same rule independently: a **deferred constraint trigger** (`LedgerEntry_balanced_group`) re-sums each group at COMMIT and aborts the transaction if any group is unbalanced. Ledger entries are **append-only** (`tazdan_forbid_mutation` trigger): corrections are new journals, never edits.

## Journals by flow (selection)

| Flow | refType | Legs |
|---|---|---|
| Bank deposit confirmed | `deposit` | SYSTEM_ONRAMP − → USER + |
| Withdrawal paid | `withdrawal` | USER − → SYSTEM_OFFRAMP + (fee → PLATFORM +) |
| Internal transfer | `transfer` | sender USER − (amount+fee) → recipient USER + amount, PLATFORM + fee |
| Chat payment | `message_payment` | as transfer |
| Claim link | `claim_link` | amount reserved in the sender's wallet at creation; on redemption sender USER − → recipient USER + |
| P2P trade | (escrow module) | seller USER − → SYSTEM_ESCROW + at lock; SYSTEM_ESCROW − → buyer USER + on release, or back to the seller on refund |
| Swap | `swap` | USER − (from) → SYSTEM_FX + (from); SYSTEM_FX − (to) → USER + (to) |
| Remittance funded | `remittance_funding` | USER − totalDebit → REMITTANCE_CLEARING + |
| Remittance paid | `remittance_payout` | CLEARING − totalDebit → TREASURY(src) + (send − margin), PLATFORM(src) + (fee + FX margin); TREASURY or PARTNER_SETTLEMENT(dst) − receive → SYSTEM_OFFRAMP or beneficiary USER + receive |
| Remittance refunded before payout | `remittance_refund` | CLEARING − → USER + (full amount, fee included) |
| Payout returned after payment | `remittance_payout_reversal` | the paid journal reversed leg for leg (funds back in clearing, pool liquidity restored), then refunded to the customer |
| Goodwill refund (after delivery) | `remittance_goodwill_refund` | PLATFORM − → USER + (maker-checker) |
| Treasury prefund / withdraw / adjust | `treasury_prefund` … | TREASURY ⟷ SYSTEM_ONRAMP or ADJUSTMENT |
| Business payout | `business_payout` | business USER − (amount+fee) → recipient USER + amount, PLATFORM + fee |
| Manual adjustment | `adjustment` | USER ⟷ ADJUSTMENT (maker-checker above the single-control limit) |

## Reconciliation and the trading halt

`services/ledger/reconcile.service.ts` runs every 5 minutes:

- **Cache integrity** — each account's cached balance equals the sum of its entries. Computed in **one SQL statement** so concurrent postings cannot appear as drift (CL-19; `ledger.reconcile.test.ts`).
- **Conservation** — the signed sum of all entries per currency is zero.

Any break sets the persisted trading halt; exchange and swap paths refuse new orders until an administrator clears it after investigation. Wider integrity checks (wallet read model vs ledger, treasury pools vs ledger, clearing vs in-flight transfers, negative wallets) run in the reconciliation scheduler and appear as exceptions in the cockpit ([RECONCILIATION.md](RECONCILIATION.md)).

## Rules for engineers

- Never update `Wallet.balance`, `LedgerAccount.balance` or a transaction status outside a service that also posts the journal in the same transaction.
- Use `reserveFunds` / `settleReserve` / `releaseReserve` / `debitAvailable` (`services/wallet/atomicWallet.ts`); each is one conditional `UPDATE`.
- A new flow needs a new `refType`, a balanced journal and a test that sums its legs to zero.
