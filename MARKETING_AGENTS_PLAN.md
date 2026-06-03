# tazdan — Autonomous Marketing with Claude Agents

**A plan for using Claude-powered agents to market tazdan and onboard users with minimal human effort — without sounding like a hype machine, and without getting the app store listing pulled.**

Prepared from the shipped product ([PROJECT_BRIEF.md](PROJECT_BRIEF.md)), the revenue model ([REVENUE_ESTIMATE.md](REVENUE_ESTIMATE.md)), and launch constraints ([LAUNCH_READINESS.md](LAUNCH_READINESS.md)). Everything here maps to features that exist; nothing promises what isn't built.

---

## 0. The premise (read this first)

tazdan is **not** a generic crypto app, so it should not be marketed like one. The brief is explicit: against Binance/Wise/Stripe on generic crypto, tazdan loses on price and reach. It **wins** on one thing — **the real parallel-market rate in corridors the giants won't touch** (USD/LYD first, then EGP/NGN/…). The FX spread on that rate is ~60–75% of realistic revenue. So:

> **Everything below sells the *rate* and the *corridor*, not "crypto."** The hero line is "The real rate. Finally." — not "revolutionary." We banned "revolutionary," "game-changer," "to the moon," and every casino-crypto cliché. Trust is the product; the voice is calm, specific, and a little anti-establishment ("built for the markets the banks left behind").

Two hard constraints shape the whole design:

1. **Compliance.** A money app touching LYD is a regulated financial promotion. App stores pull unlicensed crypto listings within weeks. So **no agent ever publishes financial claims, rates as advice, or yield/return promises autonomously.** Agents *draft*; a human *approves* anything outbound until trust + legal sign-off are established. (See §6.)
2. **Anti-spam.** Diaspora communities (Telegram, Reddit, Facebook groups) ban promotional accounts fast. Agents that touch communities are **value-first and human-gated**, never blast bots.

The goal of "autonomous" here is **leverage, not absence of humans**: one operator + a roster of agents should do the work of a 5-person growth team, with the human spending their time on *approvals and judgment*, not production.

---

## 1. The agent roster

A lead **CMO orchestrator** agent delegates to six specialists. Each specialist has a tight contract: **goal · inputs · outputs · approval gate · success metric · how it runs.**

### 1.1 CMO Orchestrator (the lead)
- **Goal:** turn a weekly objective ("grow LYD-corridor signups 20%") into tasks for the specialists, collect their output, and assemble a single review queue for the human.
- **Inputs:** the objective, last week's metrics (from the Analytics agent), the message house (from Positioning).
- **Outputs:** a delegated task list + a consolidated **approval queue** (one place the operator reviews everything).
- **Approval gate:** the human approves the *weekly plan* and every outbound artifact in the queue.
- **Success metric:** week-over-week movement on the one north-star metric (verified signups in the active corridor).
- **Runs as:** a scheduled agent (see §4) that fires weekly, plus on-demand.

### 1.2 Positioning & Messaging agent
- **Goal:** own the **message house** — the canonical, compliance-safe way to describe each feature, per corridor and per audience (in-corridor consumer, diaspora remitter, SME/importer).
- **Inputs:** PROJECT_BRIEF, the approved claims list (§6), feature changelog.
- **Outputs:** a living `messaging.md` — hero lines, proof points, the do/don't word list, and per-corridor angles (LYD: "the 40% gap is not your fault"; EGP/NGN next).
- **Approval gate:** human signs off on the claims list once; the agent then keeps copy *inside* it. Any new claim → human review.
- **Success metric:** zero off-claim statements shipped; copy reuse across the other agents.
- **Runs as:** on-demand; re-runs when the feature set changes.

