-- Principal crypto exposure: hedges Tazdan records against the position it
-- carries when customer orders fill as principal. Append-only, like the
-- other evidence tables (20261006120000_operating_platform).
-- CreateTable
CREATE TABLE "PrincipalHedge" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(36,18) NOT NULL,
    "priceUsd" DECIMAL(20,8) NOT NULL,
    "venue" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrincipalHedge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrincipalHedge_asset_createdAt_idx" ON "PrincipalHedge"("asset", "createdAt");

CREATE TRIGGER "PrincipalHedge_append_only" BEFORE UPDATE OR DELETE ON "PrincipalHedge"
  FOR EACH ROW EXECUTE FUNCTION tazdan_forbid_mutation();
ALTER TABLE "PrincipalHedge" ADD CONSTRAINT "PrincipalHedge_valid"
  CHECK ("side" IN ('BUY', 'SELL') AND "quantity" > 0 AND "priceUsd" > 0);
