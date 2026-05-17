-- AlterTable
ALTER TABLE "P2PListing" ADD COLUMN     "baseAsset" TEXT,
ADD COLUMN     "fiatAsset" TEXT;

-- AlterTable
ALTER TABLE "P2PTrade" ADD COLUMN     "baseAsset" TEXT,
ADD COLUMN     "fiatAsset" TEXT;

-- CreateIndex
CREATE INDEX "P2PListing_baseAsset_side_status_idx" ON "P2PListing"("baseAsset", "side", "status");
