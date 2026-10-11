# AI automation

An AI control layer for staff, built on the Anthropic API (`@anthropic-ai/sdk`, model `claude-opus-5` by default, `AI_MODEL` to change). Code: `server/src/services/ai/`; endpoints `/api/cockpit/ai/*`; UI: Cockpit → Assistant, plus draft buttons on compliance cases and support escalations.

## Levels (`AI_LEVEL`)

| Level | What it allows |
|---|---|
| `OFF` | Nothing. **Default in production** until a data-processing agreement is in place. |
| `OBSERVE` | Answer staff questions from live platform data. |
| `ASSIST` | `OBSERVE` plus drafts — compliance case summaries and support replies — that a person must accept. Default outside production. |

There is **no automate level**: the assistant cannot move money, change a status, send a message or approve anything. That is deliberate.

## How a question is answered

1. The operator's permissions select which read-only tools are offered (13 tools: platform overview, record search, customer profile, remittance transfer, compliance case, compliance queue, treasury positions, reconciliation exceptions, provider status, FX rates, risk rules, support context, control switches). A tool outside the operator's role is never offered; a call to one is refused without running.
2. The model calls tools; results are trimmed and masked (emails, phone numbers and account numbers partially hidden; no secrets, hashes or keys are ever read).
3. The system prompt requires answers only from tool results, exact figures with their source record, plain language, no actions, confidentiality, and no tipping off.
4. Requests use adaptive thinking and the server-side refusal fallback (`fallbacks: "default"`); at most 8 tool rounds.

## Drafts

- **Case summary** — facts, risk indicators in plain words, gaps, one suggested next step. Accepting it (needs `compliance.case.manage`) adds it to the case file as an AI-authored note marked as reviewed by staff.
- **Support reply** — in the customer's language, only from the customer's context, never mentioning checks or internal cases, with `[agent: confirm …]` placeholders where facts are missing. The agent edits and sends it; sending records whether it went as drafted or edited.

The requester may always discard their own draft.

## Audit

Every request is an `AiInteraction` row: operator, model actually used, question or instruction, every tool call with its input and the records it touched, output, token usage, refusal category if any, and for drafts the approval status, approver and outcome (`ACCEPTED_AS_DRAFTED`, `ACCEPTED_EDITED`, `REJECTED: …`). Cockpit → Assistant → AI activity log shows operators their own activity and auditors everyone's.

## Controls

Per-staff rate limit (40 requests per 10 minutes, `AI_RATE_PER_10MIN`); permission `ai.use` for the assistant, plus the domain permission for each draft type; provider errors are mapped to clear messages (rate limit, credentials, unavailable).

## Before enabling in production

Data-processing agreement with Anthropic; decide the level; set `ANTHROPIC_API_KEY`; brief staff that drafts are suggestions they own once accepted.

## Tests

`ai.assistant.test.ts` (client mocked): only permitted tools offered; a denied tool never runs and the denial is logged; every call recorded; drafts need the right permission and can be decided once; the OFF switch blocks requests before any call.

## Forecasting

Not AI: statistical projections (Holt linear smoothing, ~80% intervals) on the Forecasts page, hidden until a series has seven days of activity. See [audit/CHANGE_LEDGER.md](audit/CHANGE_LEDGER.md) CL-36.
