-- Phase 0 效能優化：Order.merchantId / Order.customerId 補索引
-- 用途：Dashboard 寄賣店排行 groupBy(merchantId)、店家/客戶詳情頁依 id 撈訂單，
--       目前缺索引，資料量增加後會是最先變慢的查詢。
CREATE INDEX IF NOT EXISTS "Order_merchantId_idx" ON "Order"("merchantId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
