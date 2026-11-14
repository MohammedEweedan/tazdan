# Tazdan financial hardening and launch assessment

17 October 2026 · working branch `codex/financial-launch-hardening` · local changes, not deployed

Tazdan is worth developing if the next investment proves a licensed, bankable, economically viable payment service. The current evidence does not justify a 10/10 rating or a worldwide public launch. This work improves the accounting and release controls, contains unsafe legacy crypto execution, and supplies a transparent 24-month model. It does not establish that customer balances are backed by real bank/custody assets, that an overseas entity has permissions, or that a payout partner accepts Libya-origin funds.

The strongest immediate product is a tightly scoped Libya payment and remittance service, with reliable collections, transparent quotes, payout tracking, receipts, returns and support. Add additional financial products after each has legal authority, provider acceptance, demonstrated unit economics and reconciled operation. The platform's feature inventory is already broader than the capabilities whose real-money readiness has been demonstrated.

## Changes implemented

| Finding | Implemented control | Practical limit |
| --- | --- | --- |
| Fee reporting could create corporate USDT from an estimated value without exchanging the original asset | Removed the corporate-user wallet mirror and fictional FX postings. Fee reporting preserves native currency, source-reference idempotency and visibly nullable USD valuations | Historical mirror credits still need independent investigation and approved correction. Fee reporting is not a bank asset or an additional revenue journal |
| Small imbalances could pass tolerance checks; rounding could hide value | Exact per-currency and dynamic-asset conservation, local 80-digit arithmetic, representable finite amount validation, database constraints and account/entry currency matching | Wallet read models retain eight decimals; chain/provider precision and reconciliation tolerances still need rail-specific acceptance |
| Concurrent first postings could create duplicate system accounts | Natural-account advisory locks, deterministic account lock order, system-account unique index, user/system ownership constraints | Migration intentionally fails on unresolved legacy duplicates; it never silently merges accounting evidence |
| Dynamic assets escaped scheduled ledger reconciliation | Added asset account cache and conservation checks alongside enum-currency checks | Internal conservation does not establish external reserve backing |
| Fund-integrity reads could combine different financial snapshots | One repeatable-read inspection, no overlapping scheduled runs, immediate initial audit, halt on rail evidence exceptions and audit errors when halt is configured | Production must run with `FUND_AUDIT_HALT=1`; acknowledged history is not proof of safeguarding |
| Treasury references could double-book a bank movement; pool selection could be ambiguous | Reference idempotency, changed-term conflict, eight-decimal movement validation, entity-scoped pool selection and ambiguity rejection | A manual reference still needs a verified bank statement. This is one entity per deployment, not a fully entity-keyed shared ledger |
| Access-token revocation depended too heavily on caches | Persisted session revocation checked on access and sockets; database uncertainty closes access; token timestamps issued consistently | Adds database work per authenticated session; production capacity needs measurement |
| Single-use MFA broke legitimate withdrawal retries | A persisted approval is bound to user, idempotency key, exact asset, network, amount and destination; identical retries reuse it briefly, changed terms fail | A different request needs fresh MFA. Production TOTP consumption also has a database unique marker |
| Crypto execution could credit before venue finality and refund an unknown outcome | Production real-money crypto trading is forcibly disabled, even with the feature override. Portfolio exposure checks share a portfolio lock | Durable reserve/submit/reconcile/finalise execution and venue certification remain required before reopening |
| Historical prices could understate financial limits during a price outage | Production real-money FX and crypto pricing refuse stale/static fallbacks. KYC/AML valuation fails when a current price is unavailable | Stablecoin USD parity is still an explicit risk/reporting convention; it is not a cash conversion or guarantee |
| Release approval omitted explicit entity, safeguarding and liquidity evidence | Version 2 manifest with nine mandatory gates; legal entity and customer-country scope; runtime/entity checks and readiness CLI checks | An evidence file is a control, not an independent audit. Actual signed artifacts and reviewers remain necessary |

Customer-limit enforcement was additionally moved into the committing transactions for local transfers, chat payments, claim creation, P2P escrow initiation, card loads and on-chain/fiat withdrawal creation. A shared customer lock and one SQL snapshot across completed and pending obligations prevent parallel local payments from spending the same allowance. Remittance has its own existing transactional corridor limits. These product-specific limits are not represented as one comprehensive group-wide AML exposure policy; compliance must approve cross-product aggregation and threshold coverage.

## What still blocks launch

