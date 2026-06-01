-- 記錄每個 LINE 用戶最後一次收到主選單的時間（24h 內不重複發送選單）
CREATE TABLE IF NOT EXISTS "LineMenuState" (
    "lineUserId" TEXT NOT NULL,
    "lastMenuSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineMenuState_pkey" PRIMARY KEY ("lineUserId")
);