### 1.3 Content Engine agent
- **Goal:** produce localized, RTL-aware content at volume — short-form video scripts, X/Threads posts, blog explainers, and **app-store / store-listing copy** ([store-listing.md](store-listing.md)).
- **The growth loop unique to tazdan:** the **published parallel rate is itself content.** tazdan already scrapes + publishes the USD/LYD street rate. A daily auto-drafted "Today's real USD/LYD: X (official: Y — a Z% gap)" post is a recurring, organically-shareable, *true* artifact that makes tazdan "the number people quote" (moat #1 in the brief).
- **Inputs:** message house, the live FX rate feed (read-only), feature updates.
- **Outputs:** dated content drafts in EN + AR (RTL-correct), tagged by channel and corridor.
- **Approval gate:** **every** rate post and every claim-bearing post is human-approved before publish (financial promotion). Evergreen educational drafts ("why an official peg lies") get lighter review.
- **Success metric:** reach/saves on rate posts; assisted signups from content UTMs.
- **Runs as:** scheduled daily (rate post) + weekly (long-form), feeding the approval queue.

### 1.4 Community & Diaspora agent
- **Goal:** be genuinely useful in diaspora spaces (Libyan/Egyptian/Nigerian expat Telegram, Reddit, FB groups) — answer "what's the real rate today / how do I send money home and they get the real value" — and *earn* mentions, not spam them.
- **Inputs:** message house, the rate feed, a curated list of communities + their rules.
- **Outputs:** **draft** replies/posts, each with the target community, the rule it respects, and a disclosure line.
- **Approval gate:** **hard human gate on every post.** Nothing auto-publishes to a third-party community — ever. This protects against bans and financial-promo violations. (Optionally start fully read-only: the agent only *surfaces* threads worth a human reply.)
- **Success metric:** referral-tagged signups from community links; sentiment (not volume).
- **Runs as:** scheduled scans + on-demand drafting. **Most conservative agent by design.**

### 1.5 Referral & Claim-Link Growth agent
- **Goal:** instrument and optimize tazdan's two built-in viral loops — **referrals** and **claim links** (send-by-link/email/phone; the recipient claims and signs up). Claim links are the remittance killer loop: every remittance recipient is a new-user funnel.
- **Inputs:** referral + claim-link analytics (read-only), cohort data.
- **Outputs:** experiment proposals ("prompt a claim-link share after a successful sell"), A/B variants of in-app prompts + referral copy, and a read of each result with a next test.
- **Approval gate:** human approves which experiment ships; the agent reads results autonomously and proposes the next test.
- **Success metric:** K-factor (invites/user × conversion), claim-link → activated-account rate.
- **Runs as:** scheduled weekly experiment cycle.

### 1.6 Lifecycle / CRM agent
- **Goal:** onboarding nudges, dormant-user win-back, and **KYB outreach to SMEs/importers** (the highest-revenue-per-user segment, per the brief), via the existing email rail — [server/src/services/email.ts](server/src/services/email.ts) → Resend (per-purpose senders already exist: `hi@`, `txn@`, `noreply@`).
- **Inputs:** lifecycle-stage segments (read-only), message house.
- **Outputs:** drafted lifecycle sequences (EN/AR), segment definitions, send schedule.
- **Approval gate:** human approves each *sequence* once; sends then run on the schedule. New segments/claims → review. Respect unsubscribe + jurisdiction (no unsolicited cold blasts where prohibited).
- **Success metric:** activation rate (signup → first trade), reactivation rate, KYB pipeline created.
- **Runs as:** scheduled; triggered by lifecycle events.

### 1.7 Analytics & Attribution agent (closes the loop)
- **Goal:** read the funnel and tell the other agents what's working, so optimization is data-driven, not vibes.
- **Inputs:** signup/activation/retention/referral metrics, content UTMs, ad spend if any.
- **Outputs:** a weekly scorecard + specific recommendations routed to each agent via the CMO.
- **Approval gate:** none needed (read-only, internal). It informs; it never publishes.
- **Success metric:** forecast accuracy; lift from acted-on recommendations.
- **Runs as:** scheduled weekly, feeding the CMO's next plan.

---

## 2. How the loop fits together

```
        ┌──────────────────────────────────────────────┐
        │           CMO Orchestrator (weekly)            │
        │  objective → delegate → assemble review queue  │
        └───────┬───────────────────────────────┬───────┘
                │ delegates                       │ reads
   ┌────────────┼─────────────┬──────────┐        │
   ▼            ▼             ▼          ▼         ▼
Positioning  Content      Community  Referral   Analytics
  (claims)   (rate posts,  (drafts,  (experiments) (scorecard)
             EN/AR)        gated)      ▲                │
   │            │             │        │                │
   └──── all outbound ────────┴────────┘                │
                │                                        │
                ▼                                        │
        ┌───────────────────┐                            │
        │  HUMAN APPROVAL    │◄───────── recommendations ─┘
        │  QUEUE (operator)  │
        └─────────┬─────────┘
                  ▼
        publish / send / ship experiment
                  │
                  ▼  (events: signups, claims, trades)
        ───────► back to Analytics ───────►
```

The human sits in exactly one place: **the approval queue.** Everything upstream is agent-produced; everything downstream is measured and fed back.

---

## 3. The 30 / 60 / 90-day rollout (autonomy widens as trust builds)

**Days 0–30 — Human-supervised, single corridor (LYD).**
- Stand up Positioning + Content + Analytics only. Lock the claims list with whoever owns legal.
- Content agent drafts the daily real-rate post + 3 evergreen explainers/week. **Human approves 100% of outbound.**
- Lifecycle agent drafts the onboarding + activation sequence; human approves once, then it runs.
- Goal: prove the rate-post loop and the message house. No community posting yet.

**Days 31–60 — Add the growth loops.**
- Turn on Referral & Claim-Link agent (experiments, human-approved to ship; results read autonomously).
- Bring the Community agent online in **read-only** mode (surfaces threads; human writes replies) to learn each community's rules safely.
- Add EGP or NGN as a second corridor once LYD is steady.

**Days 61–90 — Widen autonomy where it's earned.**
- Community agent graduates to *drafting* replies (still hard-gated to publish).
- Evergreen, non-claim content can move to "auto-publish with post-hoc human audit" if the approval queue has been boringly clean for 30 days.
- CMO runs the weekly plan end-to-end; the operator mostly approves and exercises judgment on edge cases.
- **Rate posts and any financial claim stay human-gated indefinitely** — that line never moves without legal sign-off.

---

## 4. How to actually run these (Claude Agent SDK + scheduling)

These agents are Claude agents; there are three complementary ways to operate them, all available in this environment:

- **Claude Agent SDK** — build each specialist as an SDK agent with a tight system prompt (its contract from §1), read-only tools for the data it needs (FX feed, analytics, referral stats), and **write tools that only ever write to the approval queue**, never directly to a publish/send API. This enforces the human gate in code, not just policy.
- **Scheduled agents / cron routines** (the `/schedule` skill) — for the recurring cadences: daily rate-post drafting, weekly CMO planning, weekly experiment cycle, weekly scorecard. A routine wakes the agent, it produces drafts into the queue, done.
- **`/loop`** — for a self-paced operator session ("keep drafting the week's content and refining until the queue is full"), where the model paces its own iterations rather than running on a fixed clock.

**Architecture guardrail:** the *only* component with publish/send credentials is a thin "publisher" the human triggers from the approval queue. Agents produce drafts; they cannot reach Twitter/Telegram/Resend directly. This is what makes "autonomous" safe.

---

## 5. What we are explicitly NOT doing

- **No autonomous publishing of financial claims, rates-as-advice, or any return/yield promise.** Ever, until legal says otherwise — and even then, gated.
- **No spam.** No mass-DMing, no bot-posting into communities, no buying engagement. One ban cascades across app-store trust.
- **No "revolutionary"/casino-crypto voice.** The do-not-use list lives in the message house and the Positioning agent enforces it.
- **No promoting unbuilt features as if shipped** (the brief's standing rule). Claims map to code or they don't ship.
- **No corridor we're not licensed/legally cleared to serve** — agents respect a per-corridor allow-list.

---

## 6. The claims list (the safety backbone)

Before any agent drafts a word, the human + legal owner approve a **claims list**: the exact, defensible statements agents may make, each tied to a shipped feature. Illustrative entries:

| Claim agents MAY make | Backed by |
|---|---|
| "Transact at the real parallel-market USD/LYD rate, published transparently." | scraped LYD rate + adaptive order book, floored at street rate |
| "Send money home; the recipient claims via a link and gets the real value." | claim-link remittance (send-by-link/email/phone + PIN) |
| "Your money is on a double-entry ledger with continuous reconciliation." | conservation-checked ledger + auto-halt on drift |
| "Hold USD/EUR/GBP/AED/LYD… buy & sell BTC/ETH/USDT at live prices with a disclosed spread." | multi-currency wallets + price engine |
| Claims agents must NOT make | Why |
| Any specific return, yield, "investment," or "guaranteed" framing | financial-promotion / securities risk |
| Anything about an unlaunched corridor or unbuilt feature | brief's standing rule; regulatory risk |

The Positioning agent treats this table as law; the human extends it deliberately, never the agent.

---

## 7. The one-paragraph pitch (for the operator)

Point a small roster of Claude agents at one job: **make tazdan the trusted, quoted source for the real rate in the corridors the giants abandoned, and turn every remittance into a new user.** The agents draft everything — the daily real-rate post, the EN/AR content, the lifecycle emails, the referral experiments, the community replies — and route it all to a single approval queue. A human approves and exercises judgment; the agents do the production and read the results. Start fully supervised on the LYD corridor, widen autonomy only where the queue has earned it, and never let an agent publish a financial claim on its own. That's a growth team's output from one operator — calm, compliant, and on-brand.
