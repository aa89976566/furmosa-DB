-- 唯讀上線前健檢：任何查詢有結果都先人工確認，不要自動修正。

-- 同一 Shopify Variant 不可同時綁在多個 HQ 規格。
SELECT "shopify_variant_id", COUNT(*) AS tier_count
FROM "ProductPriceTier"
WHERE "shopify_variant_id" IS NOT NULL
GROUP BY "shopify_variant_id"
HAVING COUNT(*) > 1;

-- 候選本身已有唯一限制；此查詢同時驗證正式資料未漂移。
SELECT "shopify_variant_id", COUNT(*) AS candidate_count
FROM "shopify_catalog_candidates"
GROUP BY "shopify_variant_id"
HAVING COUNT(*) > 1;

-- 已連結候選必須同時有商品與規格。
SELECT "id", "shopify_variant_id", "linked_product_id", "linked_tier_id"
FROM "shopify_catalog_candidates"
WHERE "resolution" = 'linked'
  AND ("linked_product_id" IS NULL OR "linked_tier_id" IS NULL);
