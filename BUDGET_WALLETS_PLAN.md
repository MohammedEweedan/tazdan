# Budget Wallets — implementation plan

**What:** named savings goals (e.g. a EUR "Madrid 2026" pot) where a user sets a target + deadline, contributes manually or on a recurring schedule, and optionally **locks** the funds until an unlock date and/or behind a 2FA/email step-up. Money in a budget is set aside from the spendable balance until released.

**Reuses existing infra:** `Wallet.frozen` (set-aside funds), the `RecurringBuy` scheduler pattern ([server/src/services/recurringBuy.service.ts]: `startRecurringBuyScheduler` / `runDueRecurringBuys` / `computeNextRun` / idempotency keys), the ledger service for balanced moves, and the existing step-up auth (`useStepUpAuth` / `/auth/startStepUp`).

---

## Data model (Prisma + migration)

```prisma
model BudgetWallet {
  id            String   @id @default(uuid())
  userId        String
  name          String                 // "Madrid 2026"
  emoji         String?                // optional icon, e.g. "🏖️"
  currency      Currency               // the pot's currency (EUR…)
  balance       Decimal  @default(0) @db.Decimal(20, 8)  // saved so far
  targetAmount  Decimal? @db.Decimal(20, 8)              // milestone goal (2500)
  targetDate    DateTime?              // deadline (2026-06-28)

  // Lock: funds can't be withdrawn back to spendable until conditions clear.
  lockType      BudgetLockType @default(NONE)  // NONE | DATE | STEP_UP | DATE_AND_STEP_UP
  unlockDate    DateTime?              // for DATE / DATE_AND_STEP_UP

  // Auto-contribution (optional) — mirrors RecurringBuy.
  autoEnabled   Boolean  @default(false)
  autoAmount    Decimal? @db.Decimal(20, 8)
  autoFrequency RecurringFrequency?    // reuse the existing enum
  autoSourceCurrency Currency?         // which spendable wallet to pull from
  nextRunAt     DateTime?
  lastRunAt     DateTime?

  status        BudgetWalletStatus @default(ACTIVE)  // ACTIVE | COMPLETED | CLOSED
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions BudgetContribution[]

  @@index([userId])
  @@index([status, autoEnabled, nextRunAt])  // scheduler scan
}

model BudgetContribution {
  id        String   @id @default(uuid())
  budgetId  String
  amount    Decimal  @db.Decimal(20, 8)
  kind      String   // "MANUAL" | "AUTO" | "WITHDRAWAL"  (withdrawal = negative)
  createdAt DateTime @default(now())
  budget    BudgetWallet @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  @@index([budgetId])
}

enum BudgetLockType { NONE DATE STEP_UP DATE_AND_STEP_UP }
enum BudgetWalletStatus { ACTIVE COMPLETED CLOSED }
```

A migration adds these tables + enums. The Dockerfile now runs `prisma migrate deploy` on boot (see [[prod-droplet-deploy]] memory) so this self-applies.

**Money mechanics (ledger-safe):** a contribution moves `amount` from the user's spendable `Wallet.balance` (same currency) into the BudgetWallet's `balance`. To keep one source of truth and reuse the freeze machinery, contributing **increments `Wallet.frozen`** by the amount AND records it on the budget; releasing reverses it. Net spendable = `balance - frozen`, which the app already respects. Every move is a balanced ledger transaction (type `BUDGET_CONTRIBUTION` / `BUDGET_RELEASE`). Contributing requires sufficient spendable funds; the server checks `balance - frozen >= amount`.

---

## Server endpoints (`/budgets`)

`budget.controller.ts` + `budget.routes.ts` (auth-gated):
- `GET    /budgets` — list the user's budgets (+ progress %, locked flag).
- `POST   /budgets` — create `{ name, emoji?, currency, targetAmount?, targetDate?, lockType, unlockDate?, auto? }`.
- `PATCH  /budgets/:id` — edit name/emoji/target/auto settings (not currency).
- `POST   /budgets/:id/contribute` — `{ amount }` manual top-up (freezes funds, logs contribution, marks COMPLETED if target reached).
- `POST   /budgets/:id/withdraw` — release funds back to spendable. **Enforces the lock:** if `DATE` and `now < unlockDate` → 403; if `STEP_UP` → require a valid step-up token (reuse the step-up middleware/flow); `DATE_AND_STEP_UP` → both.
- `DELETE /budgets/:id` — close a budget (releases remaining funds, lock rules still apply).

**Scheduler:** `budget.service.ts` clones the RecurringBuy pattern — `startBudgetScheduler(60s)` → `runDueBudgets(now)` finds `status=ACTIVE, autoEnabled=true, nextRunAt<=now`, contributes `autoAmount` (skips silently if insufficient spendable, sets `lastError`), advances `nextRunAt = computeNextRun(...)`. Idempotency key `bud_<id>_<nextRunAt epoch>`. Started from `server/src/index.ts` next to the recurring-buy scheduler.

---

## Mobile UI

- **New route `app/budgets/index.tsx`** — list of budget cards (name + emoji, progress ring toward target, "saved X of Y", deadline countdown, 🔒 if locked). "New budget" CTA. Reachable from the home More-menu + wallet tab.
- **`app/budgets/[id].tsx`** — detail: big progress, contribute (amount keypad), toggle/configure auto-contribution (reuse the RecurringBuyWidget frequency UI), withdraw (triggers lock checks → date error or `StepUpModal`), edit, close.
- **`app/budgets/new.tsx`** (or a sheet) — create flow: name, emoji picker (reuse register's emoji groups), currency, target amount + date, lock type (None / Until date / Requires 2FA / Both), optional auto-contribution.
- Services in `src/services/index.ts` (`budgetService`) + a `useBudgets` hook (React Query), all themed with the blue accent + the new design system. Step-up on withdraw uses the existing `useStepUpAuth` + `StepUpModal`.
- i18n keys (`budget.*`) EN + AR.

---

## Build order
1. Schema + migration + enums.
2. `budget.service.ts` (money moves + scheduler) and wire scheduler in `index.ts`.
3. `budget.controller.ts` + routes (incl. lock enforcement + step-up on withdraw).
4. Client `budgetService` + `useBudgets`.
5. Mobile screens (list, detail, create) + i18n.
6. Typecheck server + mobile; manual flow check.

## Verification
- Contribute → spendable drops, budget rises, progress updates; reaching target flips COMPLETED.
- Auto-contribution fires on schedule (test with a near-future `nextRunAt`), skips on insufficient funds.
- Withdraw before `unlockDate` → blocked; after → allowed. `STEP_UP` lock → withdraw requires the 6-digit code.
- Money conservation: spendable + sum(budget balances) is invariant across contribute/withdraw (fund-integrity stays balanced).
