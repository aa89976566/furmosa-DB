-- 補建／啟用「豬窩 板橋店」
-- 前一版若 MER-0019 已被其他店家占用，INSERT 會被跳過導致下拉缺板橋

DO $$
DECLARE
  target_name text := '豬窩 板橋店';
  preferred_mer text := 'MER-0019';
  row_id text;
  row_mer text;
  next_n int;
  use_mer text;
  new_row_id text;
BEGIN
  -- 1) 已有同名（含常見變體）→ 強制啟用並正規化
  SELECT m."id", m."merchantId"
    INTO row_id, row_mer
  FROM "Merchant" m
  WHERE m."name" = target_name
     OR m."name" IN ('豬窩板橋店', '豬窩-板橋店')
     OR (m."name" LIKE '%豬窩%' AND m."name" LIKE '%板橋%')
  ORDER BY CASE WHEN m."name" = target_name THEN 0 ELSE 1 END
  LIMIT 1;

  IF row_id IS NOT NULL THEN
    UPDATE "Merchant"
    SET
      "name" = target_name,
      "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
      "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
      "type" = 'consignment',
      "status" = 'active',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = row_id;
  ELSE
    -- 2) 尚無板橋：優先用 MER-0019；若被占用則改用下一個空號
    IF NOT EXISTS (SELECT 1 FROM "Merchant" WHERE "merchantId" = preferred_mer) THEN
      use_mer := preferred_mer;
    ELSE
      SELECT COALESCE(MAX(CAST(SUBSTRING("merchantId" FROM 5) AS int)), 0) + 1
        INTO next_n
      FROM "Merchant"
      WHERE "merchantId" ~ '^MER-[0-9]+$';
      use_mer := 'MER-' || LPAD(next_n::text, 4, '0');
    END IF;

    new_row_id := 'merchant_zhuwo_banqiao';
    IF EXISTS (SELECT 1 FROM "Merchant" WHERE "id" = new_row_id) THEN
      new_row_id := 'merchant_zhuwo_banqiao_' || substr(md5(use_mer || clock_timestamp()::text), 1, 10);
    END IF;

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
    ) VALUES (
      new_row_id,
      use_mer,
      target_name,
      'consignment',
      ARRAY['consignment', 'jar_exchange']::TEXT[],
      '新北',
      0.30,
      'active',
      '[來源] 豬窩分店同步（補建板橋店）',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;

  -- 3) 三間分店一律維持 active（避免中和／土城被誤停用）
  UPDATE "Merchant"
  SET
    "status" = 'active',
    "types" = ARRAY['consignment', 'jar_exchange']::TEXT[],
    "type" = 'consignment',
    "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北'),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "name" IN ('豬窩 中和店', '豬窩 板橋店', '豬窩 土城店');
END $$;

-- LINE 核銷店家：確保板橋（與另外兩間）存在
INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at")
VALUES
  ('store_zhuwo_zhonghe', '豬窩 中和店', 'zhuwo_zhonghe', '8k2m1x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_banqiao', '豬窩 板橋店', 'zhuwo_banqiao', '4f9d7k', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_tucheng', '豬窩 土城店', 'zhuwo_tucheng', '7p3n8q', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = CURRENT_TIMESTAMP;
