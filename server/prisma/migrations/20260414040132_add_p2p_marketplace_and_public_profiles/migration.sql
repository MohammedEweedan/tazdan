/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "P2PListingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "P2PTradeStatus" AS ENUM ('AWAITING_ESCROW', 'ESCROW_FUNDED', 'PAYMENT_SENT', 'PAYMENT_CONFIRMED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "P2PDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Currency" ADD VALUE 'BTC';
ALTER TYPE "Currency" ADD VALUE 'ETH';
ALTER TYPE "Currency" ADD VALUE 'BNB';
ALTER TYPE "Currency" ADD VALUE 'SOL';
ALTER TYPE "Currency" ADD VALUE 'XRP';
ALTER TYPE "Currency" ADD VALUE 'ADA';
ALTER TYPE "Currency" ADD VALUE 'DOGE';
ALTER TYPE "Currency" ADD VALUE 'MATIC';
ALTER TYPE "Currency" ADD VALUE 'DOT';
ALTER TYPE "Currency" ADD VALUE 'AVAX';
ALTER TYPE "Currency" ADD VALUE 'LYDT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedCurrencies" TEXT[] DEFAULT ARRAY['USDT', 'LYDT', 'USD', 'BTC', 'ETH']::TEXT[],
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profilePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "P2PListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USDT',
    "fiatCurrency" "Currency" NOT NULL DEFAULT 'LYD',
    "side" "OrderSide" NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "minLimit" DECIMAL(20,8) NOT NULL,
    "maxLimit" DECIMAL(20,8) NOT NULL,
    "filled" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "paymentMethods" TEXT[] DEFAULT ARRAY['BANK_TRANSFER']::TEXT[],
    "terms" TEXT,
    "autoReply" TEXT,
    "status" "P2PListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2PTrade" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "fiatCurrency" "Currency" NOT NULL,
    "cryptoAmount" DECIMAL(20,8) NOT NULL,
    "fiatAmount" DECIMAL(20,8) NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "escrowAmount" DECIMAL(20,8) NOT NULL,
    "status" "P2PTradeStatus" NOT NULL DEFAULT 'AWAITING_ESCROW',
    "reference" TEXT NOT NULL,
    "buyerNote" TEXT,
    "sellerNote" TEXT,
    "paymentMethod" TEXT,
    "paymentProofUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2PDispute" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "P2PDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "penaltyPercent" DECIMAL(5,2),
    "penaltyUserId" TEXT,
    "penaltyAmount" DECIMAL(20,8),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "P2PListing_userId_idx" ON "P2PListing"("userId");

-- CreateIndex
CREATE INDEX "P2PListing_currency_fiatCurrency_side_status_idx" ON "P2PListing"("currency", "fiatCurrency", "side", "status");

-- CreateIndex
CREATE INDEX "P2PListing_status_idx" ON "P2PListing"("status");

-- CreateIndex
CREATE INDEX "P2PListing_createdAt_idx" ON "P2PListing"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "P2PTrade_reference_key" ON "P2PTrade"("reference");

-- CreateIndex
CREATE INDEX "P2PTrade_listingId_idx" ON "P2PTrade"("listingId");

-- CreateIndex
CREATE INDEX "P2PTrade_buyerId_idx" ON "P2PTrade"("buyerId");

-- CreateIndex
CREATE INDEX "P2PTrade_sellerId_idx" ON "P2PTrade"("sellerId");

-- CreateIndex
CREATE INDEX "P2PTrade_status_idx" ON "P2PTrade"("status");

-- CreateIndex
CREATE INDEX "P2PTrade_reference_idx" ON "P2PTrade"("reference");

-- CreateIndex
CREATE INDEX "P2PTrade_createdAt_idx" ON "P2PTrade"("createdAt");

-- CreateIndex
CREATE INDEX "P2PDispute_tradeId_idx" ON "P2PDispute"("tradeId");

-- CreateIndex
CREATE INDEX "P2PDispute_raisedById_idx" ON "P2PDispute"("raisedById");

-- CreateIndex
CREATE INDEX "P2PDispute_status_idx" ON "P2PDispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "P2PListing" ADD CONSTRAINT "P2PListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "P2PListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PDispute" ADD CONSTRAINT "P2PDispute_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "P2PTrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PDispute" ADD CONSTRAINT "P2PDispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
