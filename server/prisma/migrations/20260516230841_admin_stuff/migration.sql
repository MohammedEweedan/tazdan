-- CreateTable
CREATE TABLE "PlatformBankAccount" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "sortCode" TEXT,
    "routingNumber" TEXT,
    "branch" TEXT,
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformBankAccount_currency_idx" ON "PlatformBankAccount"("currency");

-- CreateIndex
CREATE INDEX "PlatformBankAccount_country_idx" ON "PlatformBankAccount"("country");

-- CreateIndex
CREATE INDEX "PlatformBankAccount_isActive_idx" ON "PlatformBankAccount"("isActive");
