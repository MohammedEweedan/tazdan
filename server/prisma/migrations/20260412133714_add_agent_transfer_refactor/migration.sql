/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Agent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'AGENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "TransactionType" ADD VALUE 'AGENT_DEPOSIT';
ALTER TYPE "TransactionType" ADD VALUE 'AGENT_WITHDRAWAL';
ALTER TYPE "TransactionType" ADD VALUE 'COMMISSION';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "dailyVolume" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "dailyVolumeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalCommission" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AgentTransaction" ADD COLUMN     "commission" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
ADD COLUMN     "processedBy" TEXT,
ADD COLUMN     "userNotes" TEXT;

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USDT',
    "amount" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_reference_key" ON "Transfer"("reference");

-- CreateIndex
CREATE INDEX "Transfer_senderId_idx" ON "Transfer"("senderId");

-- CreateIndex
CREATE INDEX "Transfer_receiverId_idx" ON "Transfer"("receiverId");

-- CreateIndex
CREATE INDEX "Transfer_reference_idx" ON "Transfer"("reference");

-- CreateIndex
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "AgentTransaction_createdAt_idx" ON "AgentTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
