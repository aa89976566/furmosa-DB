-- 將已標記換罐的寄賣店家同步至核銷店家主檔（stores）
INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
SELECT
  'store_' || LOWER(REPLACE(m."merchantId", '-', '_')),
  m."name",
  LOWER(REPLACE(m."merchantId", '-', '_')),
  SUBSTRING(MD5(m."id" || m."merchantId") FROM 1 FOR 6),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Merchant" m
WHERE m."status" = 'active'
  AND 'jar_exchange' = ANY(m."types")
  AND NOT EXISTS (
    SELECT 1 FROM "stores" s
    WHERE s."slug" = LOWER(REPLACE(m."merchantId", '-', '_'))
       OR LOWER(s."name") = LOWER(m."name")
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;
