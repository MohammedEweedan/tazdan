# The Tazdan Manifesto - English Edition

6 October 2026 | Version 1.0 | Confidential

## 1. Executive summary

Tazdan is a pre-launch, Arabic-first financial platform built from Libya outward. Its code combines identity, multi-currency wallets, exchange, internal transfers, claim links, P2P escrow, savings tools, digital-asset custody, a double-entry ledger and an operations console. The public site explicitly says regulated services depend on approvals and partners. A product build is therefore demonstrable; a licensed, live cross-border institution is not verified.

Evidence: server/src/index.ts; server/prisma/schema.prisma; https://www.tazdan.com/

The strongest verified asset is the accounting and control layer: postLedger requires per-currency balanced legs, writes within the caller's transaction, and maintains read balances; reconciliation and fund-integrity jobs can halt trading on drift. The key caveat is that static review does not prove every money path uses that primitive or that a deployed environment has passed an independent audit.

Evidence: server/src/services/ledger/ledger.service.ts; server/src/services/ledger/reconcile.service.ts; server/src/services/ledger/fundIntegrity.service.ts

The proposed commercial wedge is transparent local-currency conversion and compliant remittance across underserved corridors, first through licensed banks and payout partners. Code supports quotes and some internal movement, but no complete corridor-specific beneficiary, payout, settlement and reconciliation orchestration was verified. The business mobile screens call /business/* endpoints that are not mounted in the current server.

Evidence: server/src/routes/exchange.ts; server/src/routes/transfer.ts; server/src/index.ts; mobile/src/services/business.ts

**The investable system: current core and proposed rails**
Consumer / business → Tazdan app + API → Ledger + controls → Licensed local rail → Licensed payout rail → Recipient

|Investment fact|Current reading|
|---|---|
|Code footprint|62 Prisma models; 288 mounted route declarations; 79 non-layout Expo route files.|
|Commercial status|Pre-launch; no verified licence or live payout network.|
|Control strengths|Balanced ledger, reconciliation, KYC adapter, rate limits, step-up controls.|
|Critical gaps|Business API, real card issuer, live off-ramp and complete remittance orchestration.|
|Near-term thesis|Prove one legal corridor with liquidity, audited controls and daily close.|

Evidence: server/prisma/schema.prisma; server/src/index.ts; mobile/app; https://www.tazdan.com/trust

## 2. Tazdan in one page and evidence rules

The customer sees one account to hold value, request or send money, exchange, save and view activity. The operator must separately manage identity, sanctions, partner settlement, liquidity, safeguarding, exceptions and books. These are distinct obligations: an attractive screen is not proof that external money can move.

Evidence: mobile/app; server/src/index.ts; https://www.tazdan.com/

|Evidence label|Meaning|
|---|---|
|CODE|Implemented in the reviewed repository; deployment not implied.|
|PUBLIC CLAIM|Published by tazdan.com; independently checked against code.|
|PARTNER / REGULATORY|Needs contract, licence or approval before use.|
|PROPOSAL|Target operating design, not current capability.|
|ASSUMPTION|Illustration or forecast, not historic performance.|

Evidence: Methodology of this review

This is a static source and public-site review at repository commit 01de005, dated 6 October 2026. It did not inspect a live database, secrets, signed partner agreements, licences, bank statements, production telemetry or a deployed cloud account. Historic project assessment files conflict because they describe earlier snapshots; current source takes precedence.

Evidence: git rev-parse HEAD; PROJECT_ASSESSMENT.md; LAUNCH_READINESS.md

## 3. Product ecosystem and maturity

The mobile product is an Expo/React Native route-based app. The web is Next.js and contains marketing, legal and administrative surfaces. The server is Express/TypeScript with Prisma/PostgreSQL, Redis and Socket.IO. Screens and API calls were compared with mounted routes, controllers and provider implementations before assigning maturity.

Evidence: mobile/package.json; client/package.json; server/package.json; server/src/index.ts

|Domain|Evidence and status|
|---|---|
|Identity & accounts|Registration, login, refresh, 2FA and profiles implemented; KYB profile stored.|
|Wallets & internal transfer|Wallet, transfer and transaction routes; ledger coverage needs path-by-path tests.|
|FX & exchange|Quote/execute, LYD feed adapter, fallback rates; live liquidity and fill unverified.|
|Claim links|Create, preview, claim, cancel and sweep routes; recipient must claim in platform.|
|P2P|Escrow and dispute code; new activity off by default in production.|
|Budgets & recurring buys|Routes and schedulers present; release controls and end-to-end tests needed.|
|Cards|Card CRUD and mock issuer; new issuance off in production; no live issuer verified.|
|Business|Registration/KYB model and mobile screens; /api/business router absent.|
|International remittance|No verified complete cross-border routing and payout orchestration.|
|Crypto custody|Derivation, deposits and EVM settlement paths; BTC/SOL/TRON live signing incomplete.|

Evidence: server/src/index.ts; server/src/services/cardIssuer/index.ts; server/src/utils/features.ts; mobile/src/services/business.ts; server/src/services/wallet/onchainSettlement.service.ts

## 4. System architecture

The deployed design is a modular monolith, not an independently deployed microservice mesh. Express mounts domain routers; controllers call services and Prisma. PostgreSQL stores transactional state. Redis supports caching/rate limiting where configured; Socket.IO serves live messaging. Scheduler startup and reconciliation live in the server process. The production compose file shows nginx, server, web and Redis with a managed PostgreSQL dependency.

Evidence: server/src/index.ts; server/src/utils/redis.ts; docker-compose.prod.yml

**Verified container relationships**
Expo app / Next.js → nginx / API → Express domains → Prisma / PostgreSQL → Redis + Socket.IO

|Layer|Actual mechanism|
|---|---|
|Clients|Expo Router mobile; Next.js public and admin web.|
|API|Express routes, middleware, JWT, per-path limiters, controllers.|
|Money|Ledger service, wallet read models, deposit/withdrawal and exchange domains.|
|State|Prisma/PostgreSQL; Redis optional; in-process cache remains for some FX state.|
|Operations|Reconciliation, fund-integrity, readiness, schedulers, Sentry if configured.|

Evidence: server/src/index.ts; server/src/services/ledger; server/src/services/ops/operationalReadiness.service.ts

Before horizontal scaling, size database pools, centralise shared rate state, make scheduled jobs leader-elected, test Socket.IO fan-out and ensure idempotent webhooks. The code permits CLUSTER_WORKERS, but defaults to one production worker to protect small PostgreSQL plans.

Evidence: server/src/index.ts; server/src/services/exchange/fxRateProvider.service.ts

## 5. Data architecture and API

The Prisma schema contains 62 models and 43 enums. Its bounded contexts include identity, wallets and ledger, deposits and withdrawals, exchange, P2P, claim links, budgets, cards, crypto custody, messaging, administration and audit. A model is a storage contract, not proof of a complete product flow. The route inventory in the appendix is generated from current route declarations and mount prefixes; it is a static inventory, not a live endpoint test.

Evidence: server/prisma/schema.prisma; server/src/index.ts; server/src/routes

**Database bounded contexts**
Identity → Wallet + ledger → Payment flows → FX + P2P → Business → Compliance → Admin + audit

|Bounded context|Key models|
|---|---|
|Identity|User, Session, RefreshToken, KnownDevice, LoginHistory|
|Accounting|Wallet, LedgerAccount, LedgerEntry, AssetLedgerAccount, AssetLedgerEntry|
|Money flows|Deposit, Withdrawal, Transfer, ClaimLink, CryptoOrder|
|Markets|ExchangeRate, FxRateTick, P2PListing, P2PTrade, P2PDispute|
|Business & ops|BusinessProfile, APIKey, AMLFlag, AuditLog, PlatformSettings|

Evidence: server/prisma/schema.prisma

Authentication varies by route: some public read endpoints and signed provider webhooks are unauthenticated by JWT, while consumer money operations require authenticate, and admin operations require authenticate plus requireAdmin. Any external API-key permission model should be treated as incomplete until the proposed business endpoints actually exist and are penetration tested.

Evidence: server/src/routes/auth.ts; server/src/routes/deposit.ts; server/src/routes/admin.ts; server/src/routes/apikey.ts

## 6. Ledger, flows and safeguarding

A ledger group is balanced by currency before commit: positive entries credit an account and negative entries debit one. USER cannot normally go negative; SYSTEM_ONRAMP, SYSTEM_OFFRAMP, SYSTEM_CHAIN, SYSTEM_FX, SYSTEM_ESCROW and PLATFORM represent counterparties or internal destinations. The cached LedgerAccount balance is checked against entries by reconciliation; Wallet is a read model for supported enum assets.

Evidence: server/src/services/ledger/ledger.service.ts; server/prisma/schema.prisma

**Funds categories**
Customer claim → Safeguarded partner account → Settlement float → Corporate operating cash

**Illustrative domestic transfer: Ahmed sends 1,000 LYD**
Ahmed USER -1,000 → Balanced LYD group → Mohammed USER +1,000

|Illustrative posting|Debit / negative|Credit / positive|Check|
|---|---|---|---|
|Internal transfer|Ahmed USER LYD 1,000|Mohammed USER LYD 1,000|Net LYD = 0|
|Illustrative fee|Ahmed USER LYD 3|PLATFORM LYD 3|Net LYD = 0|
|External deposit|SYSTEM_ONRAMP LYD 1,000|Ahmed USER LYD 1,000|Bank receipt must match|

Evidence: server/src/services/ledger/ledger.service.ts

A balanced internal ledger is necessary but does not by itself safeguard customer funds. A regulated partner must identify the legal account holder, segregate customer money from treasury and corporate cash where law requires, reconcile the bank or custody statement to the ledger daily, define shortfall funding and insolvency treatment, and document who bears counterparty risk. These arrangements were not verified in contracts or bank statements.

Evidence: server/src/services/ledger/reconcile.service.ts; https://www.tazdan.com/trust

## 7. International remittance: target operating design

A credible outbound route is: licensed Libyan funding partner receives LYD; Tazdan records the obligation; KYC/KYB, sanctions, PEP, source-of-funds and purpose checks precede a binding quote; a licensed settlement partner converts and moves value; a licensed UK/EU or other payout partner pays the beneficiary; both sides reconcile and exceptions go to an operator. The reverse route needs a licensed sender-side collector and a lawful Libyan payout partner. None of this proves that these corridors are contracted today.

Evidence: PROPOSAL; server/src/routes/transfer.ts; server/src/routes/claimLink.ts; https://www.tazdan.com/

**Proposed outbound state machine**
Draft → Screened → Quoted → Funded → Routed → Settled → Paid → Reconciled

Worked proposal: Mohammed in Tripoli sends GBP 1,000 to a daughter in Manchester. At an illustrative 12 LYD/GBP, funding is 12,000 LYD plus a disclosed fee; the quote must fix recipient amount, expiry and route. After checks, the local partner confirms cash receipt, the ledger moves liability from sender funding to settlement, the FX partner supplies GBP, and the UK payout partner confirms beneficiary receipt. Reconcile LYD funding, GBP settlement, partner fees and final payout. Do not call it complete merely because a claim link can be redeemed inside Tazdan.

Evidence: PROPOSAL; server/src/routes/claimLink.ts; server/src/routes/transfer.ts

Reverse proposal: a London sender funds GBP 500 with a licensed UK operator. Following identity and beneficiary checks, the GBP obligation is converted at a disclosed rate; a Libyan licensed partner pays the mother in Tripoli in eligible LYD form. Return codes, rejected beneficiary data, expired quotes, sanctions hits and refund ownership must be designed before launch. Candidate corridors are UK, Egypt, Turkey, Italy/EU, UAE and Tunisia, subject to legal and partner feasibility.

Evidence: PROPOSAL

## 8. Entity, partner and settlement architecture

A proposed holding entity owns IP and governance; a Libyan operating company manages local distribution only within permitted activities; a separately licensed or partner-led international entity contracts sender-side and payout providers. Contracts must specify customer ownership, fund title, safeguarding, compliance decisions, data sharing, complaints, chargebacks, treasury and settlement responsibility. Company names in the code or website are not proof of legal authorisation.

Evidence: PROPOSAL; https://www.tazdan.com/partners; server/src/utils/seed.ts

**Proposed USDT settlement controls**
Fiat funding → Customer ledger claim → Screened VASP → Whitelisted custody → Destination VASP → Fiat payout → Reconcile

**Proposed responsibilities**
Tazdan IP + orchestration → Licensed local collector → Settlement / FX partner → Licensed payout partner

|Route|Best use|Principal dependencies|
|---|---|---|
|Prefunded fiat|Predictable volume and fast payout|Working capital, partner accounts, daily reconciliation|
|Bank / SWIFT|Larger or less frequent regulated transfers|Cutoffs, correspondent banks, fees, screening|
|USDT institutional|Only where lawful and economically superior|VASP licences, custody, Travel Rule, off-ramp and blockchain risk|

Evidence: PROPOSAL; https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-update-virtual-assets-vasps-2025.html

USDT is neither a substitute for licensing nor a sanctions bypass. A permitted route would record the customer's fiat claim, convert treasury value through screened VASPs, whitelist custody addresses, exchange required originator and beneficiary data, screen the chain and counterparty, settle, convert back to fiat, pay out and reconcile. Traditional fiat may be better where bank access is reliable, liquidity is deep or digital-asset compliance cost outweighs speed.

Evidence: PROPOSAL; FATF 2025 virtual-assets update

## 9. Routing, liquidity and treasury

A future routing engine should reject illegal or unavailable routes first, then rank eligible options by net recipient amount, liquidity, partner limits, expected delivery, failure probability, FX and payout cost, bank cutoffs and settlement exposure. A cheap route with insufficient payout float is not executable. Current code has exchange pricing and provider adapters, but no verified end-to-end corridor engine.

Evidence: PROPOSAL; server/src/services/exchange/priceEngine.service.ts; server/src/services/exchange/fxRateProvider.service.ts

**Treasury control loop**
Forecast demand → Set currency floors → Prefund partners → Execute / settle → Reconcile → Rebalance

|Pool|Control|Trigger|
|---|---|---|
|LYD local|Confirmed receipts versus customer liabilities|Daily close and cash/transfer mismatch|
|GBP / EUR / USD|Payout float by partner and corridor|Forecast below minimum days of cover|
|USDT|Hot-wallet cap, whitelist, VASP exposure|Balance, chain or counterparty breach|

Evidence: PROPOSAL; server/src/services/ops/operationalReadiness.service.ts

The existing readiness service calculates exposure, stale FX feeds, failed provider transactions, hot-wallet limits, open support cases and daily-close age. That is a useful control surface, but treasury policy, committed bank lines, real partner balances and scenario-tested working capital were not verified. Before launch, set liquidity thresholds by currency and route, define who funds shortfalls, and run stressed intraday cash forecasts.

Evidence: server/src/services/ops/operationalReadiness.service.ts

## 10. Compliance and financial crime

The code includes KYC provider abstraction with a Sumsub implementation, manual and mock paths, KYB fields, an AML rules service, flags and admin review. Rules cover unverified and verified daily thresholds, large transactions and rapid activity. Whether a live Sumsub contract, sanctions/PEP package, jurisdictional policy, SAR/STR filing and Travel Rule tooling are operating was not verified. A provider's capability is not a complete compliance programme.

Evidence: server/src/services/kyc/index.ts; server/src/services/aml.service.ts; server/prisma/schema.prisma; server/src/routes/admin.ts

**Proposed compliance decision**
Identity / KYB → Sanctions + PEP → SOF + purpose → Velocity + wallet risk → Approve / hold / reject → Case + audit

|Control|Code evidence|Required proof before launch|
|---|---|---|
|Identity|Sumsub HMAC adapter; mock and manual alternatives|Contract, credentials, QA and escalation policy|
|Monitoring|Threshold and rapid-fire flags|Currency normalization, tuning, false-positive testing|
|Cases|AMLFlag and admin resolution route|Named MLRO, evidence, retention and SAR workflow|
|Digital assets|Withdrawal whitelist and custody code|Chain screening and Travel Rule exchange|

Evidence: server/src/services/kyc/index.ts; server/src/services/aml.service.ts; server/src/services/wallet/onchainSettlement.service.ts

A formal programme must assign first-line operations and independent compliance oversight, risk-score customers and corridors, monitor source of funds and wealth where relevant, define hold and exit rules, retain records, and report to the competent authority under local law. Legal requirements differ across Libya and each foreign destination; this report proposes controls and does not provide a jurisdictional legal opinion.

Evidence: PROPOSAL; https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-update-virtual-assets-vasps-2025.html

## 11. Security, digital assets and custody

The server uses Helmet, CORS allowlisting, rate limiters, JWT-based authentication, 2FA, trusted devices, step-up challenges and an audit log. Custody supports BIP-39 seed generation, AES-256-GCM encryption and optional AWS KMS envelope encryption. The server can decrypt the master seed via getMasterMnemonic; the public assertion that it can only ask KMS to sign and cannot read the seed is therefore not supported by this design. KMS deployment and key policy were not inspected.

Evidence: server/src/index.ts; server/src/services/wallet/masterSeed.service.ts; https://www.tazdan.com/trust

**Custody control chain**
Identity + step-up → Withdrawal whitelist → Approval record → Signer / key → Network broadcast → Confirmations → Ledger close

|Asset / rail|Implementation reading|Limit|
|---|---|---|
|EVM|Derivation and on-chain settlement path|Provider, nonce, gas, policy and chain-screening assurance needed|
|BTC / SOL / TRON|Derivation and monitoring elements|Live broadcast/signing marked incomplete in settlement service|
|Key export|Password, 2FA and tier-2 check then private-key export|Irreversible exposure; mixed custody accounting needs review|
|Withdrawals|Whitelist and approval records|Test independent approvals and signer isolation|

Evidence: server/src/services/wallet; server/src/routes/cryptoWithdrawal.ts

Priority security work is an independent penetration test; secret and privilege inventory; KMS access separation and key recovery drills; audited signer isolation; device and withdrawal abuse testing; immutable off-platform audit export; backup/restore exercises; incident playbooks and detection metrics. Public SOC 2 or PCI badges should not be treated as certification without attestation documents and scope.

Evidence: docs/security/pentest-scope.md; docs/runbooks/backup-restore.md; https://www.tazdan.com/trust

## 12. Scalability and operational evidence

The test suite includes ledger, concurrency, balance-mutation, financial-flow, auth and AML tests. Bulk stress tooling can seed large databases directly; that tests storage volume, not real end-user payment throughput. The latest saved enterprise run (22 September 2026) reports 153,333 requests and peak 899 RPS on one host, but zero financial writes, 1.645% technical errors and a FAIL result. It is evidence of bottlenecks, not evidence of production capacity or 5,000 simultaneous paying customers.

Evidence: server/src/__tests__; server/scripts/stress-test.ts; server/stress-results/enterprise-2026-09-22T15-06-40-964Z.md

|Readiness test|Gate|
|---|---|
|Money correctness|All debit, hold, release, refund and FX paths reconcile under concurrent load|
|Partner faults|Duplicate, late, out-of-order and missing webhooks recover idempotently|
|Availability|Document RTO/RPO, restore from backup, exercise failover|
|Scale|Financial-write load test with real DB, queues and partner simulators|

Evidence: PROPOSAL; server/stress-results/enterprise-2026-09-22T15-06-40-964Z.md

## 13. Public product claims vs technical reality

The site responsibly labels the platform pre-launch and cards planned, but other pages present quantitative performance, partner and security claims without reviewable support in the repository. The following table is a claim audit, not an allegation about intent. Contracts, production telemetry or attestation could change the classification.

Evidence: https://www.tazdan.com/; https://www.tazdan.com/features; https://www.tazdan.com/about; https://www.tazdan.com/partners; https://www.tazdan.com/trust

|Public claim|Classification|Evidence / needed proof|
|---|---|---|
|62 models / ~287 endpoints|Substantially supported as static code counts|Review counts 62 models and 288 mounted declarations, including core; no live endpoint proof|
|Double-entry with reconciliation|Substantially supported|Ledger and jobs exist; full path coverage needs test|
|Cards for spending|Planned / issuer dependent|Mock issuer; production feature gate off|
|International transfer availability|Partner and regulatory dependent|No complete corridor payout flow verified|
|Business bulk pay / team / webhooks|Frontend only / partial|Mobile calls /business/*; no mounted server router|
|Banxa / Crypto.com / Visa|Not verified as contracted integrations|Website names; no signed contracts or matching live adapters reviewed|
|<2s settlement; 99.98% uptime|Not evidenced|No production telemetry or SLA reviewed|
|KMS means server cannot read seed|Contradicted by code design|getMasterMnemonic decrypts seed within server process|
|SOC 2 / PCI badges|Not verified|Attestation/certificate and scope not reviewed|
|Published reserves / bug bounty|Not evidenced|No independent attestation or programme evidence reviewed|

Evidence: https://www.tazdan.com/features; https://www.tazdan.com/about; https://www.tazdan.com/partners; https://www.tazdan.com/trust; server/src/services/wallet/masterSeed.service.ts; server/src/services/cardIssuer/index.ts; server/src/index.ts

## 14. Market, customers and competition

Libya's 2025 population is about 7.46 million in the World Bank series. IMF reporting describes growing electronic payments alongside cash hoarding, foreign-exchange restrictions and banking trust challenges. These facts support investigating a Libya-first opportunity; they do not establish addressable transaction value or Tazdan market share. Recent, reliable official bilateral remittance data were not verified for this review.

Evidence: https://data.worldbank.org/country/libya; https://www.imf.org/en/publications/cr/issues/2025/06/25/libya-2025-article-iv-consultation-press-release-and-staff-report-568035

For investment screening, use a bottom-up sensitivity instead of a false-precision TAM: eligible active users × monthly transactions × average value gives payment volume; priced volume × net take rate gives revenue. A corridor SAM must be limited by licence, bank and payout coverage, liquidity and acquisition capacity. SOM is the fraction the distribution plan can actually win. All numerical market sizes beyond the population baseline in this report are assumptions.

Evidence: ASSUMPTION; World Bank population baseline

|Alternative|Typical edge|Tazdan hurdle|
|---|---|---|
|Bank / exchange house|Local trust and cash access|Legal integration, transparent cost and reliable fulfilment|
|Wise / Revolut|Mature UX and global rails|Serve legally reachable local corridors they do not cover|
|WU / MoneyGram|Cash payout networks|Compete on route economics and visibility, not claims alone|
|Informal / crypto P2P|Access and sometimes speed|Demonstrate lawful, safe and fairly priced alternative|

Evidence: PROPOSAL; competitive comparison is conceptual

## 15. Revenue architecture and unit economics

Potential revenue includes disclosed FX spread, remittance and payout fees, eligible domestic-transfer fees, digital-asset conversion, P2P fees, deposit/withdrawal fees, card programme economics through an issuer, business subscriptions, merchant acceptance, bulk payout, API and white-label fees. None should be counted as current earned revenue without transaction records and partner statements. Some streams compete: a cheaper all-in quote may require lower spread.

Evidence: PROPOSAL; server/prisma/schema.prisma; server/src/services/fee/feeCollector.service.ts

**Revenue and cost waterfall**
Payment volume → Fee + FX spread → Partner + bank cost → Compliance + fraud → Support → Contribution

|Illustrative transaction|Gross revenue|Variable cost|Contribution|
|---|---|---|---|
|LYD 1,000 internal|LYD 3 fee|LYD 1.5 fraud/support/processing|LYD 1.5 (50%)|
|GBP 1,000 outbound|LYD 240 fee + spread|LYD 204 partner/bank/compliance/fraud/support|LYD 36 (15%)|
|USD 100 asset conversion|USD 1.00|USD 0.80 liquidity/chain/compliance/support|USD 0.20 (20%)|

Evidence: ASSUMPTION; examples are not tariffs or achieved margins

The outbound example assumes LYD 180 FX spread plus LYD 60 fixed fee; LYD 90 payout, 30 banking, 30 settlement partner, 18 compliance, 24 fraud allowance and 12 support. The resulting LYD 36 contribution precedes fixed salaries, technology, legal, licences, treasury capital and losses. Pilot pricing must be validated with written partner schedules and measured fraud and support cost.

Evidence: ASSUMPTION

## 16. Financial scenarios and capital

The model on the following pages is illustrative, not guidance or a valuation. Annual transaction volume equals monthly active users × transactions per active user per month × average transaction value × 12. Revenue equals volume × blended take rate; gross profit equals revenue × gross margin; EBITDA equals gross profit minus operating expense. Net income is shown after an illustrative tax/depreciation allowance and should not be interpreted as jurisdiction-specific tax advice.

Evidence: ASSUMPTION

A lean pilot should fund legal review, one licensed corridor, partner integration, ledger assurance, compliance staff and prefunding. Multi-corridor expansion adds payout float, security and operational redundancy. The investment requirement is best staged against evidence gates: contract, licence, successful settlement, reconciliation, retention, loss rate and contribution margin. No partner contract, live revenue or committed liquidity facility was verified.

Evidence: ASSUMPTION; https://www.tazdan.com/trust

## 17. Technology asset, rebuild cost and gaps

An acquirer obtains source, mobile and web interfaces, a broad Prisma domain model, ledger and reconciliation logic, FX pricing, provider abstractions, crypto custody code, admin tooling, tests and operational runbooks. Value depends on clean title to IP, reproducible deployment, audited controls, maintainability and signed integrations. Replacement cost is not enterprise value: the current code still carries integration and regulatory risk.

Evidence: server/src; mobile/app; client/src; server/prisma/schema.prisma; docs/runbooks

|Rebuild scenario|Indicative cost|What it includes|
|---|---|---|
|Low|USD 1.5-2.5m|Lean engineering replica; limited assurance and partner work|
|Realistic|USD 3-6m|Product, ledger, security, QA, compliance engineering, ops|
|Institutional|USD 7-12m|Independent assurance, resilient infra, multiple regulated integrations|

Evidence: ASSUMPTION; includes design, mobile, web, backend, database, ledger, payments, blockchain, DevOps, QA, compliance and management

The decisive gaps are legal route approval; contracted collection and payout; a real card issuer; real off-ramp; live custody policies; business API implementation; consistent ledger coverage; partner-grade reconciliation; evidence of production security, support, disaster recovery and financial reporting. Product polish ranks below these launch conditions.

Evidence: server/src/index.ts; server/src/services/offramp/index.ts; server/src/services/cardIssuer/index.ts; mobile/src/services/business.ts; docs/LEDGER_COVERAGE_AUDIT.md

## 18. Investment thesis, roadmap and risk

The investment case is conditional: a differentiated Arabic-first interface and accounting core could earn a position in legally accessible Libya-linked money flows, but only if the company secures licensed partners, reliable liquidity, disciplined operations and trusted customer support. Defensibility may develop from local distribution, partner integrations, compliance know-how and better corridor data; none is proven as a moat by source code alone. Strategic buyers could include a licensed PSP, bank, remittance network or regional wallet, subject to diligence.

Evidence: PROPOSAL; repository review; IMF Libya 2025 Article IV

**Milestone sequence**
Legal scope → One partner corridor → Capped pilot → Daily close → Measured unit margin → Scale decision

|Horizon|Priority milestone|Evidence gate|
|---|---|---|
|90 days|Legal corridor map, contracts, ledger gap closure, rate-source monitoring|Signed scope and clean money-path tests|
|6 months|Sandbox and capped pilot with one payout partner|Daily close and real settlement match|
|12 months|Regulated launch in first corridor; business API MVP|Loss, latency, compliance and retention targets|
|24 months|Additional corridors and optional cards|Unit economics by route and issuer contract|
|5 years|Regional partner platform if pilot economics hold|Audited scale and capital discipline|

Evidence: PROPOSAL

The leading failure modes are regulatory refusal, bank or liquidity withdrawal, sanctions exposure, fraud and cyber loss, ledger divergence, card or payout partner failure, political instability and insufficient capital. The risk register quantifies these qualitatively because no production loss history or signed risk transfer was reviewed.

Evidence: PROPOSAL

## 19. Jurisdiction and licence options

Choose incorporation, regulated activity and customer corridor separately. A company can hold IP in one place while a licensed payment institution or contracted operator executes payments elsewhere. No island registration, virtual-asset permission or offshore certificate automatically authorises LYD collection in Libya, UK money remittance or EU payout. For a UK corridor, the FCA states that firms carrying on payment services in the UK normally require authorisation or registration unless an exemption applies.

Evidence: https://www.fca.org.uk/firms/payment-services-regulations-e-money-regulations; PROPOSAL

|Jurisdiction|Relevant route|Assessment for Tazdan|
|---|---|---|
|St Kitts & Nevis|Money Services Business Act covers money transmission; Virtual Asset Act and 2026 rules cover digital assets.|Plausible operating candidate, subject to licence scope, banking, substance and destination-country permissions.|
|British Virgin Islands|FSC VASP registration for virtual-asset services; custody/exchange controls.|Credible digital-asset or holding candidate; VASP registration does not replace fiat remittance authority.|
|Bermuda|BMA test, modified and full digital-asset licences; includes digital-asset payment service.|Clearer institutional regime; higher compliance substance and cost; still needs destination permissions.|
|Cayman Islands|CIMA licence for custody/trading platform since April 2025; other VASP registration.|Potential holding or digital-asset base; not a low-control shortcut for payments.|
|Seychelles|FSA VASP Act 2024; Seychelles IBC still needs licence for virtual-asset services.|Potential specialist VASP base; verify bankability and partner acceptance.|
|Mauritius|FSC virtual-asset licence classes under 2021 Act.|Non-Caribbean comparison with defined categories; assess substance and fiat payments separately.|
|Mohéli / Mwali|Comoros central bank says island-issued offshore financial licences are unauthorised; government warned of MISA and non-official crypto/FX licences.|Reject as a financial-licence route unless Union-level regulator supplies direct written confirmation.|

Evidence: Official regulator sources J1-J6; full URLs in Appendix H

Decision sequence: obtain Libya-specific legal scope and bank and payout commitments for one corridor; then compare St Kitts & Nevis, BVI and Bermuda by exact licence and cost. Form an IP holding company only for a clear tax or ownership need. Confirm regulator and partner acceptance in writing.

Evidence: PROPOSAL; regulator sources in table

## 20. Technology and executed-project valuation

Three different values must not be confused. Replacement cost is what a competent buyer would spend to reproduce comparable software. As-is technology asset value is an indicative price for acquiring the current code and documentation, assuming clean IP title and a usable handover. Executed-project enterprise value is a later operating-company value after licences, partners, customer adoption, audited settlements and recurring revenue are established. The figures below are scenario estimates, not an appraisal or offer.

Evidence: ASSUMPTION; server/src; mobile/app; client/src; docs

|Value lens|Indicative USD range|Basis and milestone|
|---|---|---|
|As-is technology asset|$0.8m-$2.5m|Discounted from $3m-$6m realistic rebuild for missing integrations, assurance and transfer work.|
|One licensed corridor|$4m-$15m enterprise value|Conditional on $2m-$5m annualised revenue, positive contribution, contracts and audited close; 2-3x revenue assumption.|
|Multi-corridor execution|$30m-$150m enterprise value|Conditional on $15m-$30m revenue with durable margin, or later $8m-$12m EBITDA at 8-12x; not current value.|

Evidence: ASSUMPTION: valuation sensitivities, not observed transactions or market comparables

The as-is bridge is $3m-$6m realistic rebuild × roughly 25%-45% transferability/assurance factor, rounded to $0.8m-$2.5m. Operating value already includes the technology. Derive equity value through excess corporate cash, debt and debt-like obligations, then ownership dilution. Reconcile customer liabilities with their matching safeguarded assets; customer funds are not corporate cash. Model required regulatory capital and prefunding separately. If approvals or partner economics fail, the executed range may never be reached.

Evidence: ASSUMPTION

### Path to a $20m-$25m operating value

Treat $20m-$25m as a future enterprise-value target. At an assumed 8-10x sustainable annual EBITDA, it requires about $2.5m EBITDA, plus credible growth, clean accounts and acceptable country, banking and execution risk. The multiple is a negotiating assumption, not a market appraisal. The present code review does not establish this valuation. The existing Base forecast loses $1.68m EBITDA at Y3 and $0.50m at Y5, so reaching the target requires a different cost and revenue mix.

Evidence: ASSUMPTION: valuation target; financial scenarios in this book

Recommended commercial focus: sell ledger, reconciliation and Arabic operations software to regulated institutions; charge businesses for payroll, supplier-payment approvals and reporting; execute one contracted payment corridor through licensed partners. Start with two paid pilots, then 2-4 institution clients and 200-500 paid businesses before pursuing the full 12-36-month target. Deployment fees should fund implementation and are excluded from recurring revenue below. No signed customers or prices were verified.

Evidence: PROPOSAL; server/src/services/ledger; mobile/src/services/business.ts; server/src/index.ts

|Revenue stream|Commercial target|Revenue USD m|Contribution USD m|
|---|---|---|---|
|Institution software|10 clients × $120k/year; 80% contribution|1.20|0.96|
|Business subscriptions|3,000 firms × $75/month; 70% contribution|2.70|1.89|
|Payment / FX fees|$45m/month volume; 0.90% revenue; 0.45% direct cost|4.86|2.43|
|Annual total|Customer principal and pass-through partner fees excluded|8.76|5.28|

Evidence: ASSUMPTION: independent target operating model; not additive to the existing forecasts

Annual fixed operating expense is assumed at $2.80m: people $1.40m, infrastructure and security $0.35m, legal and compliance $0.35m, sales and marketing $0.40m, and other overhead $0.30m. Stream contribution already deducts variable delivery costs; do not charge those twice. Result: $5.28m contribution minus $2.80m fixed cost = $2.48m EBITDA. At 8-10x, implied enterprise value is $19.84m-$24.80m. Validate staff costs, revenue recognition, taxes, capex and liquidity funding before treating EBITDA as net profit or free cash flow.

Evidence: ASSUMPTION; editable workbook: Valuation target

|Annual EBITDA USD m|Value at 6x|Value at 8x|Value at 10x|
|---|---|---|---|
|1.50|$9.00m|$12.00m|$15.00m|
|2.48|$14.88m|$19.84m|$24.80m|
|3.00|$18.00m|$24.00m|$30.00m|

Evidence: ASSUMPTION: buyer multiple sensitivity; no comparable transaction is claimed

### Changes that can earn the valuation

|Priority|Deliver|Commercial evidence|
|---|---|---|
|1. Paid institution software|Package ledger, daily close, Arabic admin and audit export with deployment, support and service levels.|Two paid design partners; annual minimum fees and implementation fees collected.|
|2. Business product|Complete /business APIs, KYB, roles, dual approvals, idempotent batches, invoices and reconciliation exports.|Start with one repeat-use segment; paid pilots and measured retention before broad rollout.|
|3. Profitable corridor|Contract collection and payout prices, executable FX quotes, expiry, cost floors and exposure limits.|Each settled route earns positive contribution after fraud, support and funding cost.|
|4. Production assurance|Complete money-path ledger coverage, real payout, signer isolation, recovery and security review.|Independent review and reconciled pilot settlements; stress tests include actual financial writes.|
|5. Distribution and legal scope|Use licensed banks or PSPs with written corridor responsibilities and a fallback partner.|Collectible signed distribution contracts and approved scope; offshore incorporation alone adds no payment authority.|
|6. Transferable company|Document IP assignments, dependency licences, repeatable deployment and partner concentration.|Clean diligence room, collected revenue and ownership records; no licence or partner badges without evidence.|

Evidence: PROPOSAL; implementation gaps identified in chapters 3, 6, 7, 11, 12 and 17

### Profit conditions and stopping rules

No plan, licence or contract guarantees profit. Collectible minimum commitments, fully costed prices and staged hiring reduce uncertainty. EBITDA differs from net profit: Remitly's first full year of GAAP profitability in 2025 produced $67.9m net income on approximately $1.6bn revenue.

Evidence: https://ir.remitly.com/news-releases/news-release-details/remitly-reports-fourth-quarter-and-full-year-2025-results-above

|Gate|Planning threshold|Action if missed|
|---|---|---|
|Fixed-cost coverage|Collectible recurring contribution ≥ 1.25x cash fixed costs before major hiring.|Use staged hiring and paid implementation retainers; the target model's 1.02x subscription coverage is too thin.|
|Unit margin|Positive settled contribution including provider fees, fraud, FX, support and funding.|Raise price, change partner or suspend the route; do not subsidise negative margin for volume.|
|Acquisition and retention|CAC payback ≤ 6 months on observed contribution; enterprise retention ≥ 95% annually.|Stop broad paid acquisition until repeat use and collected margin justify it.|
|Operational cash|Daily reconciliation and 12-18 months corporate runway; prefunding and regulatory capital financed separately.|Cap volume or pause releases; safeguarded customer funds do not finance operating losses.|
|Earnings quality|Paid invoices, realisable FX conversion, cash-flow statements and six months positive operations; top client < 20% revenue target.|Use a lower valuation and delay expansion until revenue collection and concentration improve.|

Evidence: ASSUMPTION: management targets, not statutory thresholds or profit guarantees

Assumed stress: half the sales targets with unchanged fixed cost produce a $0.16m EBITDA loss. Fees of 0.60% against 0.45% direct cost leave $0.86m EBITDA. Minimum contracts retain default and renewal risk; count cash collected, not letters of intent.

Evidence: 

## Appendices

Model, enum, route, mobile and financial inventories are generated by build_tazdan_manifesto.py from the reviewed repository.
