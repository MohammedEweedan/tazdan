# Turn Tazdan technology into revenue and founder liquidity

17 October 2026 · Internal commercial plan · USD throughout

## The decision

**Updated after the founder's replies on 17 October:** prioritise qualifying the already-interested individual investors and testing a clearly disclosed primary/secondary transaction. The founder describes wealthy individuals, state leaders and militia leaders; the $18m proposal has not been presented to them. These are preliminary funding leads, not institutional customer orders, strategic acquirers or accepted offers. Use the [private-investor deal brief](TAZDAN_PRIVATE_INVESTOR_DEAL_BRIEF_2026_10_17.md) for the next discussions.

In parallel, sell a narrow payment-operations product to institutions that already handle money. Paid customer results can support the investment case and a later strategic sale. Continue the broader financial-services vision when its partners, permissions and economics are supported by evidence.

The proposed product is **Tazdan Payment Operations**: reconciliation exceptions, treasury visibility, approval workflows and audit evidence in a private deployment. The first buyer purchases a better daily close and a traceable exception process. This is a proposed commercial package assembled from existing code; it is not yet a certified, deployed enterprise product.

If the requirement is $8m personally in the near term, the relevant route is an agreed purchase of your shares. Subscription sales can build the business that supports that price. The reported investors have not yet been asked to accept $8m founder liquidity or the $18m total package; their willingness, funding capacity and eligibility for this transaction remain to be established.

## What we can substantiate

The repository contains a reconciliation service, staff operations console, treasury services, balanced ledgers, business payout approvals, scoped API keys and signed webhook delivery. The latest local validation recorded 48 passing server suites and 370 passing tests, including database tests. These results establish a tested local code baseline, not production certification or buyer acceptance. See the [validation record](../docs/audit/FINANCIAL_HARDENING_VALIDATION_2026_10_17.md).

| Commercial fact | Current evidence status |
| --- | --- |
| Code and IP ownership | Founder confirms ownership of all code/IP. Assemble the ownership record and identify whether rights are held personally or by a company for transaction diligence; third-party dependencies retain their own licence terms |
| Interested investors | Founder reports interested wealthy individuals, including state and militia leaders; no identities, written offers, investment vehicles or funding evidence reviewed |
| Price acceptance | Founder confirms the $18m package has not been disclosed to them; no accepted valuation or secondary amount is established |
| CBL/local access | Founder reports an individual with strong CBL/other relationships who can assist launch dealings; no formal authorisation, institutional commitment or launch timetable is evidenced by that statement |
| Customers, revenue and live bank/provider contracts | Not established by the replies; keep unverified until records are provided |

Record the founder-confirmed ownership as a positive fact, while completing the ordinary documentary diligence a buyer will require. Treat regulatory relationships as a potential source of introductions and procedural guidance. Formal permissions, partner contracts and transaction-specific banking acceptance need their own records. Existing historical marketing claims must not be used as substitutes for contracts or operating evidence.

For this investor group, identity, beneficial ownership, documented wealth/funds and the intended funding account are material to the platform's ability to obtain banking partners. Obtain transaction-specific legal/compliance review before accepting funds or issuing rights. No investor has been screened or found prohibited in this work. See the private-investor brief for the process and primary-source context.

## Offer and pricing to test

These are opening price hypotheses, not observed market prices, customer commitments or a revenue forecast. Quote only after checking the buyer's problem, budget, data and deployment requirements.

| Purchase | Proposed price | What the buyer receives | Collection milestone |
| --- | ---: | --- | --- |
| Paid pilot | $25,000 | One institution, one workflow, one agreed external statement format, read-only reconciliation and exception demonstration | $10,000 at signed scope; $15,000 on written acceptance |
| Production rollout | $75,000 | Agreed integration, isolated deployment, access configuration, operator training and acceptance evidence | $30,000 at rollout contract; $30,000 after integration milestone; $15,000 on production acceptance |
| Annual software subscription | $120,000 | Non-exclusive use of the agreed modules, maintenance and bounded support for one deployment | Annual prepayment at service commencement, subject to negotiated procurement terms |

Pilot and rollout charges are separate; no pilot credit is assumed. The first complete twelve months of service plus both accepted projects would produce **$220,000 in company billings**, of which **$120,000 is annual recurring revenue**. Five such customers would produce $600,000 ARR and up to $1.1m in billings over their respective complete first service years. Neither figure is a calendar-year forecast or profit. Do not count implementation fees as ARR, deposits as earned revenue, or invoices as collected cash. Recognise revenue under the company's accounting policy as obligations are delivered.

