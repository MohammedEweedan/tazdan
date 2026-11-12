-- LYDT sandbox: tazdan's dinar token, backed 1:1 by dinars held at the CBL.
-- Additive only.

-- AlterEnum
ALTER TYPE "LedgerAccountType" ADD VALUE 'TOKEN_RESERVE';

-- CreateTable
CREATE TABLE "LydtAttestation" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(20,3) NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LydtAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LydtOperation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "amount" DECIMAL(20,3) NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LydtOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LydtFreeze" (
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "frozenById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LydtFreeze_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "LydtAttestation_createdAt_idx" ON "LydtAttestation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LydtOperation_reference_key" ON "LydtOperation"("reference");

-- CreateIndex
CREATE INDEX "LydtOperation_userId_createdAt_idx" ON "LydtOperation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LydtOperation_userId_idempotencyKey_key" ON "LydtOperation"("userId", "idempotencyKey");
