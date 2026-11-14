# Tazdan assessment work log

Scope: rigorous current implementation and launch-readiness assessment; monetization, market and customer acquisition; 36-month conditional forecast; capital needs; current and milestone valuation; primary/secondary sale of 33%; merger option. No application changes, production access, customer messaging or launch authorized or needed.

Confirmed by founder in this chat, 10 November 2026:
- No paying customers, revenue, or signed commercial/licensing partners.
- CBL official has given a verbal assurance about licensing; no formal approval supplied.
- No team and no reported current monthly cash costs; founder time unpaid.
- Practically zero available cash.
- Single-digit total interested audience/merchant/investor prospects (not verified active users).
- Libyan company incorporated two years ago; ownership, IP assignment, accounts and liabilities unverified.
- Another startup has approached for a merger; terms and assets pending clarification.
- Merger clarification: partner offers a team, an investor relationship in San Francisco and CBL official relationships. No paid customers, licence, bank contract, committed capital or written equity terms have been supplied. Do not capitalize an introduction as cash.
- Proposed transaction: $9m total for 33% after closing; $5m company primary, $4m founder secondary. At same share price, 100% founder initially, no other claims: $27.2727m post / $22.2727m pre; investor 18.3333% primary + 14.6667% secondary.

Plan:
1. Read current source and verify commercially relevant features, provider modes, revenue controls and deployment limits.
2. Run appropriate checks in an isolated test environment; document coverage and exclusions.
3. Research primary CBL/World Bank and competitor sources; avoid duplicate payment counts and gross-volume-as-revenue errors.
4. Build one monthly forecast driven by a Downside/Base/Upside selector with explicit acquisition, retention, transaction and subscription economics, staffing, launch delay and liquidity.
5. Independently verify all scenarios and input sensitivities; keep scenario comparison in PDF with evaluation date, not a hidden parallel spreadsheet build.
6. Triangulate an uncertain current negotiation valuation, separately from code replacement cost and future conditional enterprise value. Model 33% mixed primary/secondary arithmetic.
7. Deliver reviewed PDF, detailed evidence-backed Markdown assessment and editable XLSX with verified calculations and renders.

Skills: spreadsheet and PDF 26.1105.12137 read. Spreadsheet must use bundled @oai/artifact-tool; no openpyxl authoring. Marker required once before each artifact type's first create command. All sheets rendered and inspected; PDFs rendered and inspected. No subagent delegation authorized.

Runtime: /Users/moe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node; node_modules adjacent at node/node_modules. Python at dependencies/python/bin/python3. System pdftoppm/pdfinfo available. No postgres utilities found on PATH or brew Cellar search yet.
Postgres found through process inventory: /Applications/Postgres.app/Contents/Versions/18/bin. Existing user database is port 5432 and MUST NOT be accessed. Use a new initdb cluster, random loopback port, separate test DB and shutdown trap in run_checks.sh.

Existing docs are evidence leads, not current verified assertions. Old data-room claims 151 tests and crypto readiness are stale against newer docs (406 tests Nov 8 and crypto disabled). Must inspect source and current checks. Existing replacement effort 72-122 engineer-months is author judgement, not measured market value. Previous chat valuations were provisional estimates and cannot serve as comparables.

Completed 10 November 2026:
- Isolated PostgreSQL18 cluster created, all 61 migrations applied, 53 suites / 415 tests passed with none skipped, cluster stopped. Server/client/mobile types passed. Existing databases and production untouched.
- 18 feature areas assessed; evidence paths and SHA-256 hashes saved. Current source includes sandbox/stub providers; no national QR integration, paid billing, live bank contract or production external remittance evidence established.
- Thirteen source entries documented, including current CBL, LYPay, Dafa, World Bank and Carta primary sources. National transaction/FX totals are not treated as unique users or addressable app revenue. No observed priced local equity comparable supplied or established.
- One editable 36-month monthly workbook, one active scenario selector and six sheets. All three case outputs match independent calculations; later-year input, missing/blank input and zero funding checks passed. Exported cached values independently read and matched; no error cells or external workbook links. All sheets visually reviewed, including late ranges and complete chart. Native Excel application not tested.
- All forecast drivers are explicit unquoted hypotheses. Base Y3: 3,111 transacting consumers, 245 businesses, 4 institutions, $229,355 management net revenue, ($340,920) operating result. Base funding including 20% contingency: $556,553 at 18 months, $1,265,477 at 36 months. Unknown regulatory capital, tax and other specified costs excluded, not assumed zero obligations.
- Final low-confidence negotiation view $750k-$1.5m pre-money; concrete test proposal $650k total for 33%, $600k primary/$50k secondary, implying $1.369697m pre-money. No market-clearing price established. $9m/$4m secondary proposal unsupported by present evidence. Merger introductions have no committed cash/licence/customer value evidenced.
- Reviewed 16-page PDF and editable XLSX saved. All PDF pages visually inspected; updated callout spacing/chart inspected again. Eleven primary-source PDF links verified. Source hashes still match reviewed snapshot. See final-verification.json.
- Spreadsheet and PDF artifact markers each run exactly once before first authoring command. PDF chart uses ReportLab vector plotting because bundled matplotlib was unavailable. No application source edits during this assessment.

Final outputs:
- output/pdf/Tazdan_Investment_Assessment_2026-11-10.pdf
- outputs/tazdan-assessment-2026-11-10/Tazdan_Financial_Model_2026-11-10.xlsx
- Detailed Markdown assessment retained alongside the workbook as an additional local record.
