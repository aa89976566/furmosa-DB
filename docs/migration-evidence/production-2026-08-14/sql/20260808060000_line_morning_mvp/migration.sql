-- LINE Morning MVP (additive, rollback = DROP these tables)
-- Does not alter existing columns or seed data.

CREATE TABLE "line_morning_preferences" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "content_mode" TEXT NOT NULL DEFAULT 'unset',
    "frequency" TEXT NOT NULL DEFAULT 'unset',
    "paused_at" TIMESTAMP(3),
    "prompted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_preferences_line_user_id_key" ON "line_morning_preferences"("line_user_id");
CREATE INDEX "line_morning_preferences_frequency_content_mode_idx" ON "line_morning_preferences"("frequency", "content_mode");
CREATE INDEX "line_morning_preferences_customer_id_idx" ON "line_morning_preferences"("customer_id");

CREATE TABLE "line_morning_contents" (
    "id" TEXT NOT NULL,
    "stable_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'joke',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "body" TEXT NOT NULL,
    "pet_tags" TEXT NOT NULL DEFAULT '[]',
    "cooldown_days" INTEGER NOT NULL DEFAULT 14,
    "last_used_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_contents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_contents_stable_id_key" ON "line_morning_contents"("stable_id");
CREATE INDEX "line_morning_contents_status_kind_idx" ON "line_morning_contents"("status", "kind");

CREATE TABLE "line_morning_news_items" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'global',
    "risk_level" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fact_summary" TEXT NOT NULL,
    "bark_line" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_news_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_news_items_fingerprint_key" ON "line_morning_news_items"("fingerprint");
CREATE INDEX "line_morning_news_items_status_published_at_idx" ON "line_morning_news_items"("status", "published_at");
CREATE INDEX "line_morning_news_items_region_status_idx" ON "line_morning_news_items"("region", "status");

CREATE TABLE "line_morning_deliveries" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "campaign_key" TEXT NOT NULL,
    "taipei_date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "skip_reason" TEXT,
    "content_kind" TEXT,
    "content_id" TEXT,
    "news_item_id" TEXT,
    "slot_minute" INTEGER NOT NULL DEFAULT 0,
    "rendered_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_morning_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_deliveries_line_user_id_campaign_key_taipei_date_key"
  ON "line_morning_deliveries"("line_user_id", "campaign_key", "taipei_date");
CREATE INDEX "line_morning_deliveries_taipei_date_status_idx" ON "line_morning_deliveries"("taipei_date", "status");
CREATE INDEX "line_morning_deliveries_line_user_id_created_at_idx" ON "line_morning_deliveries"("line_user_id", "created_at");

ALTER TABLE "line_morning_deliveries"
  ADD CONSTRAINT "line_morning_deliveries_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "line_morning_contents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "line_morning_deliveries"
  ADD CONSTRAINT "line_morning_deliveries_news_item_id_fkey"
  FOREIGN KEY ("news_item_id") REFERENCES "line_morning_news_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "line_morning_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "master_enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_quota" INTEGER NOT NULL DEFAULT 100,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "line_morning_settings" ("id", "master_enabled", "daily_quota", "updated_at")
VALUES ('default', false, 100, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
