-- Customer: 永久綁定開戶店家
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "store_id" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "store_name" TEXT;

-- 既有會員：由 signup_store 回填 store_id / store_name
UPDATE "Customer"
SET
  "store_id" = "signup_store",
  "store_name" = CASE "signup_store"
    WHEN 'zhuwo_zhonghe' THEN '豬窩 中和店'
    WHEN 'zhuwo_banqiao' THEN '豬窩 板橋店'
    WHEN 'zhuwo_tucheng' THEN '豬窩 土城店'
    WHEN 'niuniu' THEN '妞妞寵物美容'
    WHEN 'pet99' THEN '99寵物美容'
    ELSE "store_name"
  END
WHERE "signup_store" IS NOT NULL AND ("store_id" IS NULL OR "store_name" IS NULL);

-- 美容院折價券
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "coupon_code" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "store_name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'grooming_250',
  "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 250,
  "points_used" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "redeemed_at" TIMESTAMP(3),
  "redeemed_store" TEXT,
  "redeemed_by" TEXT,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_coupon_code_key" ON "coupons"("coupon_code");
CREATE INDEX IF NOT EXISTS "coupons_user_id_status_idx" ON "coupons"("user_id", "status");
CREATE INDEX IF NOT EXISTS "coupons_store_id_status_idx" ON "coupons"("store_id", "status");
CREATE INDEX IF NOT EXISTS "coupons_status_expires_at_idx" ON "coupons"("status", "expires_at");

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
