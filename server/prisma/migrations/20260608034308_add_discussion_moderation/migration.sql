-- Community moderation columns for AssetDiscussionPost.
ALTER TABLE "AssetDiscussionPost"
  ADD COLUMN IF NOT EXISTS "reportCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reportedBy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "hiddenByMod" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AssetDiscussionPost_reportCount_idx" ON "AssetDiscussionPost"("reportCount");
