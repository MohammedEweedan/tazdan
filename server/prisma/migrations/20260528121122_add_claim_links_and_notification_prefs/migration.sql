-- CreateEnum
CREATE TYPE "ClaimLinkStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClaimLink" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientHandle" TEXT,
    "asset" "Currency" NOT NULL DEFAULT 'USDT',
    "amount" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "note" TEXT,
    "claimToken" TEXT NOT NULL,
    "pinHash" TEXT,
    "status" "ClaimLinkStatus" NOT NULL DEFAULT 'PENDING',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaimLink_claimToken_key" ON "ClaimLink"("claimToken");

-- CreateIndex
CREATE INDEX "ClaimLink_senderId_idx" ON "ClaimLink"("senderId");

-- CreateIndex
CREATE INDEX "ClaimLink_claimedById_idx" ON "ClaimLink"("claimedById");

-- CreateIndex
CREATE INDEX "ClaimLink_status_idx" ON "ClaimLink"("status");

-- CreateIndex
CREATE INDEX "ClaimLink_recipientEmail_idx" ON "ClaimLink"("recipientEmail");

-- CreateIndex
CREATE INDEX "ClaimLink_recipientPhone_idx" ON "ClaimLink"("recipientPhone");

-- CreateIndex
CREATE INDEX "ClaimLink_expiresAt_idx" ON "ClaimLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "ClaimLink" ADD CONSTRAINT "ClaimLink_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLink" ADD CONSTRAINT "ClaimLink_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
