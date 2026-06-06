# Compliance Operations Runbook

This runbook covers day-to-day compliance operations for a controlled beta.

## Daily Review

- Review pending KYC/KYB queue.
- Review withdrawals above the manual threshold.
- Review AML flags, P2P disputes, chargebacks, and account freezes.
- Export prior-day deposits, withdrawals, fees, and admin credits.
- Check sanctions-provider and KYC-provider webhook health.

## User And Transaction Holds

Freeze a user when:

- Identity or sanctions risk is unresolved.
- Withdrawal pattern indicates cash-out fraud.
- Account takeover is suspected.
- Regulator, bank, or payment partner requests a hold.

Before unfreezing:

- Record the reason and reviewer.
- Confirm no pending suspicious withdrawal remains.
- Notify support so user-facing messaging is consistent.

## Admin Credits

Admin credits are external money entering the system.

- Every admin credit must include a note.
- Every admin credit must create a balanced ledger group:
  - debit `SYSTEM_ONRAMP`
  - credit user `LedgerAccount`
- Never use admin credit to hide a negative fund-integrity diff. Negative diff means leaked funds and requires investigation.

## Suspicious Activity

Open an investigation when:

- Deposit to withdrawal happens within the configured velocity window.
- User changes withdrawal address and immediately attempts withdrawal.
- User receives many claim links from unrelated senders.
- P2P dispute rate or cancellation rate is abnormal.
- Device, country, or IP differs from the account norm on a money action.

Record:

- User ID and transaction IDs.
- Trigger condition.
- Evidence links or screenshots.
- Decision and reviewer.
- Whether a SAR/STR-style report is required in the launch jurisdiction.

## Weekly Review

- Sample completed withdrawals against bank or chain settlement.
- Reconcile platform fee ledger against platform wallet.
- Check dormant admin accounts and active sessions.
- Confirm legal copy and public disclosures still match enabled jurisdictions.

