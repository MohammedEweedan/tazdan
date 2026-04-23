-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('STARTER', 'MASTER', 'PRO');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('PENDING', 'ACTIVE', 'FROZEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CardTxType" AS ENUM ('PURCHASE', 'REFUND', 'FEE', 'CASHBACK', 'TOPUP', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "CardTier" NOT NULL DEFAULT 'STARTER',
    "status" "CardStatus" NOT NULL DEFAULT 'PENDING',
    "nickname" TEXT,
    "last4" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "cardHolder" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USDT',
    "spentTotal" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "spentMonth" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "dailyLimit" DECIMAL(20,8) NOT NULL DEFAULT 5000,
    "monthlyLimit" DECIMAL(20,8) NOT NULL DEFAULT 50000,
    "cashbackRate" DECIMAL(6,4) NOT NULL DEFAULT 0.01,
    "cashbackBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "contactlessOn" BOOLEAN NOT NULL DEFAULT true,
    "onlineOn" BOOLEAN NOT NULL DEFAULT true,
    "atmOn" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTransaction" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CardTxType" NOT NULL,
    "merchant" TEXT,
    "category" TEXT,
    "country" TEXT,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USDT',
    "fxRate" DECIMAL(20,8),
    "cashback" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "declinedReason" TEXT,
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE INDEX "Card_status_idx" ON "Card"("status");

-- CreateIndex
CREATE INDEX "Card_last4_idx" ON "Card"("last4");

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_reference_key" ON "CardTransaction"("reference");

-- CreateIndex
CREATE INDEX "CardTransaction_cardId_idx" ON "CardTransaction"("cardId");

-- CreateIndex
CREATE INDEX "CardTransaction_userId_idx" ON "CardTransaction"("userId");

-- CreateIndex
CREATE INDEX "CardTransaction_type_idx" ON "CardTransaction"("type");

-- CreateIndex
CREATE INDEX "CardTransaction_createdAt_idx" ON "CardTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
