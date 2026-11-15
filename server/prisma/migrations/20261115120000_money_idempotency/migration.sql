-- AlterTable
ALTER TABLE "P2PTrade" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "P2PTrade_idempotencyKey_key" ON "P2PTrade"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_userId_idempotencyKey_key" ON "Withdrawal"("userId", "idempotencyKey");

