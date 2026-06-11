-- 開戶／存罐提示節流：24 小時內不重複主動詢問
ALTER TABLE "LineMenuState" ADD COLUMN IF NOT EXISTS "lastRegisterPromptAt" TIMESTAMP(3);
ALTER TABLE "LineMenuState" ADD COLUMN IF NOT EXISTS "lastJarPromptAt" TIMESTAMP(3);
