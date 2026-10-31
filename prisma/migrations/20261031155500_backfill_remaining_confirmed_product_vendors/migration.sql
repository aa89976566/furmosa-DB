-- Add the confirmed supplier represented by the existing Monster Tribe product.
-- Keep this idempotent so a manually-created vendor is reused instead of duplicated.
INSERT INTO "Vendor" (
  "id",
  "vendorId",
  "name",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'vendor-monster-tribe',
  'VEND-0008',
  '怪獸部落',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Vendor"
  WHERE "name" = '怪獸部落'
);

-- Backfill only products that still have no vendor. Existing assignments are preserved.
WITH product_vendor_map(product_name, vendor_name) AS (
  VALUES
    ('QIQI｜雞肉凍乾', 'QiQi天然寵食'),
    ('怪獸部落 無膠鮮肉煲｜鮮雞絲 80g', '怪獸部落'),
    ('換罐-雞肉凍乾（測試）', '寵物村')
)
UPDATE "Product" AS product
SET
  "vendorId" = vendor.id,
  "updatedAt" = CURRENT_TIMESTAMP
FROM product_vendor_map AS mapping
JOIN "Vendor" AS vendor ON vendor.name = mapping.vendor_name
WHERE product."vendorId" IS NULL
  AND product.name = mapping.product_name;
