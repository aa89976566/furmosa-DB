-- 此訂閱專屬的盒內內容（未設定則沿用方案）
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "customContents" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "customBonus" TEXT;
