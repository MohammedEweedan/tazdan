-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('PENDING_PAYMENT', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'DEPLOYING', 'DEPLOYED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('ESCROW', 'VESTING', 'MULTISIG', 'TOKEN_LOCK', 'PAYMENT_SPLITTER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AMLFlagStatus" AS ENUM ('OPEN', 'REVIEWING', 'CLEARED', 'ESCALATED', 'FROZEN');

-- CreateEnum
CREATE TYPE "AMLFlagType" AS ENUM ('HIGH_VOLUME', 'RAPID_TRANSACTIONS', 'SUSPICIOUS_PATTERN', 'SANCTIONED_ADDRESS', 'LARGE_WITHDRAWAL', 'STRUCTURING', 'MANUAL');

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "totalSupply" DECIMAL(38,0) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "chain" TEXT NOT NULL DEFAULT 'BNB',
    "contractAddress" TEXT,
    "deployTxHash" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "platformFee" DECIMAL(20,8) NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartContract" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chain" TEXT NOT NULL DEFAULT 'BNB',
    "contractAddress" TEXT,
    "deployTxHash" TEXT,
    "parameters" JSONB NOT NULL,
    "platformFee" DECIMAL(20,8) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMLFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AMLFlagType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "transactionRef" TEXT,
    "amount" DECIMAL(20,8),
    "currency" "Currency",
    "status" "AMLFlagStatus" NOT NULL DEFAULT 'OPEN',
    "autoAction" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AMLFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_senderId_receiverId_idx" ON "Message"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MemeToken_userId_idx" ON "MemeToken"("userId");

-- CreateIndex
CREATE INDEX "MemeToken_status_idx" ON "MemeToken"("status");

-- CreateIndex
CREATE INDEX "MemeToken_chain_idx" ON "MemeToken"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "MemeToken_chain_symbol_key" ON "MemeToken"("chain", "symbol");

-- CreateIndex
CREATE INDEX "SmartContract_userId_idx" ON "SmartContract"("userId");

-- CreateIndex
CREATE INDEX "SmartContract_status_idx" ON "SmartContract"("status");

-- CreateIndex
CREATE INDEX "SmartContract_type_idx" ON "SmartContract"("type");

-- CreateIndex
CREATE INDEX "AMLFlag_userId_idx" ON "AMLFlag"("userId");

-- CreateIndex
CREATE INDEX "AMLFlag_status_idx" ON "AMLFlag"("status");

-- CreateIndex
CREATE INDEX "AMLFlag_type_idx" ON "AMLFlag"("type");

-- CreateIndex
CREATE INDEX "AMLFlag_severity_idx" ON "AMLFlag"("severity");

-- CreateIndex
CREATE INDEX "AMLFlag_createdAt_idx" ON "AMLFlag"("createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemeToken" ADD CONSTRAINT "MemeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartContract" ADD CONSTRAINT "SmartContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AMLFlag" ADD CONSTRAINT "AMLFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
