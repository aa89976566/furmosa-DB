-- Backfill product vendors only where the product still has no vendor.
-- Evidence comes from the legacy vendor price sheet and purchase records.
-- Existing vendor assignments are intentionally never overwritten.
WITH product_vendor_map(product_name, vendor_name) AS (
  VALUES
    ('丁香魚凍乾', '寵物村'),
    ('牛肉凍乾', '寵物村'),
    ('雞肉凍乾', '寵物村'),
    ('水晶魚凍乾', '寵物村'),
    ('鴨喉嚨', '飽管家'),
    ('豬耳朵條', 'Nibo'),
    ('蔬果凍乾', '寵物村'),
    ('鴨肉蘋果', '匠寵'),
    ('◈ 狗屎運 ◈ 黃金條｜牛肉地瓜 30g', '匠寵')
)
UPDATE "Product" AS product
SET
  "vendorId" = vendor.id,
  "updatedAt" = CURRENT_TIMESTAMP
FROM product_vendor_map AS mapping
JOIN "Vendor" AS vendor ON vendor.name = mapping.vendor_name
WHERE product."vendorId" IS NULL
  AND product.name = mapping.product_name;
