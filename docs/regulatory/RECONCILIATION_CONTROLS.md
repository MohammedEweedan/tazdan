# Reconciliation controls

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

| Control | Frequency | Break handling |
|---|---|---|
| Ledger cache vs entries; conservation per currency | Every 5 minutes | Trading halt set automatically; cleared by an administrator after investigation |
| Provider statements vs internal payouts (missing, duplicate, amount, currency, fee, status, late) | Every 30 minutes per enabled external rail, and on demand | Exception with owner workflow (resolve, escalate, write off) |
| Internal wallet payouts vs ledger | Every 30 minutes | Completes matched transfers |
| Wallet read model vs USER ledger | Every 30 minutes | Exception |
| Negative wallets | Every 30 minutes | Exception |
| Treasury pools vs ledger | Every 30 minutes | Exception |
| Remittance clearing vs in-flight transfers | Every 30 minutes | Exception |
| Fund-integrity audit (internal holdings vs on-chain) | Every 10 minutes (existing) | Log alert |

Exceptions are de-duplicated across runs and auto-closed (with a note) when the break disappears; escalated ones stay open. Resolutions are audited; write-offs never move money — corrections are dual-controlled adjustments. Evidence: `ReconciliationRun`, `ReconciliationItem`, audit log. Tests: `remittance.golden.test.ts`, `ledger.reconcile.test.ts`.

Not automated: bank and safeguarding statement reconciliation (needs bank connectivity), card scheme settlement.
