-- 貝貝團購兩個 Shopify 方案正式納入 HQ 商品主檔。
-- 新訂單以 Variant ID 精確綁定；若 Shopify 重建 Variant，才以唯一 SKU 備援。
DO $$
DECLARE
  bundle_product_id TEXT;
  popular_tier_id TEXT;
  deluxe_tier_id TEXT;
BEGIN
  SELECT "id" INTO bundle_product_id
  FROM "Product"
  WHERE "sku" = 'FUR-0043'
  LIMIT 1;

  IF bundle_product_id IS NULL THEN
    bundle_product_id := 'bb_group_buy_bundle';
    INSERT INTO "Product" (
      "id", "productId", "sku", "sourceSku", "name", "category",
      "product_category", "unit", "price", "cost", "status",
      "default_temperature", "createdAt", "updatedAt"
    ) VALUES (
      bundle_product_id, 'PROD-BB-GROUP-BUY', 'FUR-0043', 'BB-BUNDLE',
      '貝貝團購好友限定優惠', 'other', 'STANDARD', '組', 319, 0,
      'active', 'ambient', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Product" WHERE "id" = bundle_product_id
      AND "name" <> '貝貝團購好友限定優惠'
  ) THEN
    RAISE EXCEPTION 'FUR-0043 已被其他商品使用，停止建立貝貝團購方案';
  END IF;

  SELECT "id" INTO popular_tier_id
  FROM "ProductPriceTier"
  WHERE "productId" = bundle_product_id
    AND (
      "shopify_variant_id" = '64613120082297'
      OR lower(btrim(COALESCE("shopify_sku", ''))) = 'bb-popular-set'
      OR lower(btrim(COALESCE("tier_sku", ''))) = 'bb-popular-set'
    )
  ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "id"
  LIMIT 1;

  IF popular_tier_id IS NULL THEN
    popular_tier_id := 'bb_bundle_popular';
    INSERT INTO "ProductPriceTier" (
      "id", "productId", "weightGrams", "unit", "unitQty", "price",
      "tier_sku", "shopify_variant_id", "shopify_sku", "status", "notes"
    ) VALUES (
      popular_tier_id, bundle_product_id, NULL, '組', 1, 319,
      'BB-POPULAR-SET', '64613120082297', 'BB-POPULAR-SET', 'active',
      '人氣款；組合內容：原味雞霸 ×3 片、豬耳朵片 30g ×1 份'
    );
  ELSE
    UPDATE "ProductPriceTier"
    SET "unit" = '組', "unitQty" = 1, "price" = 319,
        "tier_sku" = 'BB-POPULAR-SET',
        "shopify_variant_id" = '64613120082297',
        "shopify_sku" = 'BB-POPULAR-SET', "status" = 'active',
        "notes" = '人氣款；組合內容：原味雞霸 ×3 片、豬耳朵片 30g ×1 份'
    WHERE "id" = popular_tier_id;
  END IF;

  SELECT "id" INTO deluxe_tier_id
  FROM "ProductPriceTier"
  WHERE "productId" = bundle_product_id
    AND (
      "shopify_variant_id" = '64613120115065'
      OR lower(btrim(COALESCE("shopify_sku", ''))) = 'bb-deluxe-set'
      OR lower(btrim(COALESCE("tier_sku", ''))) = 'bb-deluxe-set'
    )
  ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "id"
  LIMIT 1;

  IF deluxe_tier_id IS NULL THEN
    deluxe_tier_id := 'bb_bundle_deluxe';
    INSERT INTO "ProductPriceTier" (
      "id", "productId", "weightGrams", "unit", "unitQty", "price",
      "tier_sku", "shopify_variant_id", "shopify_sku", "status", "notes"
    ) VALUES (
      deluxe_tier_id, bundle_product_id, NULL, '組', 1, 339,
      'BB-DELUXE-SET', '64613120115065', 'BB-DELUXE-SET', 'active',
      '豪華款；組合內容：原味雞霸 ×3 片、豬蛋蛋 30g ×1 份'
    );
  ELSE
    UPDATE "ProductPriceTier"
    SET "unit" = '組', "unitQty" = 1, "price" = 339,
        "tier_sku" = 'BB-DELUXE-SET',
        "shopify_variant_id" = '64613120115065',
        "shopify_sku" = 'BB-DELUXE-SET', "status" = 'active',
        "notes" = '豪華款；組合內容：原味雞霸 ×3 片、豬蛋蛋 30g ×1 份'
    WHERE "id" = deluxe_tier_id;
  END IF;

  UPDATE "Product"
  SET "sourceSku" = COALESCE("sourceSku", 'BB-BUNDLE'),
      "unit" = '組', "price" = 319, "status" = 'active',
      "default_temperature" = COALESCE("default_temperature", 'ambient'),
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = bundle_product_id;
END $$;
