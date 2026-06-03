-- 換罐計畫：淡水妞妞、曼利莎寵物美容
-- 1) 合作店家主檔（LINE 開戶 / 折價券核銷）
-- 2) 寄賣店家類型加上 jar_exchange

UPDATE "stores"
SET "name" = '淡水妞妞', "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'niuniu';

INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
VALUES ('store_manlisa', '曼利莎寵物美容', 'manlisa', '7m2n9p', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "Merchant"
SET
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment'
WHERE "name" = '淡水妞妞';

UPDATE "Merchant"
SET
  "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
  "type" = 'consignment'
WHERE "name" LIKE '曼利莎%'
   OR "name" LIKE '曼莉莎%';