1. **Origin permission and settlement.** Obtain a signed assessment and issued permissions or approved regulated-principal arrangement covering LYD collections, conversion, outward transfers, permitted fees, customer disclosures and the exact legal entity. CBL's [publication register](https://cbl.gov.ly/publications/) lists 2026 circulars concerning outward transfers through exchange companies and banks. Their detailed applicability to this business model needs a Libyan legal opinion and bank confirmation; this assessment does not treat registration or an application as authorisation.
2. **Bank and partner acceptance.** Signed live contracts must explicitly accept Libya-origin funds and define sender residency, destination, currency, purpose, payout method, settlement timetable, screening responsibilities, finality, returns and complaints. A provider's global marketing coverage does not establish these permissions. Implement and certify each live adapter; never substitute sandbox payouts.
3. **Opening customer safeguarding.** Independently reconcile every customer liability, pending payout, escrow balance and return to actual bank/custody statements. Explain the previously reported approximately 2,444 USDT discrepancy; it was not measured afresh here. Do not clear it by acknowledging a baseline or booking an unsupported asset.
4. **Historic fees and migration.** Reconcile old corporate wallet credits, fee records and ledger revenues. Review legacy fee backfill/history scripts before use: current rates are not historical transaction rates. Rehearse the new migration on a restored production copy and resolve duplicate identities, references and fee sources using approved, auditable corrections. No production data was inspected or altered in this work.
5. **Capital and replenishment.** Fund each legal entity/currency/partner pool with own capital. Demonstrate the lawful route that turns collected LYD into replenishable foreign liquidity, including weekends, bank cutoffs, sanctions reviews and rejected payments. A large LYD asset cannot itself pay an overseas beneficiary.
6. **Entity accounting.** The deployment now requires a matching entity ID, but ledger accounts throughout the application do not have comprehensive legal-entity keys. Use separate books, databases, custody and bank accounts for each company until a properly scoped intercompany ledger is implemented and independently tested.
7. **Unfinished capabilities.** Crypto execution stays disabled pending a durable execution workflow. Cards require issuer/PSP certification and recovery testing. The unrouted group-pool controller contains assumed USD-to-USDT conversion and legacy updates; keep it unrouted and exclude pooled products until native-currency custody is rebuilt. Do not expose every financial feature in the initial release.
8. **Independent assurance and operation.** Complete external penetration testing, sanctions/PEP and monitoring acceptance, remote custody/key recovery where relevant, physical-device English/Arabic RTL and accessibility QA, offsite restore/PITR and money reconciliation drills, real alert delivery, support and complaints readiness. Local test success does not replace them.

The maintained operational checklist is [docs/audit/LAUNCH_BLOCKERS.md](../docs/audit/LAUNCH_BLOCKERS.md). All nine gates in [the evidence example](../docs/launch-evidence.example.json) deliberately remain pending.

## Sister-company remittance structure

Use a holding company with separately incorporated operating businesses: an appropriately authorised Libyan origin business and an overseas sister that is authorised for its actual payment activity, or operates under a documented regulated-principal arrangement where permitted. Each entity needs its own accounts, contracts, books, governance and controls. The sister can connect to destination payout partners independently of the Tazdan application; shared ownership and branding do not collapse the regulatory or safeguarding boundaries.

For each accepted transfer, lock the customer quote, fee, destination amount and expiry. Reserve customer funds and available payout liquidity. Obtain the sister/partner's durable payment reference, record the exact reciprocal intercompany obligation in contractual currencies, and reconcile the final payout or return against statements. Maintain separate customer liabilities, safeguarded assets, own prefunding, earned revenue and intercompany balances. Compare forecasts approximately; settle legal obligations exactly, with documented FX rates and rounding treatment.

For example, if the sister pays USD 1,000 for a Libyan-origin transfer, its receivable and the Libyan company's payable must record the contractually agreed USD obligation and separate fees. An estimated LYD equivalent is a reporting value. Accepting LYD as settlement requires contractual terms, lawful FX treatment and a usable replenishment route. It does not replace the USD that has left the sister's account.

Keeping destination-currency reserves can reduce payout latency. Collecting genuine reverse-direction payments can reduce gross settlement needs if lawful netting is supported by the relevant contracts and rules. Neither makes one-way outbound volume self-financing. The model below quantifies only a blended prefunding requirement; fragmented currency pools, blocked balances and destination-specific minimums can require more. Customer safeguarded money must not fund group operating losses or another entity's general liquidity.

Worldwide reach is an expansion programme, not one launch scope. Begin with one bankable corridor, potentially Libya–UAE if the partners and legal permissions support it. Add the UK/EU, North America, Asian and African routes by approved country and payout method, with recorded ownership of compliance and complaints. No incorporation jurisdiction has been selected or company formed here.

## Published CBL figures and forecast construction

