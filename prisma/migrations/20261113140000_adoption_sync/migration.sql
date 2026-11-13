CREATE TABLE "adoption_source_records" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "region" TEXT NOT NULL DEFAULT '',
  "source_status" TEXT NOT NULL DEFAULT '待確認',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "data" JSONB NOT NULL,
  "content_hash" TEXT NOT NULL DEFAULT '',
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_checked_at" TIMESTAMP(3),
  "next_check_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "missing_count" INTEGER NOT NULL DEFAULT 0,
  "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "adoption_source_records_source_source_id_key" ON "adoption_source_records"("source", "source_id");
CREATE INDEX "adoption_source_records_source_next_check_at_idx" ON "adoption_source_records"("source", "next_check_at");
CREATE INDEX "adoption_source_records_source_published_idx" ON "adoption_source_records"("source", "published");
CREATE TABLE "adoption_sync_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "lease_key" TEXT,
  "lease_until" TIMESTAMP(3),
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "list_complete" BOOLEAN NOT NULL DEFAULT false,
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "checked" INTEGER NOT NULL DEFAULT 0,
  "changed" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL
);
CREATE UNIQUE INDEX "adoption_sync_runs_lease_key_key" ON "adoption_sync_runs"("lease_key");
CREATE INDEX "adoption_sync_runs_source_started_at_idx" ON "adoption_sync_runs"("source", "started_at");
CREATE INDEX "adoption_sync_runs_source_list_complete_finished_at_idx" ON "adoption_sync_runs"("source", "list_complete", "finished_at");
ALTER TABLE "adoption_source_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adoption_sync_runs" ENABLE ROW LEVEL SECURITY;
-- Only the server-side DB role accesses these tables. No anonymous Data API policy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "adoption_source_records", "adoption_sync_runs" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "adoption_source_records", "adoption_sync_runs" FROM authenticated;
  END IF;
END $$;
