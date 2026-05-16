-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockoutUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WithdrawalAddressWhitelist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "label" TEXT,
    "confirmToken" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "activeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalAddressWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalAddressWhitelist_userId_idx" ON "WithdrawalAddressWhitelist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalAddressWhitelist_userId_key_key" ON "WithdrawalAddressWhitelist"("userId", "key");

-- AddForeignKey
ALTER TABLE "WithdrawalAddressWhitelist" ADD CONSTRAINT "WithdrawalAddressWhitelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
