-- 所有魚類凍乾（品名含「魚」與「凍乾」）：移除誤建 1g，補上「1 條」規格

DELETE FROM "ProductPriceTier" t
USING "Product" p
WHERE t."productId" = p."id"
  AND p."category" = 'freeze_dried'
  AND p."name" LIKE '%魚%'
  AND p."name" LIKE '%凍乾%'
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
  'cmfishstrip' || substr(md5(p."id"), 1, 11),
  p."id",
  NULL,
  '條',
  1,
  GREATEST(1, ROUND(ref."price" * 58.0 / 174.0)),
  GREATEST(1, ROUND(COALESCE(NULLIF(ref."cost", 0), ref."price") * 10.0 / 75.0)),
  '單條'
FROM "Product" p
INNER JOIN LATERAL (
  SELECT t."price", t."cost"
  FROM "ProductPriceTier" t
  WHERE t."productId" = p."id"
    AND t."weightGrams" IS NOT NULL
    AND t."weightGrams" > 0
  ORDER BY t."weightGrams" ASC
  LIMIT 1
) ref ON TRUE
WHERE p."category" = 'freeze_dried'
  AND p."name" LIKE '%魚%'
  AND p."name" LIKE '%凍乾%'
  AND NOT EXISTS (
    SELECT 1
    FROM "ProductPriceTier" t2
    WHERE t2."productId" = p."id"
      AND t2."weightGrams" IS NULL
      AND t2."unit" = '條'
      AND t2."unitQty" = 1
  );

UPDATE "Product" p
SET
  "price" = anchor."price",
  "cost" = COALESCE(anchor."cost", p."cost"),
  "unit" = CASE
    WHEN anchor."weightGrams" IS NOT NULL AND anchor."weightGrams" > 0 THEN
      CASE WHEN anchor."unit" IN ('g', '克') THEN 'g' ELSE anchor."unit" END
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
  WHERE p2."category" = 'freeze_dried'
    AND p2."name" LIKE '%魚%'
    AND p2."name" LIKE '%凍乾%'
  ORDER BY t."productId", t."price" ASC
) AS anchor
WHERE p."id" = anchor."productId";
