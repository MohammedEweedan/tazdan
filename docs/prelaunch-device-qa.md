# Physical-device pilot acceptance

Status: pending. Automated TypeScript/bundle checks are not physical-device approval. Assign a named reviewer and record app build/commit, OS version, device model, language, network and evidence for each run. Use only isolated test accounts and provider sandboxes. Keep screenshots containing personal data in the private evidence directory.

Run the core journeys on a small and large iPhone and an Android device, including the oldest supported OS and a lower-memory device. Cover Arabic and English; dark/light themes; large text; VoiceOver/TalkBack; mixed Arabic, decimal amounts, currency codes, handles, IBANs and chain addresses. Check that truncation never hides the amount, recipient, fee or confirmation action. Verify the native app's intended text/layout direction on-device instead of assuming a translated string certifies RTL.

| Journey | Required checks |
| --- | --- |
| Sign-up/login/recovery | Expired/incorrect/replayed OTP, retry limits, biometrics cancelled/unavailable, trusted/new device, revoked refresh tokens and sign-out after restart. |
| KYC | Bad/oversized upload, camera/library permissions denied, manual review, rejection/retry, tier/limit change; no production mock approval. |
| Money review | Exact recipient, source/destination currency, fees, final amount, quote expiry/refreshed terms, insufficient spendable funds and confirmation step-up. |
| Submit/recover | Double tap, network loss before/after accepted request, background/force quit, retry with same id, unknown-provider state, history/reference recovery; never tell the user to create another payment. |
| Reversal/holds | Cancel and refund once, pending funds, partial/unavailable refund, shared halt/feature-off notices while balances/history and recovery remain reachable. |
| Custody | Wrong network, invalid address/checksum, MFA, whitelist delay, unsupported rail refusal before debit, unknown broadcast tracking. |
| Arabic/accessibility | Labels and error recovery, keyboard/font scaling, screen-reader focus order, mixed numerals/addresses, recipient-name direction and confirmation visibility. |
| Operations | Customer reference maps to support/audit/provider history, complaint ownership and escalation, push/email reflect actual status rather than a promised settlement. |

Archive pass/fail evidence and issues; rerun affected journeys after fixes. Review device crash-free sessions (pilot target ≥99.5%) and exercise weak/offline connectivity. No real funds until authorization, provider, security, money-path, recovery and operations gates also pass. A successful simulator recording or an exported bundle cannot replace this sign-off.
