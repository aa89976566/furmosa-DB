-- 合作美容院主檔 + 核銷專屬 token
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "secret_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

INSERT INTO "stores" ("id", "name", "slug", "secret_token", "created_at", "updated_at") VALUES
  ('store_zhuwo_zhonghe', '豬窩 中和店', 'zhuwo_zhonghe', '8k2m1x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_banqiao', '豬窩 板橋店', 'zhuwo_banqiao', '4f9d7k', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_zhuwo_tucheng', '豬窩 土城店', 'zhuwo_tucheng', '7p3n8q', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_niuniu', '妞妞寵物美容', 'niuniu', '5w9r2t', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('store_pet99', '99寵物美容', 'pet99', '6h4j1k', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
