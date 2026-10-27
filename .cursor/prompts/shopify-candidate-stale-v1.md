# Shopify candidate stale reconciliation v1

Base commit: `1ed9fc2a917e0ec8e87fe578e56fcc96f2ae0925`

## 目標

修正 Shopify 待建商品清單只 upsert 本次資料、未結案舊 pending 候選的問題。完整登記後，pending 清單必須只保留本次 `unmatchedShopifyVariants`；歷史資料不得刪除。

## 允許修改

- `lib/shopify/catalog-sync-service.ts`
- `lib/shopify/__tests__/catalog-sync-service.test.ts`

## 禁止範圍

- 不改 Prisma schema 或 migration。
- 不改商品、庫存、成本、上架狀態或正式資料。
- 不改頁面、權限、Shopify fetch、部署設定或其他同步規則。
- 不新增套件、raw SQL、advisory lock 或環境變數。

## 邏輯

1. 將本次有 SKU 的 unmatched rows 依 `variantId` 排序並維持現有 upsert；update 分支只更新 Shopify 觀察欄位，不覆蓋 resolution、notes、resolvedAt、resolvedById。
2. 對本次 rows 中，只有被系統標記為 stale 或「不需 SKU」的 unavailable 候選恢復 pending；清除系統標記及結案欄位。人工 unavailable 不恢復。
3. 將不在本次有 SKU rows、且仍為 pending 的舊候選標記為 unavailable。用固定機器前綴標記；若有既有 notes 必須完整保留在前綴後。`resolvedById` 為 null。
4. 本次 rows 為 0 且資料庫仍有 pending 時，不執行 stale 結案。
5. 本次 blank-SKU variants 維持 unavailable，保留既有「不需 SKU」系統標記；不得刪資料。
6. 回傳與 audit metadata 加入實際 `closedCount` 與 `reopenedCount`，但不改 UI。

## 測試

- 83 pending／本次 61 rows 的核心不變量：本次之外不再 pending、無刪除。
- stale 結案保留人工 notes，resolvedById 不冒充操作人。
- 兩種系統標記可恢復 pending；人工 unavailable 不恢復。
- linked／created／blocked 不被覆蓋。
- 空快照保護不會把既有 pending 全結案。
- 同一份 plan 重跑冪等。
- variantId 格式沿用同一來源，不改寫身分。

## 驗收

- 相關單元測試通過。
- 完整 TypeScript typecheck 通過。
- git diff 只包含白名單檔案與本凍結 Prompt。
- 只建立 PR，不合併、不部署、不直接修正式資料。