Hosting, third-party licences, taxes, unusual data migration and continuous on-call support need explicit prices and limits. Customer-owned infrastructure is the starting assumption. Do not offer unlimited custom development or a perpetual exclusive licence at subscription prices. Offer source escrow only with defined release conditions and sufficient IP rights.

Price from the buyer's verified benefit: hours saved × fully loaded staff cost, plus measurable reductions in handling/rework costs. Measure the before/after on the same process. Do not promise recovered funds or prevented losses without evidence. If a $120,000 annual charge cannot be justified by that buyer's budget and benefit, narrow the scope, test a different price, or qualify a different buyer.

## Delivery work that earns the invoice

| Component | Current evidence | Work needed for the first customer |
| --- | --- | --- |
| Reconciliation exceptions | Provider-statement abstraction and internal payout comparisons in `server/src/services/reconciliation/recon.service.ts` | Build the agreed bank/provider adapter, normalisation, exact currency-specific matching and repeatable import; a general CSV/bank importer is not established |
| Operations and audit | Staff routes in `server/src/routes/cockpit.ts`; reconciliation, treasury and approval workflows | Agree role matrix and evidence exports; validate every promised action against buyer fixtures |
| Treasury visibility | Pool/reference controls and reconciliation services | Map the buyer's accounts, currencies, legal entity, cut-off times and authoritative balance sources |
| Business approvals/API | [Business platform documentation](../docs/BUSINESS.md) and tests | Existing business balances use the owner's wallets; adapt to the buyer's enterprise account model before promising enterprise payouts |
| Deployment and assurance | Locally tested application and release-evidence gates | Isolated customer environment, backups/restore, retention, security review, load envelope, support ownership and buyer acceptance |

Start with a **single institution and single legal entity per isolated deployment**. Cross-entity accounting and shared multi-tenant hosting are not proven enterprise capabilities. Do not enable live custody, FX, card issuance or customer payment execution as part of the read-only pilot. Software provision still requires review of outsourcing, data, security and any regulated activity actually performed; it is not a universal licensing exemption.

Use the [paid pilot scope](TAZDAN_PAID_PILOT_OFFER_2026_10_17.md) to agree inputs, deliverables and acceptance before custom work. A six-week delivery target starts after contract, deposit, environment access and usable sample data; enterprise procurement may take longer than that.

## Ninety-day commercial sequence

**Immediate priority:** during the next two weeks, qualify each reported investor and request a written response to the disclosed transaction, once the counterparty and funding route are suitable. Use the [investor brief](TAZDAN_PRIVATE_INVESTOR_DEAL_BRIEF_2026_10_17.md); do not wait for a new SaaS business to exist before testing existing interest.

The sequence below is the parallel institutional-software sales track, not a prerequisite for every investor discussion. Targets are management goals. No conversion rate or closing probability has been established.

| Period | Required work | Evidence to collect | Decision |
| --- | --- | --- | --- |
| Days 1–7 | Document founder-confirmed IP ownership and the rights-holding entity; prepare synthetic demo; cost the pilot; complete buyer brief and data-room index | Ownership/contributor record, dependency licence inventory, repeatable demo, delivery budget and named owner | Align the selling entity's rights with the proposed licence |
| Days 8–30 | Seek 10 discovery meetings from 20 carefully qualified approaches; identify operations owner and budget holder | Current close process, exception volumes, staff hours, incumbent system, purchasing process, redacted sample statement | Seek three qualified problems with a sponsor, accessible data and budget; change the offer if interviews show weak benefit |
| Days 31–60 | Negotiate one paid pilot and collect the deposit; implement only its agreed adapter and workflow | Signed scope, funds received, buyer-approved acceptance fixtures | If there is no paid commitment after a documented sales test, revise buyer/problem/price before expanding the platform |
| Days 61–90 | Deliver the pilot where procurement permits; document results; negotiate rollout and recurring licence | Signed acceptance, final pilot payment, measured outcome, actual delivery cost, separate rollout order | Repeat only if the result and margin justify it; otherwise correct the specific failure |

