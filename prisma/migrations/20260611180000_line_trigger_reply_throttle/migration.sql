-- 觸發型回覆節流（JSON 記錄各類型最後回覆時間）
ALTER TABLE "LineMenuState" ADD COLUMN IF NOT EXISTS "triggerReplyAt" JSONB;
