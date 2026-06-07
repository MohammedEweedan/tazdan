DO $$ BEGIN
  CREATE TYPE "AssetDiscussionTag" AS ENUM ('BULLISH', 'BEARISH', 'WATCH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AssetDiscussionPost" (
  "id"        TEXT NOT NULL,
  "symbol"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "tag"       "AssetDiscussionTag" NOT NULL DEFAULT 'WATCH',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssetDiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_symbol_createdAt_idx" ON "AssetDiscussionPost"("symbol", "createdAt");
CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_userId_idx" ON "AssetDiscussionPost"("userId");
CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_deletedAt_idx" ON "AssetDiscussionPost"("deletedAt");

DO $$ BEGIN
  ALTER TABLE "AssetDiscussionPost"
    ADD CONSTRAINT "AssetDiscussionPost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
