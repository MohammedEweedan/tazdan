-- Budget Wallets: named savings goals with optional auto-contribution + lock.

-- New transaction types
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BUDGET_CONTRIBUTION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BUDGET_RELEASE';

-- Enums
DO $$ BEGIN
  CREATE TYPE "BudgetLockType" AS ENUM ('NONE', 'DATE', 'STEP_UP', 'DATE_AND_STEP_UP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BudgetWalletStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- BudgetWallet
CREATE TABLE IF NOT EXISTS "BudgetWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "emoji" TEXT,
  "currency" "Currency" NOT NULL,
  "balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "targetAmount" DECIMAL(20,8),
  "targetDate" TIMESTAMP(3),
  "lockType" "BudgetLockType" NOT NULL DEFAULT 'NONE',
  "unlockDate" TIMESTAMP(3),
  "autoEnabled" BOOLEAN NOT NULL DEFAULT false,
  "autoAmount" DECIMAL(20,8),
  "autoFrequency" "RecurringFrequency",
  "autoSourceCurrency" "Currency",
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "lastError" TEXT,
  "status" "BudgetWalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetWallet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BudgetWallet_userId_idx" ON "BudgetWallet"("userId");
CREATE INDEX IF NOT EXISTS "BudgetWallet_status_autoEnabled_nextRunAt_idx" ON "BudgetWallet"("status", "autoEnabled", "nextRunAt");

-- BudgetContribution
CREATE TABLE IF NOT EXISTS "BudgetContribution" (
  "id" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "amount" DECIMAL(20,8) NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetContribution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BudgetContribution_budgetId_idx" ON "BudgetContribution"("budgetId");

-- FKs
ALTER TABLE "BudgetWallet" ADD CONSTRAINT "BudgetWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetContribution" ADD CONSTRAINT "BudgetContribution_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "BudgetWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
