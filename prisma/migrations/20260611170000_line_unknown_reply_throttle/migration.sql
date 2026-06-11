-- 「看不懂」自動回覆：24 小時內不重複
ALTER TABLE "LineMenuState" ADD COLUMN IF NOT EXISTS "lastUnknownReplyAt" TIMESTAMP(3);