A missed day-90 sale is evidence to investigate, not proof that enterprise software cannot sell. Do not turn the plan into an open-ended feature build while the buyer question stays unanswered.

The ten-minute demonstration should show a clean reconciliation, an unmatched item, a duplicate record, an amount discrepancy, a traceable operator action and denial of an unauthorised action. Use synthetic data and state which actions are demonstrations versus buyer-ready integrations. Do not expose production secrets or customer data in a sales room.

## Buyer discovery queue

These organisations are **research leads only**, separate from the founder's unnamed interested individuals. None has been contacted through this work; none is represented as interested, dissatisfied or buying Tazdan. Determine whether each is a customer, channel partner, competitor or unsuitable prospect before pitching. Confirm the exact legal entity and current status directly.

| Organisation | Public basis for inclusion | First hypothesis to test | Role to reach |
| --- | --- | --- | --- |
| Albidaya Fintech Company | CBL lists an e-wallet approval with extension through 31 December 2026 | Does its operations team have an unfunded or manual reconciliation problem? | Operations lead and finance lead |
| Mousahamat Digital Payment / RUNPAY | CBL lists an e-wallet approval with extension through 31 December 2026 | Can a read-only exception workflow improve its daily close? | COO or settlement/reconciliation lead |
| Moamalat | CBL lists it as a card issuance/acceptance processor; dates are not supplied in that row | Is there a useful reporting or reconciliation layer alongside its existing processing systems? | Settlement operations and enterprise IT |
| Tadawul | Official contact page; CBL's English directory uses “Tadalul” and shows a 2025 extension date | Could it distribute an operations module, or is it solely a competitor? Verify identity and renewal before relying on status | Partnerships and product/operations |
| Aman Bank | Official website advertises digital banking and transfer services | Does a specific treasury/reconciliation team have an approved integration need? | Operations/treasury sponsor with IT procurement |

