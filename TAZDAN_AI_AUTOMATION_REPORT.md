# Tazdan — AI automation report

## Summary

An AI control layer was added for staff with **three AI functions** — an operations assistant over live data, a compliance case summary draft and a support reply draft — and **zero autonomous actions**. It uses the Anthropic API (`claude-opus-5` default) with adaptive thinking and server-side refusal fallback, 13 read-only tools scoped to the operator's permissions, and a complete audit trail. It is **off in production by default**. Details: [docs/AI_AUTOMATION.md](docs/AI_AUTOMATION.md).

## Levels

| Level | Allowed |
|---|---|
| OFF (production default) | nothing |
| OBSERVE | questions answered from tool results |
| ASSIST | plus drafts that a person must accept |
| (no AUTOMATE) | the AI never moves money, changes state or sends anything |

## Safeguards

- Tools are read-only and offered only if the operator's role already allows that data; denied tool calls never run and are logged.
- Personal data masked in tool results; no secrets ever read.
- Answers must cite records; no invented figures; no tipping off.
- Drafts take effect only when a person with the domain permission accepts them (case note) or sends them (support reply); outcome recorded as drafted, edited or rejected.
- Per-staff rate limit; provider errors surfaced clearly.
- Every request stored in `AiInteraction` (operator, model, data read, output, usage, decision).

## Verification

`ai.assistant.test.ts` (4 tests; client mocked): tool scoping, denial without execution, audit trail, acceptance rules and single decision, OFF switch.

## Before production use

Data-processing agreement with Anthropic; choose OBSERVE or ASSIST; set `ANTHROPIC_API_KEY`; staff guidance that accepted drafts are their responsibility.

## Not AI

Forecasts (Holt smoothing with intervals) and the risk engine are deterministic.
