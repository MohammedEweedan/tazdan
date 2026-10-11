-- Business payouts: idempotency, API source, approval reason, compliance link,
-- and the risk engine result per payout.

-- AlterTable
ALTER TABLE "BusinessPayout" ADD COLUMN     "riskDecisionId" TEXT,
ADD COLUMN     "riskOutcome" TEXT;

-- AlterTable
ALTER TABLE "BusinessPayoutBatch" ADD COLUMN     "apiKeyId" TEXT,
ADD COLUMN     "approvalReason" TEXT,
ADD COLUMN     "complianceCaseId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'APP';

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPayoutBatch_businessId_idempotencyKey_key" ON "BusinessPayoutBatch"("businessId", "idempotencyKey");
