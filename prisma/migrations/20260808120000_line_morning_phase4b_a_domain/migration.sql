-- Phase 4B-A domain contract (additive; rollback = DROP new columns / table)
-- Does not rename/delete existing columns, rewrite prefs, or invent consent.

-- News source-contract fields (nullable for existing rows)
ALTER TABLE "line_morning_news_items" ADD COLUMN "provider" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "item_id" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "license_type" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "license_url" TEXT;
ALTER TABLE "line_morning_news_items" ADD COLUMN "attribution" TEXT;

-- Animal fact library
CREATE TABLE "line_morning_animal_facts" (
    "id" TEXT NOT NULL,
    "stable_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "fact_summary" TEXT NOT NULL,
    "bark_line" TEXT,
    "pet_tags" TEXT NOT NULL DEFAULT '[]',
    "provider" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "license_type" TEXT NOT NULL,
    "license_url" TEXT,
    "attribution" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source_published_at" TIMESTAMP(3),
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "cooldown_days" INTEGER NOT NULL DEFAULT 30,
    "last_used_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_animal_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_animal_facts_stable_id_key"
  ON "line_morning_animal_facts"("stable_id");
CREATE UNIQUE INDEX "line_morning_animal_facts_content_hash_key"
  ON "line_morning_animal_facts"("content_hash");
CREATE INDEX "line_morning_animal_facts_status_last_used_at_idx"
  ON "line_morning_animal_facts"("status", "last_used_at");
CREATE INDEX "line_morning_animal_facts_provider_item_id_idx"
  ON "line_morning_animal_facts"("provider", "item_id");

-- Delivery FK for animal facts
ALTER TABLE "line_morning_deliveries" ADD COLUMN "animal_fact_id" TEXT;

CREATE INDEX "line_morning_deliveries_animal_fact_id_idx"
  ON "line_morning_deliveries"("animal_fact_id");

ALTER TABLE "line_morning_deliveries"
  ADD CONSTRAINT "line_morning_deliveries_animal_fact_id_fkey"
  FOREIGN KEY ("animal_fact_id") REFERENCES "line_morning_animal_facts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
