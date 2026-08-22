# POS 換罐交付後端

## 上線順序

1. 在測試資料庫執行 `20260823120000_refill_fulfillment_ledger` migration。
2. 產生新版 Prisma Client。
3. 執行換罐測試；確認「領 1 還 1」、「領 1 還 2」、「領 2 還 1」與重複提交。
4. 僅在測試環境執行 `npm run refill:seed-test`。
5. 測試通過後，才安排正式 migration 與部署。

## 交易邏輯

- POS 傳入領取數量與舊罐序號，價格由伺服器計算。
- 領取數量不可超過訂單剩餘數量。
- 有效舊罐數最多只折抵同次領取數；多出的空罐只記額外回收。
- 補款由官方 LINE／綠界完成，付款成功前不得交付。
- 完成交付、舊罐回收、門市扣庫存、庫存流水與稽核紀錄位於同一資料庫 transaction。
- 每次提交需帶 idempotency key，重送不會重複扣庫存。
- 新罐先記為 `pending_line_registration`，顧客稍後從官方 LINE 登記。

## 回復方式

- migration 上線前：直接撤回本次程式分支即可。
- migration 上線後：先將應用程式切回舊版；新表可保留為唯讀，不影響舊欄位。
- 如確定沒有任何新交付資料，才可另建反向 migration 移除新外鍵、新表與兩個訂單數量欄位。
- 不可在已有交付紀錄時直接刪表；需先匯出 `refill_fulfillments`、`refill_fulfillment_jars` 與相關庫存流水。
