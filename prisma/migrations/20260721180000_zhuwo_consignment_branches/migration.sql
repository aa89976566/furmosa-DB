-- 豬窩三間分店：寄賣店家主檔補齊並與 LINE 核銷店家同步
-- 既有 MER-0016「豬窩」→「豬窩 中和店」；新增板橋／土城
-- LINE stores 維持 zhuwo_*；舊 mer_0016 綁定併入中和店

-- 1) MER-0016：單一「豬窩」改為中和店，並標記換罐
UPDATE "Merchant"
SET
  "name" = '豬窩 中和店',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "merchantId" = 'MER-0016'
  AND (
    "name" = '豬窩'
    OR "name" = '豬窩 中和店'
    OR "name" LIKE '豬窩%'
  );

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
  'merchant_zhuwo_zhonghe',
  'MER-0016',
  '豬窩 中和店',
  'consignment',
  ARRAY['consignment', 'jar_exchange']::TEXT[],
  '新北',
  0.30,
  'active',
  '[來源] 豬窩分店同步',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "merchantId" = 'MER-0016'
);

-- 2) 板橋店
UPDATE "Merchant"
SET
  "name" = '豬窩 板橋店',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '豬窩 板橋店'
   OR (
     "merchantId" = 'MER-0019'
     AND ("name" LIKE '豬窩%' OR "name" = '豬窩 板橋店')
   );

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
  '[來源] 豬窩分店同步',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "merchantId" = 'MER-0019' OR "name" = '豬窩 板橋店'
);

-- 3) 土城店
UPDATE "Merchant"
SET
  "name" = '豬窩 土城店',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment',
  "status" = 'active',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '豬窩 土城店'
   OR (
     "merchantId" = 'MER-0020'
     AND ("name" LIKE '豬窩%' OR "name" = '豬窩 土城店')
   );

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
  'merchant_zhuwo_tucheng',
  'MER-0020',
  '豬窩 土城店',
  'consignment',
  ARRAY['consignment', 'jar_exchange']::TEXT[],
  '新北',
  0.30,
  'active',
  '[來源] 豬窩分店同步',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Merchant" WHERE "merchantId" = 'MER-0020' OR "name" = '豬窩 土城店'
);

-- 4) LINE 核銷店家：確保三間分店存在（沿用既有 token）
INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
VALUES
  ('store_zhuwo_zhonghe', '豬窩 中和店', 'zhuwo_zhonghe', '8k2m1x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_banqiao', '豬窩 板橋店', 'zhuwo_banqiao', '4f9d7k', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_tucheng', '豬窩 土城店', 'zhuwo_tucheng', '7p3n8q', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;

-- 5) 舊版單一「豬窩」(mer_0016) 綁定併入中和店，避免選單重複
UPDATE "Customer"
SET
  "store_id" = 'zhuwo_zhonghe',
  "store_name" = '豬窩 中和店',
  "signup_store" = CASE
    WHEN "signup_store" = 'mer_0016' THEN 'zhuwo_zhonghe'
    ELSE "signup_store"
  END
WHERE "store_id" = 'mer_0016'
   OR "signup_store" = 'mer_0016';

UPDATE "coupons"
SET
  "store_id" = 'zhuwo_zhonghe',
  "store_name" = '豬窩 中和店'
WHERE "store_id" = 'mer_0016';

DELETE FROM "stores"
WHERE "slug" = 'mer_0016';
