-- Additive tier identity and commercial defaults.
-- Does not drop columns, rewrite history, or guess 0-tier / multi-tier packaging.
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "tier_sku" TEXT;
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "shopify_variant_id" TEXT;
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "shopify_sku" TEXT;
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "default_consignment_commission_mode" TEXT;
ALTER TABLE "ProductPriceTier" ADD COLUMN IF NOT EXISTS "default_consignment_commission_value" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductPriceTier_status_check'
  ) THEN
    ALTER TABLE "ProductPriceTier"
      ADD CONSTRAINT "ProductPriceTier_status_check"
      CHECK ("status" IN ('active', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductPriceTier_status_idx" ON "ProductPriceTier"("status");
CREATE INDEX IF NOT EXISTS "ProductPriceTier_shopify_variant_id_idx" ON "ProductPriceTier"("shopify_variant_id");

-- Active bindings must be unique. Archived rows may keep a previous id.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductPriceTier_active_shopify_variant_id_key"
  ON "ProductPriceTier" ("shopify_variant_id")
  WHERE "shopify_variant_id" IS NOT NULL AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPriceTier_active_tier_sku_fold_key"
  ON "ProductPriceTier" (lower(btrim("tier_sku")))
  WHERE "tier_sku" IS NOT NULL AND btrim("tier_sku") <> '' AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPriceTier_active_shopify_sku_fold_key"
  ON "ProductPriceTier" (lower(btrim("shopify_sku")))
  WHERE "shopify_sku" IS NOT NULL AND btrim("shopify_sku") <> '' AND "status" = 'active';
