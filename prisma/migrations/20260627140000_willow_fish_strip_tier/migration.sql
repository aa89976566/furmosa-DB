-- 柳葉魚凍乾（FUR-0007）：移除誤建的 1g 規格，新增「1 條」售價規格，並修正主檔參考價

DELETE FROM "ProductPriceTier" t
USING "Product" p
WHERE t."productId" = p."id"
  AND p."sku" = 'FUR-0007'
  AND t."weightGrams" = 1;

INSERT INTO "ProductPriceTier" (
  "id",
  "productId",
  "weightGrams",
  "unit",
  "unitQty",
  "price",
  "cost",
  "notes"
)
SELECT
  'cmwillowfishstrip01',
  p."id",
  NULL,
  '條',
  1,
  58,
  10,
  '單條'
FROM "Product" p
WHERE p."sku" = 'FUR-0007'
  AND NOT EXISTS (
    SELECT 1
    FROM "ProductPriceTier" t
    WHERE t."productId" = p."id"
      AND t."weightGrams" IS NULL
      AND t."unit" = '條'
      AND t."unitQty" = 1
  );

UPDATE "Product" p
SET
  "price" = anchor."price",
  "cost" = COALESCE(anchor."cost", p."cost"),
  "unit" = CASE
    WHEN anchor."weightGrams" IS NOT NULL AND anchor."weightGrams" > 0 THEN 'g'
    ELSE anchor."unit"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (t."productId")
    t."productId",
    t."weightGrams",
    t."unit",
    t."price",
    t."cost"
  FROM "ProductPriceTier" t
  INNER JOIN "Product" p2 ON p2."id" = t."productId"
  WHERE p2."sku" = 'FUR-0007'
  ORDER BY t."productId", t."price" ASC
) AS anchor
WHERE p."id" = anchor."productId";
