CREATE TABLE IF NOT EXISTS "partner_applications" (
  "id" TEXT NOT NULL,
  "application_no" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "mode" TEXT NOT NULL,
  "store_name" TEXT NOT NULL,
  "store_type" TEXT,
  "contact_name" TEXT,
  "phone" TEXT,
  "email" TEXT NOT NULL,
  "line_id" TEXT,
  "tax_id" TEXT,
  "address" TEXT,
  "expected_start" TEXT,
  "notes" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "totals" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "terms" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "summary" TEXT,
  "description" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_applications_application_no_key"
  ON "partner_applications"("application_no");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_applications_task_id_key"
  ON "partner_applications"("task_id");
CREATE INDEX IF NOT EXISTS "partner_applications_status_created_at_idx"
  ON "partner_applications"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "partner_applications"
    ADD CONSTRAINT "partner_applications_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
