-- 換罐計畫：柒沐寵物美容（MER-0014）
-- 1) 寄賣店家標記 jar_exchange
-- 2) 同步至 stores 表供 LINE 開戶／折價券核銷

UPDATE "Merchant"
SET
  "name" = '柒沐寵物美容',
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "merchantId" = 'MER-0014';

INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
SELECT
  'store_mer_0014',
  '柒沐寵物美容',
  'mer_0014',
  SUBSTRING(MD5(m."id" || m."merchantId") FROM 1 FOR 6),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Merchant" m
WHERE m."merchantId" = 'MER-0014'
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;
