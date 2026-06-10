-- Dynamic asset ledger for off-enum crypto/meme assets.
-- The existing LedgerAccount/LedgerEntry tables use Prisma's Currency enum,
-- which is intentionally finite. These tables carry arbitrary uppercase asset
-- symbols so long-tail assets do not bypass double-entry accounting.

CREATE TABLE "AssetLedgerAccount" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "userId" TEXT,
  "asset" TEXT NOT NULL,
  "balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetLedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetLedgerEntry" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "amount" DECIMAL(38,18) NOT NULL,
  "refType" TEXT NOT NULL,
  "refId" TEXT,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetLedgerAccount_identity_idx"
  ON "AssetLedgerAccount" ("type", COALESCE("userId", '__SYSTEM__'), "asset");

CREATE INDEX "AssetLedgerAccount_userId_idx" ON "AssetLedgerAccount" ("userId");
CREATE INDEX "AssetLedgerAccount_type_asset_idx" ON "AssetLedgerAccount" ("type", "asset");
CREATE INDEX "AssetLedgerEntry_groupId_idx" ON "AssetLedgerEntry" ("groupId");
CREATE INDEX "AssetLedgerEntry_accountId_createdAt_idx" ON "AssetLedgerEntry" ("accountId", "createdAt");
CREATE INDEX "AssetLedgerEntry_refType_refId_idx" ON "AssetLedgerEntry" ("refType", "refId");

ALTER TABLE "AssetLedgerAccount"
  ADD CONSTRAINT "AssetLedgerAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetLedgerEntry"
  ADD CONSTRAINT "AssetLedgerEntry_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "AssetLedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

