ALTER TABLE "OnChainTransaction" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "OnChainTransaction_idempotencyKey_key" ON "OnChainTransaction"("idempotencyKey");
