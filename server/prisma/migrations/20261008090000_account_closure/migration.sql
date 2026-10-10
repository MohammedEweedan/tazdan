-- Account closure (customer-requested deletion, required by the App Store and
-- Google Play). CLOSED accounts cannot sign in; personal data is anonymised
-- at erasureDueAt while financial records are retained (DATA_RETENTION.md).

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymisedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closureReason" TEXT,
ADD COLUMN     "erasureDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_status_erasureDueAt_idx" ON "User"("status", "erasureDueAt");

