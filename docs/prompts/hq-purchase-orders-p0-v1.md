# HQ 採購待收貨與盤點 P0 — Frozen implementation prompt v1

- Prompt version: `v1`
- Base commit: `431b69e9481352d2e1db3b5ff9b4944443712ec2`
- Branch: `feat/hq-purchase-receipts`
- Production: Railway `furmosa-hq`; Vercel 只作 PR Preview
- Migration plan: `standard`（僅 additive DDL；正式資料修正另走受控、具 guard 的操作）

## 目標

1. 建立「待收貨採購單」：保存供應商、單據、提醒日、採購品項、金額與附件；建立時庫存、平均成本與庫存流水必須零變更。
2. 提醒日到期後，在既有 HQ 今日工作介面顯示「查看並確認實收」。提醒以 Asia/Taipei 日曆日判斷，不需 cron。
3. P0 只支援整張完整收貨。確認後在同一個 SERIALIZABLE transaction 建立 PurchaseReceipt、每行 InventoryTransaction、更新 InventoryBalance 與 Product.averageCostPerGram，並把採購單標記 received。
4. 用 `PurchaseReceipt.purchaseOrderId @unique`、PO conditional status claim、每行 deterministic `InventoryTransaction.eventKey @unique` 與有限 serialization retry 保證雙擊／併發只入庫一次。
5. 新增 HQ 主倉盤點調整：記錄數量與總成本的 before/after/delta，建立不可變 InventoryTransaction，更新庫存與平均成本。豬蛋蛋目標為 300g、總成本 NT$420、平均 NT$1.4/g，但正式資料只可在部署成功後另走受控資料操作。

## P0 UX

- 不新增側欄、不大改設計。
- 庫存頁並列「新增進貨」「新增採購單」。
- 進貨紀錄內切換「已入庫」「待收貨」。
- 新增採購單頁固定提示：「建立採購單不會更新庫存。」
- 待收貨詳情固定顯示「尚未入庫」與附件；主操作是「確認實收」。
- 收貨確認必須逐項勾選；未全勾不可提交。伺服器端數量與成本只讀 PO lines，不接受 client 覆寫。
- 手機改垂直卡片、主要按鈕固定底部；桌機維持既有卡片／表格語言。
- 盤點由庫存商品列進入「調整庫存」，顯示盤點後數量、總成本、單位成本預覽與原因。

## 資料模型（additive only）

- `PurchaseOrder`: orderNumber unique、status (`pending_receipt|received|cancelled`)、vendor、warehouse、supplierDocumentNumber、remindFromDate、money totals、note、created/received/cancelled audit fields、timestamps。
- `PurchaseOrderItem`: product relation + name/SKU/unit snapshots、quantityGrams、rawAmount、line number unique per order。
- `PurchaseOrderAttachment`: DB Bytes，沿用既有安全限制與授權下載；invoice 不複製到 receipt。
- `PurchaseReceipt.purchaseOrderId` nullable unique relation。
- `StocktakeAdjustment`: eventKey unique、product/warehouse、before/after/delta quantity、before/after/delta total cost Decimal、reason、operator、inventoryTransaction unique、reversal relation、timestamp。
- 新表／欄位／索引／FK 全部 additive；不 drop/rename/backfill。

## 核心邏輯

- 採購單建立交易只能建立 PO、items、attachments；不得呼叫入庫 helper。
- 收貨 transaction：查既有 receipt → conditional claim pending→received → 建 receipt → 逐行 deterministic movement → atomic balance increment → Decimal moving average → commit。已存在 receipt 時回同一 receipt。
- 收貨後若某商品總庫存仍為負，整張 rollback；若由負數加到 0 或正數可允許。
- 金額與成本運算以 Prisma.Decimal／整數 cents；不得以 JS 浮點作最終帳務計算。
- 盤點以 immutable productId + warehouseId 執行；其他自有倉庫有非零存量時，不得用單一主倉盤點直接覆寫全域平均成本。
- 附件只允許 JPG/PNG/WebP/PDF，最多 3 個、每個 5MB，檢查 magic bytes，下載重新驗證 HQ session，no-store/nosniff。

## 白名單

- `prisma/schema.prisma`
- `prisma/migrations/20260929*_hq_purchase_orders_stocktake/**`
- `lib/inventory/**`
- `lib/taipei-date.ts`
- `lib/cache-tags.ts`
- `app/(main)/inventory/**`
- `app/(main)/dashboard/**`
- `components/orders/oms-dashboard.tsx`
- `lib/**/__tests__/*purchase-order*`
- `lib/**/__tests__/*stocktake*`
- 本 prompt 與同工作包 review 文件

禁止：認證／middleware、POS、Shopify OMS、LINE、付款、物流、部署 workflow、套件升級、無關 UI refactor、正式資料庫直接寫入。

## Merge 前驗收

- Prisma schema validate / generate。
- 建立 PO 不改 balance、average cost、InventoryTransaction。
- 提醒日在台灣日期前不顯示、當日零點起顯示；received/cancelled 不顯示。
- 收貨整單成功、重送回同 receipt、行 eventKey deterministic。
- 併發與中途失敗由真 PostgreSQL transaction test 驗證；若本地沒有隔離 DB，必須明確列為 Preview gate，不得假稱通過。
- 盤點精確保存 300g / NT$420 / 1.400000，重送零重複，完整 before/after/delta audit。
- 附件安全與跨單 404 regression。
- `npm run typecheck`、相關 tests、`git diff --check`。
- 獨立審查者逐檔檢查 diff 對照本 checklist。

## 不在 P0

- 草稿、部分到貨、多批收貨、短溢收、修改採購單、複雜取消、附件多版本、object storage、供應商管理、批次匯出、cron／推播催辦、stocktake approval workflow。

## Claude 決策摘要

- 採用：PO 與 Receipt 分離、DB Bytes 附件、整單收貨、conditional claim + unique constraints、stocktake typed audit、台灣日期查詢提醒。
- 部分採用：負庫存不是一律拒絕；僅在收貨後仍為負時整單拒絕。
- 不採用（P1）：object storage、partial receipt、feature flag、完整 cancel workflow；避免超出本輪。
