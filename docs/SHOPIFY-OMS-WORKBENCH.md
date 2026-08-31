# OMS 第四階段：訂單工作台

目前為本機程式變更，未部署、未連正式資料庫。仍非完整 OMS 驗收版本。

## 這次變更

- `app/(main)/orders/page.tsx`：新訂單、待審核、有問題、可出貨、待出貨、已出貨篩選；保留來源/搜尋條件；切換篩選重設頁碼；超過總頁數時使用有效頁碼查資料。
- `lib/orders/oms-workbench.ts`：共用唯讀查詢與台灣日期邊界。已納入 OMS 的取消/退款訂單不再被舊的 activeOrderWhere 隱藏；非 OMS 的歷史篩選維持原樣。
- `components/orders/oms-dashboard.tsx`、`app/(main)/dashboard/page.tsx`：沿用卡片與區塊元件，在首頁新增今日新訂單、待審核、有問題、待出貨，以及最早十筆需要處理的訂單連結。
- `components/orders/order-list-table.tsx`：優先顯示 Shopify 訂單號，原 HQ 編號仍保留在資料中。
- `lib/orders/__tests__/oms-workbench.test.ts`：新增五項唯讀查詢契約測試。

## 數字定義

- 今日新訂單：台灣 UTC+8 今日下單的所有 OMS 訂單，包含已處理訂單，並非今天才補入 HQ 的歷史訂單。
- 待審核：NEW + REVIEW。
- 有問題：未檢查、旗標為 null、或旗標非空；含黃燈提醒，不只紅燈阻擋。
- 待出貨：FULFILLMENT_PENDING，只代表 HQ 內部出貨單，不代表供應商已收件。
- 數字會重疊，不能相加當成訂單總數。
- 既有來源金額卡片維持原本統計範圍，並非跟著 OMS 篩選重新計算。
- 需要你處理：NEW、REVIEW、READY 或有問題的訂單，按最早下單排序，最多十筆。

## 驗證與未完成

- Shopify、orders 與既有搜尋測試共 65 項通過；新增五項涵蓋階段、異常、台灣跨日/跨年、連結保留條件及搜尋合併。
- 測試為純函式/交易替身；尚未以實際 PostgreSQL 驗證 JSON 查詢，也未進行瀏覽器畫面驗收。
- 沒有新增 schema、migration 或依賴；沒有 build、資料匯入、backfill、git push 或部署。
- 仍需處理多規格商品、完整自動檢查、Shopify reconcile/失敗重試、物流與 fulfillment 同步。
- Preview 尚待確認實際部署分支與隔離測試資料庫。重新部署 Vercel 不等於已隔離資料庫，不應拿正式 DB 驗收此版本。
