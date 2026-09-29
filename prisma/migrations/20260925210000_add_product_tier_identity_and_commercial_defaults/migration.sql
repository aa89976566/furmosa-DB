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

-- Safe backfill: copy Product.sku onto the tier only when that product has exactly
-- one tier, the tier sku is still empty, and the case-folded sku hits no other tier.
-- 0-tier products have nothing to update. Multi-tier products are left for HQ.
WITH single_tier AS (
  SELECT p."id" AS product_id, p."sku" AS product_sku, MIN(t."id") AS tier_id
  FROM "Product" p
  JOIN "ProductPriceTier" t ON t."productId" = p."id"
  GROUP BY p."id", p."sku"
  HAVING COUNT(t."id") = 1
),
candidates AS (
  SELECT s.tier_id, s.product_sku, lower(btrim(s.product_sku)) AS folded
  FROM single_tier s
  JOIN "ProductPriceTier" t ON t."id" = s.tier_id
  WHERE t."tier_sku" IS NULL
    AND btrim(s.product_sku) <> ''
),
unique_fold AS (
  SELECT c.tier_id, c.product_sku
  FROM candidates c
  WHERE (
    SELECT COUNT(*) FROM candidates other WHERE other.folded = c.folded
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM "ProductPriceTier" existing
    WHERE existing."tier_sku" IS NOT NULL
      AND lower(btrim(existing."tier_sku")) = c.folded
      AND existing."id" <> c.tier_id
  )
)
UPDATE "ProductPriceTier" AS tier
SET "tier_sku" = unique_fold.product_sku
FROM unique_fold
WHERE tier."id" = unique_fold.tier_id
  AND tier."tier_sku" IS NULL;
