-- Business tills: checkout points with their own QR/kiosk; payments carry the till for per-till metrics.

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "tillId" TEXT;

-- CreateTable
CREATE TABLE "BusinessTill" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessTill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessTill_businessId_idx" ON "BusinessTill"("businessId");

-- CreateIndex
CREATE INDEX "Transfer_tillId_createdAt_idx" ON "Transfer"("tillId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessTill" ADD CONSTRAINT "BusinessTill_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_tillId_fkey" FOREIGN KEY ("tillId") REFERENCES "BusinessTill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

