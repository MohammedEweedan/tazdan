ALTER TABLE "AssetDiscussionPost"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "likedBy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_symbol_parentId_createdAt_idx"
  ON "AssetDiscussionPost"("symbol", "parentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_parentId_idx"
  ON "AssetDiscussionPost"("parentId");

DO $$ BEGIN
  ALTER TABLE "AssetDiscussionPost"
    ADD CONSTRAINT "AssetDiscussionPost_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "AssetDiscussionPost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
