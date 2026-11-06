CREATE TABLE IF NOT EXISTS "product_wishes" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "source" TEXT NOT NULL DEFAULT 'smart_guide',
  "species" TEXT NOT NULL,
  "intent" TEXT,
  "request_text" TEXT NOT NULL,
  "context" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_wishes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_wishes_status_created_at_idx"
  ON "product_wishes"("status", "created_at");
CREATE INDEX IF NOT EXISTS "product_wishes_species_status_idx"
  ON "product_wishes"("species", "status");

DO $$ BEGIN
  ALTER TABLE "product_wishes"
    ADD CONSTRAINT "product_wishes_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
