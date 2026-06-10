# AML/CFT Program — outline mapped to existing controls

**Status: DRAFT skeleton for the compliance officer / counsel to formalize.
The point of this doc: most of the program's technical controls already
exist in the codebase — what's missing is the written program, an
accountable owner, and a sanctions vendor.**

## 1. Governance

- Appoint an **MLRO/Compliance Officer** (can be a fractional/consultant
  MLRO initially — common for early VASPs). Until then the founder is the
  de-facto MLRO and should sign this document.
- Board-approved program review annually; record of changes.

## 2. Customer Due Diligence (CDD) — mostly built

| Requirement | Status in code |
|---|---|
| Identity verification | KYC flow + Sumsub integration scaffold (`KYC_PROVIDER=SUMSUB`) — **activate Sumsub in prod; MOCK mode must never approve real users** |
| Age ≥ 18 | enforced at registration (DOB check) |
| KYC gates money-out | fiat + crypto withdrawals require `kycStatus=APPROVED` |
| Business accounts (KYB) | BusinessProfile + kybStatus exist — define doc requirements |
| Re-verification triggers | TODO: re-KYC on dormancy + risk events |

**EDD triggers to write down:** volume > $10k/30d, business accounts,
PEP/adverse-media hits, P2P counterparty concentration.

## 3. Sanctions & screening — the biggest gap

- **Select a vendor now**: ComplyAdvantage / Elliptic / Chainalysis (wallet
  screening) + name screening (often same vendor). Budget $500–2k/mo entry.
- Wire-in points (the hooks already exist):
  - At KYC approval: name vs OFAC/UN/EU/UK lists.
  - At crypto withdrawal: destination address screening — the code already
    has the marker (`TODO(compliance)` in `onchainSettlement.service.ts`).
  - At deposit confirmation: source-address screening, hold on hit.
- Geo controls: block sanctioned jurisdictions at signup (country field) and
  IP (Cloudflare rule). Libya itself is NOT comprehensively sanctioned —
  but specific entities are; screening covers that.

## 4. Transaction monitoring — leverage what exists

The platform already has an `AMLFlag` system with admin review queue
(clear/escalate/freeze, wallet-freeze on FROZEN + instant session
revocation). Formalize the rule set that CREATES flags:

- Structuring: >3 transactions just under round thresholds in 24h
- Velocity: deposits→withdrawal within minutes, repeatedly
- P2P: same counterparty pair >N trades/day; price far off market
- Aggregate: user crosses $10k/30d (EDD), $50k/30d (mandatory review)
- New-account: first-week outflow > deposit total

Each fired rule → AMLFlag row (system already displays + audits these).

## 5. Record keeping & reporting

- Retain KYC docs + transaction records 5 years (DB + uploads volume —
  ensure backups cover `uploads/`, see backup-restore runbook).
- STR/SAR filing process: depends on licensing jurisdiction (memo) — MLRO
  files; engineering provides an export (`/api/export` exists; add a
  case-file export for a user: KYC + transactions + flags + sessions).
- Travel rule (crypto transfers > threshold): once licensed, integrate via
  the custody/screening vendor (Notabene/Sumsub TR module). Not blocking
  pre-license; required at scale.

## 6. The honest gap list (engineering can't fix)

1. No licensed entity → no formal program can be "compliant" yet
   (see licensing-memo.md). 2. No MLRO. 3. No sanctions vendor contract.
4. Sumsub running in MOCK outside dev would be a fatal finding — verify
   prod env sets real credentials before launch.
