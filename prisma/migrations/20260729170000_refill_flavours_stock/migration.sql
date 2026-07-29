-- CreateTable
CREATE TABLE IF NOT EXISTS "refill_flavours" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight_grams" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refill_flavours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refill_flavours_code_key" ON "refill_flavours"("code");
CREATE INDEX IF NOT EXISTS "refill_flavours_is_active_sort_order_idx" ON "refill_flavours"("is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "merchant_refill_stocks" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "flavour_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_refill_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_refill_stocks_store_id_flavour_id_key" ON "merchant_refill_stocks"("store_id", "flavour_id");
CREATE INDEX IF NOT EXISTS "merchant_refill_stocks_flavour_id_idx" ON "merchant_refill_stocks"("flavour_id");
CREATE INDEX IF NOT EXISTS "merchant_refill_stocks_store_id_is_available_idx" ON "merchant_refill_stocks"("store_id", "is_available");

CREATE TABLE IF NOT EXISTS "refill_stock_txns" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "flavour_id" TEXT NOT NULL,
    "change_qty" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refill_stock_txns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "refill_stock_txns_store_id_created_at_idx" ON "refill_stock_txns"("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "refill_stock_txns_flavour_id_created_at_idx" ON "refill_stock_txns"("flavour_id", "created_at");

CREATE TABLE IF NOT EXISTS "refill_plan_settings" (
    "id" TEXT NOT NULL,
    "hero_image_url" TEXT,
    "first_jar_price" INTEGER NOT NULL DEFAULT 129,
    "exchange_price" INTEGER NOT NULL DEFAULT 99,
    "points_per_jar" INTEGER NOT NULL DEFAULT 1,
    "points_for_discount" INTEGER NOT NULL DEFAULT 10,
    "discount_amount" INTEGER NOT NULL DEFAULT 200,
    "flavour_update_note" TEXT NOT NULL DEFAULT '每兩週更新',
    "period_started_at" TIMESTAMP(3),
    "period_ended_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refill_plan_settings_pkey" PRIMARY KEY ("id")
);

-- FKs (idempotent-ish)
DO $$ BEGIN
  ALTER TABLE "merchant_refill_stocks"
    ADD CONSTRAINT "merchant_refill_stocks_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "merchant_refill_stocks"
    ADD CONSTRAINT "merchant_refill_stocks_flavour_id_fkey"
    FOREIGN KEY ("flavour_id") REFERENCES "refill_flavours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_stock_txns"
    ADD CONSTRAINT "refill_stock_txns_flavour_id_fkey"
    FOREIGN KEY ("flavour_id") REFERENCES "refill_flavours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed settings + 7 flavours
INSERT INTO "refill_plan_settings" ("id", "hero_image_url", "first_jar_price", "exchange_price", "points_per_jar", "points_for_discount", "discount_amount", "flavour_update_note", "period_started_at", "updated_at")
VALUES ('default', '/images/refill-plan/refill-flavours.jpg', 129, 99, 1, 10, 200, '每兩週更新', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "hero_image_url" = EXCLUDED."hero_image_url",
  "first_jar_price" = EXCLUDED."first_jar_price",
  "exchange_price" = EXCLUDED."exchange_price",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "refill_flavours" ("id", "code", "name", "weight_grams", "is_active", "sort_order", "available_from", "created_at", "updated_at")
VALUES
  ('rf_veggie', 'veggie-25', '蔬果凍乾', 25, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_beef', 'beef-20', '牛肉凍乾', 20, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_chicken', 'chicken-20', '雞肉凍乾', 20, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_crystal_fish', 'crystal-fish-10', '水晶魚凍乾', 10, true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_anchovy', 'anchovy-15', '丁香魚凍乾', 15, true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_duck_throat', 'duck-throat-15', '鴨喉嚨凍乾', 15, true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rf_pig_ear', 'pig-ear-30', '豬耳朵凍乾', 30, true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "weight_grams" = EXCLUDED."weight_grams",
  "is_active" = true,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;
