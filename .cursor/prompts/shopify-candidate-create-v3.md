# Shopify Catalog Candidate CREATE v3（凍結版）

Base: `feat/shopify-candidate-resolution-v2` @ `44070c3f4a41705cace585bc981c4809dbf95aad`，以 stacked Draft PR 交付。

## 目標

HQ admin 在 Candidate 詳情頁一次處理一個 `pending` candidate：

- 同 Shopify parent 無 HQ claim：同一交易建立 draft Product + 一個 ProductPriceTier。
- 同 parent 恰一個 HQ Product claim：只新增 Tier 到該 Product。
- 同交易 CAS Candidate 為 `created` 並寫 StatusAuditLog。

Shopify 只提供 identity、名稱、SKU、售價、status；HQ 人員只提供分類、實際規格與真實整包成本。建立商品不入庫、不改 Shopify、不解除訂單阻擋。

## 白名單

- `.cursor/prompts/shopify-candidate-create-v3.md`
- `app/(main)/products/shopify-candidates/actions.ts`
- `app/(main)/products/shopify-candidates/[id]/page.tsx`
- `app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx`
- `lib/shopify/catalog-candidate-create.ts`
- `lib/shopify/__tests__/catalog-candidate-create.test.ts`
- `lib/shopify/__tests__/catalog-candidate-pages.test.ts`
- `lib/shopify/__tests__/catalog-candidates-page.test.ts`
- `lib/products/product-id.ts`
- `lib/products/__tests__/product-id.test.ts`
- `app/(main)/products/actions.ts`（僅抽出並共用 productId allocator）

白名單外需求必須停止回報。

## 禁止範圍

- 不改 schema、migration、package、auth、deploy。
- 不碰庫存、採購、供應商、訂單、issue、READY、shipment。
- 不寫 Shopify、不批次建立 siblings、不從文字猜重量／單位／成本。
- 不以 0、null 或售價比例代表未知成本。
- 不操作 Production、不 merge、不部署。

## 安全規則

- Client 只送 candidateId、expectedFingerprint、category、mode、cost、weightGrams 或 unit+unitQty。
- Server 重新驗證 admin，並從 live Shopify 重讀所有 Shopify 欄位。
- cost 必填、finite、>0；重量為正整數；unit 使用既有受控選項。
- 一個 Prisma Serializable transaction 內，先以 shop domain + parent GID 取得 PostgreSQL transaction-scoped advisory lock，再重讀 Candidate、siblings、claims 與 fingerprint。
- parent claim 數為 0 時建 Product+Tier，為 1 時只建 Tier，>1 時 fail closed。
- SKU、variant identity、同 Product 規格必須唯一。
- Candidate `pending -> created` 使用 updateMany CAS；Product/Tier/Candidate/audit 任一步失敗皆 rollback。
- inputDigest 由 server canonical payload 產生。相同 completed CREATE 只有 linked IDs、唯一 audit、digest 全一致時回原結果；不同 payload 或 audit 異常拒絕。
- 新 Product 為 draft、productCategory STANDARD、vendor null、reorderPoint 0；Product/Tier 成本依既有口徑明確寫入。新增 sibling Tier 不覆寫 Product base 欄位。

## UX

- Shopify 名稱、規格、SKU、售價唯讀；不向一般使用者顯示 GID/fingerprint。
- 首規格顯示「建立商品與這個規格」；已有唯一 parent claim 時顯示「新增這個規格」。
- 必填只包含：首次建立的分類、規格方式、整包進貨成本、重量或數量／單位。
- 固定提示：「只建立商品資料；庫存維持 0，收到貨後另走採購入庫或盤點。」
- 確認摘要顯示名稱、規格、SKU、售價、整包成本、庫存 0、Shopify 不修改、訂單阻擋不自動解除。
- 所有錯誤都明說未建立商品、未增加庫存。

## 驗收與測試

- 首次建立恰好 1 Product + 1 Tier + 1 Candidate decision + 1 audit。
- sibling 只新增 Tier；多 parent claims、stale、重複、無權限、非法輸入皆 0 writes。
- 相同重送不新增資料；不同 payload 拒絕；同 candidate／同 parent 併發不重複建立。
- 驗證 weight 與 unit 成本口徑；確認沒有 inventory/order/Shopify side effects。
- LINK、DO_NOT、candidate grouping 回歸。
- 執行限定測試、既有 catalog candidate 測試與完整 typecheck；真實併發與 rollback 在隔離 Preview DB 完成前不得 merge。

## 回復

Revert v3 commit 即可回到 v2；不得硬刪 audit 或正式歷史資料。此工作只建立 stacked Draft PR。
