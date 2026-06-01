-- 換罐計畫開戶店家（LINE 開戶時選填）
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "signup_store" TEXT;
