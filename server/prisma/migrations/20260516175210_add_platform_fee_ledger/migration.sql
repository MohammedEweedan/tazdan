-- CreateTable
CREATE TABLE "PlatformFee" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "payerId" TEXT,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountUsd" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformFee_source_idx" ON "PlatformFee"("source");

-- CreateIndex
CREATE INDEX "PlatformFee_payerId_idx" ON "PlatformFee"("payerId");

-- CreateIndex
CREATE INDEX "PlatformFee_currency_idx" ON "PlatformFee"("currency");

-- CreateIndex
CREATE INDEX "PlatformFee_createdAt_idx" ON "PlatformFee"("createdAt");
