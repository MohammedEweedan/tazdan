-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurringSourceType" AS ENUM ('WALLET', 'CARD');

-- CreateEnum
CREATE TYPE "RecurringBuyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RecurringBuy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "fiatCurrency" "Currency" NOT NULL,
    "fiatAmount" DECIMAL(20,8) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "sourceType" "RecurringSourceType" NOT NULL,
    "sourceId" TEXT,
    "status" "RecurringBuyStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBuy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringBuy_userId_idx" ON "RecurringBuy"("userId");

-- CreateIndex
CREATE INDEX "RecurringBuy_status_nextRunAt_idx" ON "RecurringBuy"("status", "nextRunAt");

-- AddForeignKey
ALTER TABLE "RecurringBuy" ADD CONSTRAINT "RecurringBuy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
