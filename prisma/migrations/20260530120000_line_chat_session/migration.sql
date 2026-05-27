-- LINE 對話流程暫存（加入會員等多步驟）
CREATE TABLE "LineChatSession" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineChatSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineChatSession_lineUserId_key" ON "LineChatSession"("lineUserId");
