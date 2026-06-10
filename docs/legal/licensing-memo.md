# Licensing & legal structure — decision memo

**Status: DRAFT for counsel review. This is an engineering-side analysis to
make the lawyer conversation cheap, not a substitute for one.**

## What the platform legally IS

Custodial crypto wallets + fiat balances + cross-border transfers + an FX
business on the LYD parallel rate + P2P marketplace + cards. In virtually
every framework that combination = **VASP/CASP (custody + exchange) plus
money transmission**. Operating any of it without a license exposes the
founders personally (most regimes criminalize unlicensed money
transmission) and gets the app pulled from stores on first complaint.

## The Libya problem

- The CBL's 2018 position treats crypto dealing as prohibited; there is no
  Libyan VASP regime to license under. The parallel-FX market the product
  serves is itself extralegal in Libya.
- Consequence: **the operating entity, servers, and bank accounts must sit
  outside Libya**, serving Libyan users where not prohibited *for the user*
  (cf. how Binance/OKX historically served the market), with the legal
  analysis of "marketing into Libya" done by counsel. Liability follows the
  entity, the directors, and the banking — put none of them in Libya.

## Jurisdiction options

| Option | Fit | Cost/time (ballpark) | Notes |
|---|---|---|---|
| **UAE — VARA (Dubai) / ADGM** | Strong: MENA-credible, Arabic-market native, real banking access | $100k+ setup, $60k+/yr, 6–12 mo | The "do it properly" path; VARA VA Exchange + Custody categories cover the product. Capital requirements apply. |
| **EU — MiCA CASP (e.g. Lithuania, Malta)** | Strong on paper; passporting across EU diaspora (big Libyan communities in EU) | €50–125k capital + setup, 6–12 mo | MiCA fully applicable since Dec 2024; covers custody + exchange. Fiat transfer side needs an EMI/PI partner or license. |
| **Georgia / Kazakhstan (AIFC)** | Cheaper VASP regimes, faster | $20–60k, 3–6 mo | Weaker bank/PSP access and weaker badge of trust; workable interim. |
| **US MSB (FinCEN + states)** | Poor fit | — | State-by-state MTLs are years/$MM; no need unless serving US users — **geo-block the US meanwhile**. |
| **Offshore-only (SVG/Seychelles shell)** | Not a real option | cheap | No banking, no app-store durability, no investor diligence survival. Mentioned to be rejected. |

**Recommendation:** incorporate a UAE holding/ops company now (free-zone,
fast), begin VARA scoping with a Dubai crypto-licensing counsel, and in
parallel evaluate a Lithuania CASP for the EU diaspora corridor. Decision
forced by: where your first banking/PSP partner will actually onboard you.

## Action checklist (next 60 days)

1. Engage MENA fintech counsel (Dubai). Bring this memo + product one-pager.
2. Incorporate the entity; move droplet/infra contracts + IP assignment into it.
3. Geo-blocking: US + sanctioned jurisdictions (IR, KP, SY, CU, RU per
   current OFAC posture) at signup (country field already collected) and at
   IP level via Cloudflare.
4. Terms of Service + Privacy Policy + Risk Disclosure drafted by counsel
   (the app currently ships none — App Store review will eventually ask).
5. Sanctions screening vendor selection (see aml-program.md) — this is also
   the #1 thing any banking partner asks for.
6. Banking/PSP: target EMIs comfortable with MENA flows for the fiat legs.

## Why this is THE gating workstream

Every other risk in this project is bounded and engineerable. This one
compounds: no license → no banking → no fiat rails → the product collapses
to crypto-only; and an enforcement action converts the founders' best asset
(a working platform with users) into evidence. Spend the money.
