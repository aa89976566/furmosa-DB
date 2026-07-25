-- Milestone A：Location × JarCode.productId × 庫存事件欄位
-- Program SKU 已由 Product.product_category = JAR_EXCHANGE 承擔（見 20260723130000）

-- 1) Customer 開戶 Location FK
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "signup_location_id" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_signup_location_id_idx" ON "Customer"("signup_location_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_signup_location_id_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_signup_location_id_fkey"
      FOREIGN KEY ("signup_location_id") REFERENCES "Merchant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) MerchantRedeemProfile（核銷／開戶投影）
CREATE TABLE IF NOT EXISTS "merchant_redeem_profiles" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "secret_token" TEXT NOT NULL,
  "grooming_discount_amount" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_redeem_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_redeem_profiles_merchant_id_key"
  ON "merchant_redeem_profiles"("merchant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_redeem_profiles_slug_key"
  ON "merchant_redeem_profiles"("slug");
CREATE INDEX IF NOT EXISTS "merchant_redeem_profiles_active_idx"
  ON "merchant_redeem_profiles"("active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_redeem_profiles_merchant_id_fkey'
  ) THEN
    ALTER TABLE "merchant_redeem_profiles"
      ADD CONSTRAINT "merchant_redeem_profiles_merchant_id_fkey"
      FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) JarCode 綁商品／存罐店快照
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "product_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "tier_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "redeemed_location_id" TEXT;

CREATE INDEX IF NOT EXISTS "jar_codes_product_id_idx" ON "jar_codes"("product_id");
CREATE INDEX IF NOT EXISTS "jar_codes_redeemed_location_id_idx" ON "jar_codes"("redeemed_location_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jar_codes_product_id_fkey'
  ) THEN
    ALTER TABLE "jar_codes"
      ADD CONSTRAINT "jar_codes_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jar_codes_redeemed_location_id_fkey'
  ) THEN
    ALTER TABLE "jar_codes"
      ADD CONSTRAINT "jar_codes_redeemed_location_id_fkey"
      FOREIGN KEY ("redeemed_location_id") REFERENCES "Merchant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 盡力回填：既有 product_sku → product_id
UPDATE "jar_codes" jc
SET "product_id" = p.id
FROM "Product" p
WHERE jc."product_sku" IS NOT NULL
  AND jc."product_id" IS NULL
  AND p.sku = jc."product_sku";

-- 4) MerchantStockTxn 事件欄
ALTER TABLE "MerchantStockTxn" ADD COLUMN IF NOT EXISTS "event_type" TEXT;
ALTER TABLE "MerchantStockTxn" ADD COLUMN IF NOT EXISTS "source_system" TEXT NOT NULL DEFAULT 'hq';
ALTER TABLE "MerchantStockTxn" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantStockTxn_idempotency_key_key"
  ON "MerchantStockTxn"("idempotency_key");
CREATE INDEX IF NOT EXISTS "MerchantStockTxn_event_type_createdAt_idx"
  ON "MerchantStockTxn"("event_type", "createdAt");

-- 既有 type 對應 event_type（僅填空）
UPDATE "MerchantStockTxn" SET "event_type" = 'restock_received' WHERE "type" = 'restock' AND "event_type" IS NULL;
UPDATE "MerchantStockTxn" SET "event_type" = 'store_sale' WHERE "type" = 'sale' AND "event_type" IS NULL;
UPDATE "MerchantStockTxn" SET "event_type" = 'adjust_count' WHERE "type" = 'adjust' AND "event_type" IS NULL;
UPDATE "MerchantStockTxn" SET "event_type" = 'return_to_hq' WHERE "type" = 'return' AND "event_type" IS NULL;