Sources: [CBL electronic-payment directory](https://cbl.gov.ly/en/electronic-payment/), [Tadawul contact page](https://tadawul.ly/en/contact-us), [Aman Bank](https://www.aman-bank.com/en). The CBL directory contains entries with expired extension dates despite a “Licensed” label; directory inclusion alone is not verification of a current permission. No contact names or emails have been inferred.

Build the next 15 leads from verified institutions and software distributors that meet the same qualification criteria. A 40–60-customer business would require a broader regional customer base; this seed list does not demonstrate sufficient Libyan demand. Do not extrapolate bank FX volume into software customers or licensing budgets.

### Discovery message — draft, not sent

> Subject: A paid pilot for reconciliation and payment-operations evidence
>
> We are developing Tazdan Payment Operations around an existing financial-operations codebase. We want to test whether a focused deployment could help your team reconcile an agreed statement feed, investigate exceptions and retain approval evidence alongside your current systems.
>
> We propose a scoped, read-only paid pilot using synthetic or approved redacted data. Before proposing terms, we would like a short discussion with the person responsible for daily reconciliation: which exceptions consume time, what data is available, and how a purchase would be approved. We can provide a technical scope and a demonstration with explicit integration and assurance limitations.

Record: institution/legal entity, source URL/date, sponsor, budget owner, problem, baseline cost, data available, incumbent, procurement/security steps, next meeting, quoted price, contract status and cash actually received. Keep a dated reason for every lost opportunity.

## The route from recurring revenue to $8m personally

The following are steady-state sensitivity cases, **not launch projections, current earnings or valuations**. They assume $120,000 annual subscription per customer, 30% direct recurring delivery/support cost and the fixed annual costs below. Fixed costs must include market-rate replacement of the founder, sales, engineering, compliance/legal, security, administration and ordinary maintenance. Setup revenue and setup costs are excluded from this recurring illustration and need a separately profitable project budget. Unproven enterprise delivery and sales costs could be materially higher.

| Active annual customers | Recurring revenue | Direct cost at 30% | Fixed annual cost assumption | Recurring operating profit before tax/interest |
| ---: | ---: | ---: | ---: | ---: |
| 20 | $2,400,000 | $720,000 | $700,000 | $980,000 |
| 40 | $4,800,000 | $1,440,000 | $1,200,000 | $2,160,000 |
| 60 | $7,200,000 | $2,160,000 | $1,700,000 | $3,340,000 |

For arithmetic only, a buyer paying **4× the last row's verified annual recurring operating profit** would imply $13.36m enterprise value. With zero debt, no preference claims, no excess cash adjustment and 60% fully diluted ownership, your gross share would be **$8.016m**, before fees, taxes, escrow or holdbacks. There is no evidence that a buyer will use this multiple, accept these earnings or pay that price. A buyer may use a different earnings measure or multiple.

As limited context, [Acquire.com's January 2026 report](https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/) reports a 3.9× median profit multiple for its confirmed 2024 and 2025 SaaS transactions. Its data is platform-specific and generally concerns businesses below $10m enterprise value. That is not a comparable valuation of Tazdan, and the $13.36m illustration is outside that typical size range. Forecast profit cannot be represented as historical earnings.

Sensitivity matters: at 60 customers and $60,000 annual pricing, with the same 30% direct cost and $1.7m fixed cost, profit falls to $820,000. At the hypothetical 4× multiple and 60% ownership, gross proceeds would be $1.968m. At $120,000 pricing but 50% direct costs, profit would be $1.9m and the corresponding hypothetical gross proceeds $4.56m. The $8m outcome depends on real pricing, retention, cost control and a buyer.

| Your fully diluted share before a full-company sale | Equity purchase price required for $8m gross to you |
| ---: | ---: |
| 100% | $8,000,000 |
| 80% | $10,000,000 |
| 60% | $13,333,333 |
| 50% | $16,000,000 |

Assumes a pro-rata common-equity distribution with no preferences. Personal net cash requires a separate closing funds-flow calculation using actual ownership, debt, investor preferences, taxes, transaction costs and retained/conditional amounts. An $80m gross personal target at 60% ownership would require $133.33m equity value under the same simplified assumptions. That is a substantially larger business outcome.

## A separate process for an earlier strategic sale

A strategic technology sale is a separate route from the reported individual-investor discussions. Run it alongside paid customer discovery if appropriate. A strategic buyer needs its own reason to acquire: verified implementation time saved, a demonstrated product gap, suitable IP, customers it can serve and a credible transition team. Replacement engineering cost alone does not establish an acquisition price.

1. Assemble a rights-clean confidential technology brief and a reproducible demo. Confirm the actual seller, share ownership, contributor assignments, third-party licence obligations and exclusions first.
2. Qualify a small set of banks, processors and software vendors with a specific build-or-buy requirement. Test whether they want a licence, distribution agreement, selected assets or company control. Do not describe research leads as interested buyers.
3. Share detailed code only through agreed diligence access. Request a written indication covering price, percentage/assets, cash at closing, conditional consideration, assumed liabilities, approvals, financing evidence and diligence timetable.
4. Compare **cash payable to you at closing after deductions**. Treat earnouts, future employment, rollover equity and seller financing separately. Negotiate precise indemnity limits and escrow terms; an acquisition does not automatically remove every post-closing obligation.
5. Do not grant broad exclusivity before identifying a credible funded counterparty, a specific scope and a short timetable. A qualified adviser can help run a process once the materials and ownership evidence are ready.

Your earlier $18m proposal for 40% consists of $8m secondary proceeds to you and $10m primary funding to the company. At one price per share it implies $45m post-money/$35m pre-money; for 50% it implies $36m post-money/$26m pre-money. Both still require a buyer who accepts the price, rights and business evidence. A larger percentage does not create buyer demand.

## Where the money legally and economically goes

Software licence and implementation receipts belong to the contracting company. An IP asset sale normally pays the entity that owns the IP. They are not automatically personal proceeds. Personal receipts would arise through an actual sale of your shares, properly approved compensation, lawful distributions from available profits or another documented structure reviewed for the real entities and tax residences.

Keep customer safeguarding balances, settlement prefunding, regulatory capital and operating cash separate. Neither the proposed $10m company funding nor customer money is the source of an undisclosed founder payout. Agree and disclose any secondary sale in the investment documents and closing funds flow. See [Carta's explanation of primary and secondary transactions](https://carta.com/learn/equity/liquidity-events/secondary-transactions/).

## The next investment of effort

Qualify the existing individual investors and seek a written response to the disclosed primary/secondary package. In parallel, finish a repeatable synthetic demo, document the founder-confirmed rights and secure the first paid institutional problem. Build the specific connector and acceptance evidence that contract requires. Personal proceeds require an agreed share purchase or distributable business earnings; neither informal interest nor relationships establish a closing price.
