# Shopify 候選商品處理第一階段（凍結版）

## 目標

讓 HQ 管理員安全處理 Shopify 待建商品，不猜測規格、不自動入庫，也不覆寫既有 Shopify 身分。

## 本階段範圍

1. 候選清單每筆只有「處理／查看」入口，另提供處理狀態篩選。
2. 新增候選單筆處理頁，顯示唯讀 Shopify 快照。
3. 管理員可執行：
   - 連結現有商品規格。
   - 標記「不需建立」並選擇固定原因；原因為「其他」時備註必填。
4. 「建立新商品」只導向既有新增商品頁並帶入候選編號：
   - 只預填商品名稱。
   - Shopify 售價只作參考顯示。
   - 不把候選標記為 `created`。
   - 建立後由管理員回候選頁，使用「連結現有規格」完成綁定。
5. 只有資料庫中的最新 `admin` 角色可以寫入；其他角色唯讀。

## 連結規格的安全規則

1. 前端只提交 `candidateId`、`tierId`、`notes`。
2. 伺服器在同一筆 Prisma interactive transaction 內：
   - 重新讀取候選。
   - 以 `shopifyVariantId` 取得 `pg_advisory_xact_lock`。
   - 驗證候選仍為 `pending`。
   - 驗證規格與商品仍可用。
   - 驗證 Shopify Variant ID 與 SKU 沒有被其他規格使用。
   - Shopify identity 僅能補空值或保持相同值，絕不覆寫不同值。
   - 以 compare-and-set 將候選由 `pending` 改為 `linked`。
   - `linkedProductId` 必須由 `tier.productId` 推導。
   - 同一交易寫入既有稽核紀錄。
3. 明確設定 transaction `maxWait` 與 `timeout`。
4. 交易成功後才 revalidate；失敗不得留下半完成資料。

## 不需建立的規則

1. 只允許 `pending → blocked`。
2. 原因固定為：非販售品、贈品、組合包、測試商品、其他。
3. 原因與備註以固定格式保存於既有 `notes` 欄位。
4. 不修改 Product、ProductPriceTier、庫存或 Shopify。

## 明確排除

- 不修改 Prisma schema 或 migration。
- 不寫入 `created` 狀態。
- 不在候選流程建立 Product／ProductPriceTier。
- 不自動連結、批次處理或依名稱／SKU 猜測。
- 不推定重量、單位、數量、成本或庫存。
- 不回寫 Shopify。
- 不提供解除連結、復原或刪除候選。
- 不在交易內呼叫外部 API。

## 驗收

- 權限與直接呼叫防護。
- identity 只補不覆寫、SKU 不一致、其他規格已綁定。
- CAS、重送冪等與兩位管理員同時處理。
- 交易中途失敗完整回滾。
- blocked 原因驗證與 notes 格式。
- 庫存、成本與 Shopify 無副作用。
- 既有同步不重置已處理狀態。
- 桌機與手機皆可閱讀操作。

## 修改白名單

- `.cursor/prompts/shopify-candidate-actions-v1.md`
- `lib/shopify/catalog-candidate-resolution.ts`
- `lib/shopify/__tests__/catalog-candidate-resolution.test.ts`
- `lib/shopify/__tests__/catalog-candidate-pages.test.ts`
- `lib/shopify/__tests__/catalog-candidates-page.test.ts`（更新已被新流程取代的舊畫面契約）
- `app/(main)/products/shopify-candidates/page.tsx`
- `app/(main)/products/shopify-candidates/actions.ts`
- `app/(main)/products/shopify-candidates/[id]/page.tsx`
- `app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx`
- `app/(main)/products/new/page.tsx`
- `scripts/audit-shopify-candidates.sql`
