-- CreateEnum
CREATE TYPE "KYCTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "RampStatus" AS ENUM ('QUOTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RampProvider" AS ENUM ('MOCK', 'MOONPAY', 'TRANSAK', 'SARDINE', 'STRIPE', 'REVOLUT');

-- CreateEnum
CREATE TYPE "RampPaymentMethod" AS ENUM ('CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'REVOLUT', 'BANK_TRANSFER', 'SEPA', 'ACH', 'CRYPTO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Currency" ADD VALUE 'EUR';
ALTER TYPE "Currency" ADD VALUE 'GBP';
ALTER TYPE "Currency" ADD VALUE 'AED';
ALTER TYPE "Currency" ADD VALUE 'SAR';
ALTER TYPE "Currency" ADD VALUE 'EGP';
ALTER TYPE "Currency" ADD VALUE 'LYD';

-- AlterTable
ALTER TABLE "P2PListing" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "kycTier" "KYCTier" NOT NULL DEFAULT 'TIER_0';

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" "Currency" NOT NULL,
    "quoteAsset" "Currency" NOT NULL DEFAULT 'USDT',
    "displayName" TEXT,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnRampTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "RampProvider" NOT NULL DEFAULT 'MOCK',
    "providerRef" TEXT,
    "status" "RampStatus" NOT NULL DEFAULT 'QUOTED',
    "fiatCurrency" "Currency" NOT NULL,
    "fiatAmount" DECIMAL(20,8) NOT NULL,
    "cryptoCurrency" "Currency" NOT NULL,
    "cryptoAmount" DECIMAL(20,8) NOT NULL,
    "exchangeRate" DECIMAL(20,8) NOT NULL,
    "feeAmount" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "feeCurrency" "Currency" NOT NULL,
    "paymentMethod" "RampPaymentMethod" NOT NULL,
    "network" TEXT,
    "reference" TEXT NOT NULL,
    "webhookPayload" JSONB,
    "failureReason" TEXT,
    "quotedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnRampTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffRampTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "RampProvider" NOT NULL DEFAULT 'MOCK',
    "providerRef" TEXT,
    "status" "RampStatus" NOT NULL DEFAULT 'QUOTED',
    "cryptoCurrency" "Currency" NOT NULL,
    "cryptoAmount" DECIMAL(20,8) NOT NULL,
    "fiatCurrency" "Currency" NOT NULL,
    "fiatAmount" DECIMAL(20,8) NOT NULL,
    "exchangeRate" DECIMAL(20,8) NOT NULL,
    "feeAmount" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "feeCurrency" "Currency" NOT NULL,
    "payoutMethod" "RampPaymentMethod" NOT NULL,
    "payoutBankAccountId" TEXT,
    "payoutAddress" TEXT,
    "reference" TEXT NOT NULL,
    "webhookPayload" JSONB,
    "failureReason" TEXT,
    "quotedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffRampTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_symbol_key" ON "MarketListing"("symbol");

-- CreateIndex
CREATE INDEX "MarketListing_symbol_idx" ON "MarketListing"("symbol");

-- CreateIndex
CREATE INDEX "MarketListing_isActive_idx" ON "MarketListing"("isActive");

-- CreateIndex
CREATE INDEX "MarketListing_isNew_idx" ON "MarketListing"("isNew");

-- CreateIndex
CREATE INDEX "MarketListing_rank_idx" ON "MarketListing"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "OnRampTransaction_reference_key" ON "OnRampTransaction"("reference");

-- CreateIndex
CREATE INDEX "OnRampTransaction_userId_idx" ON "OnRampTransaction"("userId");

-- CreateIndex
CREATE INDEX "OnRampTransaction_status_idx" ON "OnRampTransaction"("status");

-- CreateIndex
CREATE INDEX "OnRampTransaction_provider_idx" ON "OnRampTransaction"("provider");

-- CreateIndex
CREATE INDEX "OnRampTransaction_providerRef_idx" ON "OnRampTransaction"("providerRef");

-- CreateIndex
CREATE INDEX "OnRampTransaction_reference_idx" ON "OnRampTransaction"("reference");

-- CreateIndex
CREATE INDEX "OnRampTransaction_createdAt_idx" ON "OnRampTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OffRampTransaction_reference_key" ON "OffRampTransaction"("reference");

-- CreateIndex
CREATE INDEX "OffRampTransaction_userId_idx" ON "OffRampTransaction"("userId");

-- CreateIndex
CREATE INDEX "OffRampTransaction_status_idx" ON "OffRampTransaction"("status");

-- CreateIndex
CREATE INDEX "OffRampTransaction_provider_idx" ON "OffRampTransaction"("provider");

-- CreateIndex
CREATE INDEX "OffRampTransaction_providerRef_idx" ON "OffRampTransaction"("providerRef");

-- CreateIndex
CREATE INDEX "OffRampTransaction_reference_idx" ON "OffRampTransaction"("reference");

-- CreateIndex
CREATE INDEX "OffRampTransaction_createdAt_idx" ON "OffRampTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "P2PListing_country_idx" ON "P2PListing"("country");

-- CreateIndex
CREATE INDEX "User_country_idx" ON "User"("country");

-- CreateIndex
CREATE INDEX "User_kycTier_idx" ON "User"("kycTier");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnRampTransaction" ADD CONSTRAINT "OnRampTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffRampTransaction" ADD CONSTRAINT "OffRampTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
