-- Additive only: cache LINE Messaging API profile fields for HQ campaign review.
-- Nullable columns; no data rewrite, rename, or drop.

ALTER TABLE "campaign_applications"
  ADD COLUMN IF NOT EXISTS "line_picture_url" TEXT;

ALTER TABLE "campaign_applications"
  ADD COLUMN IF NOT EXISTS "line_profile_synced_at" TIMESTAMP(3);
