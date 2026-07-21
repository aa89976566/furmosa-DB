-- 補建／啟用「豬窩 板橋店」
-- 前一版若 MER-0019 已被其他店家占用，INSERT 會被跳過導致下拉缺板橋
-- 注意：避免 DO $$ 區塊（Prisma migrate 會誤切分號）

-- 1) 已有板橋相關店名 → 正規化並啟用
UPDATE "Merchant"
SET
  "name" = '豬窩 板橋店',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '豬窩 板橋店'
   OR "name" IN ('豬窩板橋店', '豬窩-板橋店')
   OR ("name" LIKE '%豬窩%' AND "name" LIKE '%板橋%');

-- 2a) MER-0019 空號 → 直接建立板橋店
INSERT INTO "Merchant" (
  "id",
  "merchantId",
  "name",
  "type",
  "types",
  "city",
  "commissionRate",
  "status",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  'merchant_zhuwo_banqiao',
  'MER-0019',
  '豬窩 板橋店',
  'consignment',
  ARRAY['consignment', 'jar_exchange']::TEXT[],
  '新北',
  0.30,
  'active',
  '[來源] 豬窩分店同步（補建板橋店）',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "name" = '豬窩 板橋店'
)
AND NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "merchantId" = 'MER-0019'
);

-- 2b) MER-0019 已被占用、且尚無板橋店 → 用下一個空號建立
INSERT INTO "Merchant" (
  "id",
  "merchantId",
  "name",
  "type",
  "types",
  "city",
  "commissionRate",
  "status",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  'merchant_zhuwo_banqiao_' || LPAD((
    SELECT COALESCE(MAX(CAST(SUBSTRING(m."merchantId" FROM 5) AS int)), 0) + 1
    FROM "Merchant" m
    WHERE m."merchantId" ~ '^MER-[0-9]+$'
  )::text, 4, '0'),
  'MER-' || LPAD((
    SELECT COALESCE(MAX(CAST(SUBSTRING(m."merchantId" FROM 5) AS int)), 0) + 1
    FROM "Merchant" m
    WHERE m."merchantId" ~ '^MER-[0-9]+$'
  )::text, 4, '0'),
  '豬窩 板橋店',
  'consignment',
  ARRAY['consignment', 'jar_exchange']::TEXT[],
  '新北',
  0.30,
  'active',
  '[來源] 豬窩分店同步（補建板橋店・改用空號）',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "name" = '豬窩 板橋店'
)
AND EXISTS (
  SELECT 1 FROM "Merchant" WHERE "merchantId" = 'MER-0019'
);

-- 3) 三間分店一律維持 active
UPDATE "Merchant"
SET
  "status" = 'active',
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('豬窩 中和店', '豬窩 板橋店', '豬窩 土城店');

-- 4) LINE 核銷店家：確保三間存在
INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
VALUES
  ('store_zhuwo_zhonghe', '豬窩 中和店', 'zhuwo_zhonghe', '8k2m1x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_banqiao', '豬窩 板橋店', 'zhuwo_banqiao', '4f9d7k', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_tucheng', '豬窩 土城店', 'zhuwo_tucheng', '7p3n8q', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;