The latest report listed on the Arabic [CBL foreign-exchange-use index](https://cbl.gov.ly/uses-of-foreign-exch/) at research time covers **1 January–30 September 2026**. Its summary on printed page 2 reports the following USD-equivalent actuals:

| Category | Jan–Sep 2026 actual |
| --- | ---: |
| Total bank foreign-exchange uses | $19,341,501,336 |
| Documentary letters of credit | $10,113,469,233 |
| Transfers — الحوالات | $2,681,416,804 |
| Personal purposes | $6,507,616,299 |

The three categories shown do not sum to the total because merchant cards are another category. Transfers average **$297,935,200 per month** over the nine observed months; annualising gives approximately **$3.575 billion**, an arithmetic run rate, not a CBL forecast. Transfers include activity beyond Tazdan's intended product. LCs, personal allocations and gross domestic payments are excluded from the forecast's transfer benchmark. No CBL customer counts or corridor demand estimates are inferred.

The workbook builds revenue from active customers × transfer frequency × ticket × retained fee. It separately calculates rail/FX costs, per-transfer charges, expected losses, acquisition spend, fixed opex, setup cost, own prefunding and free corporate cash. Customer principal is never revenue or free corporate capital. Months are relative to an authorised launch; no launch date is assumed.

The base assumptions are 100 new active customers in month 1, 8% monthly growth in acquisitions, 2% monthly attrition, 1.3 transfers per average active customer, a $1,500 ticket, 0.5% retained gross fee, 0.15% variable rail/FX cost, $0.75 processing per payment and 0.03% expected losses. Acquisition costs $20 per new active customer; fixed opex is $20,000/month in year 1 and $25,000 in year 2. Setup is $100,000. These are editable management assumptions, not CBL facts, quoted provider costs or approved customer prices. The assumed 0.5% fee is not a legal opinion about an applicable fee cap.

| Illustrative case | Year 1 volume | Year 1 fee revenue | Year 1 operating result | Year 2 volume | Year 2 fee revenue | Year 2 operating result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Downside | $3.13m | $15.6k | ($233.2k) | $10.76m | $53.8k | ($266.4k) |
| Base | $17.71m | $88.5k | ($230.1k) | $80.61m | $403.0k | ($177.9k) |
| Growth | $59.89m | $299.4k | ($229.5k) | $319.90m | $1,599.5k | $358.3k |

Operating results include assumed customer acquisition and fixed operating expense; they exclude setup, tax, financing and unpriced regulatory capital/guarantees. The cases are sensitivities, not probabilities or promises. The growth case requires substantial acquisition, capacity and banking liquidity; it is not established demand.

| Capital view over 24 months | Downside | Base | Growth |
| --- | ---: | ---: | ---: |
| Illustrative opening corporate capital | $500,000 | $750,000 | $1,500,000 |
| Peak own prefunding | $190,099 | $2,673,576 | $21,184,906 |
| Additional capital gap beyond that opening capital | $264,686 | $2,431,663 | $19,706,087 |
| Minimum total modelled capital before exclusions | $764,686 | $3,181,663 | $21,206,087 |

Base prefunding uses five payout days × 1.5 stress divided by a 30-day month. At month 24, base volume is approximately $10.69m/month and the operating break-even volume is **$13.61m/month** at that month's acquisition spend and costs. The remaining approximately $7,868/month loss means the proposed economics need improvement even after scale. Base opening capital alone runs short during month 9 under these assumptions. Regulatory capital, safeguarding guarantees, trapped liquidity, taxes and financing add to the displayed requirement.

My commercial recommendation is to secure a regulated origin/settlement arrangement and a partner that supplies an economically viable liquidity cycle before investing in broad global functionality. Consider a licensed principal owning collection/settlement while Tazdan supplies distribution and software, if legally and commercially available. Where liquidity and fees cannot support retail remittances, assess contracted business payment workflows or software/service revenue using signed customer demand; none is assumed profitable without evidence. Improve permitted retained economics, acquisition efficiency and funded replenishment, rather than increasing feature count to chase a rating.

## Validation and acceptance

Local validation uses an explicitly isolated PostgreSQL instance at `127.0.0.1:55479`, never the configured production database. All 58 migrations, including the new controls, were applied to a clean disposable database; suites also create private schemas. Testing found that this Prisma/PostgreSQL combination could return callback success despite a deferred COMMIT constraint rolling back the invalid row. The shared Prisma client now forces pending constraints before returning success, for both interactive and batch transactions. Database tests require an observable rejection and rollback. Repeat these tests on the production PostgreSQL/Prisma versions before deployment.

The validation record in `docs/audit/FINANCIAL_HARDENING_VALIDATION_2026_10_17.md` contains the final test and type-check results. The workbook has live formulas, one case selector, fixed sourced actuals, an input sensitivity check, cash-bridge checks and rendered inspection of every sheet. A 10% increase in ticket size increases year-1 principal volume by 10%; no balance-sheet backing claim is inferred from those forecast checks.

The practical path to a top-tier service is evidence based: reconcile the opening books; secure exact legal/banking scope and own liquidity; certify each enabled rail; rehearse recovery and production migration; run a capped pilot with no unexplained balances; and then expand only after sustained measured settlement, support, reliability and complaints performance. No credible engineering exercise can promise perfect operation or manufacture those external approvals.
