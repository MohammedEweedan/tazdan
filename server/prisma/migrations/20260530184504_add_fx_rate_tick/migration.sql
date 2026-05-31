-- CreateTable
CREATE TABLE "FxRateTick" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "volumeUsd" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "skewPct" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRateTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FxRateTick_pair_createdAt_idx" ON "FxRateTick"("pair", "createdAt");
