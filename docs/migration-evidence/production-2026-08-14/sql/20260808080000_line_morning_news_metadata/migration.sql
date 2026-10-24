-- Additive: morning news metadata + ingest run audit (rollback = DROP columns / table)
-- Does not rename/delete existing columns or rewrite seed data.

ALTER TABLE "line_morning_news_items" ADD COLUMN "source_id" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "fetched_at" TIMESTAMP(3);
ALTER TABLE "line_morning_news_items" ADD COLUMN "content_hash" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "risk_labels" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "line_morning_news_items" ADD COLUMN "confidence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "line_morning_news_items" ADD COLUMN "species_tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "line_morning_news_items" ADD COLUMN "gate_reasons" TEXT NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX "line_morning_news_items_content_hash_key"
  ON "line_morning_news_items"("content_hash");
CREATE INDEX "line_morning_news_items_source_id_published_at_idx"
  ON "line_morning_news_items"("source_id", "published_at");

CREATE TABLE "line_morning_ingest_runs" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'fixture',
    "master_enabled" BOOLEAN NOT NULL,
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "passed_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "stale_count" INTEGER NOT NULL DEFAULT 0,
    "summary_json" TEXT NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_morning_ingest_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "line_morning_ingest_runs_created_at_idx"
  ON "line_morning_ingest_runs"("created_at");
