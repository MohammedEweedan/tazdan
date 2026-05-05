-- CreateEnum
CREATE TYPE "CryptoOrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "CryptoOrderStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletIndex" SERIAL NOT NULL,
    "ethAddress" TEXT NOT NULL,
    "btcAddress" TEXT NOT NULL,
    "solAddress" TEXT NOT NULL,
    "tronAddress" TEXT NOT NULL,
    "ethBalance" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "btcBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "solBalance" DECIMAL(20,9) NOT NULL DEFAULT 0,
    "usdtErc20Bal" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "usdtTrc20Bal" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "selfCustodyExported" BOOLEAN NOT NULL DEFAULT false,
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterSeedStore" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ciphertext" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "kmsKeyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterSeedStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CryptoOrderType" NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "quotedPrice" DECIMAL(20,8) NOT NULL,
    "quotedTotal" DECIMAL(20,8) NOT NULL,
    "marketPrice" DECIMAL(20,8) NOT NULL,
    "actualCost" DECIMAL(20,8) NOT NULL,
    "platformFee" DECIMAL(20,8) NOT NULL,
    "networkFee" DECIMAL(20,8) NOT NULL,
    "spreadCapture" DECIMAL(20,8) NOT NULL,
    "cryptoAmount" DECIMAL(36,18) NOT NULL,
    "status" "CryptoOrderStatus" NOT NULL DEFAULT 'PENDING',
    "binanceOrderId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "CryptoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnChainTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gasUsed" DECIMAL(20,8),
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "OnChainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_key" ON "UserWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_walletIndex_key" ON "UserWallet"("walletIndex");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_ethAddress_key" ON "UserWallet"("ethAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_btcAddress_key" ON "UserWallet"("btcAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_solAddress_key" ON "UserWallet"("solAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_tronAddress_key" ON "UserWallet"("tronAddress");

-- CreateIndex
CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterSeedStore_version_key" ON "MasterSeedStore"("version");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_idempotencyKey_key" ON "CryptoOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CryptoOrder_userId_idx" ON "CryptoOrder"("userId");

-- CreateIndex
CREATE INDEX "CryptoOrder_status_idx" ON "CryptoOrder"("status");

-- CreateIndex
CREATE INDEX "CryptoOrder_asset_network_idx" ON "CryptoOrder"("asset", "network");

-- CreateIndex
CREATE INDEX "CryptoOrder_createdAt_idx" ON "CryptoOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnChainTransaction_txHash_key" ON "OnChainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "OnChainTransaction_userId_idx" ON "OnChainTransaction"("userId");

-- CreateIndex
CREATE INDEX "OnChainTransaction_status_idx" ON "OnChainTransaction"("status");

-- CreateIndex
CREATE INDEX "OnChainTransaction_asset_network_idx" ON "OnChainTransaction"("asset", "network");

-- CreateIndex
CREATE INDEX "OnChainTransaction_txHash_idx" ON "OnChainTransaction"("txHash");

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnChainTransaction" ADD CONSTRAINT "OnChainTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
