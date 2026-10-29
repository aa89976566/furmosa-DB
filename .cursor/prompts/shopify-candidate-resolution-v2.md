# Shopify candidate resolution v2（凍結版）

Base commit: `3aca38ee729630d308f2d5e2a1c0a8162937f2bc`

## 目標

讓 HQ 管理員逐筆、安全處理 Shopify 待建商品。第一版只允許：

1. 以完全一致且唯一的 SKU，人工確認連結既有 HQ 規格。
2. 明確標記「這次不建立」，並保存原因與操作者。

「建立 HQ 商品／規格」只顯示為尚未開放，不可寫入。未知成本不得以 `0` 冒充，且本工作包不建立庫存、不改 Shopify、不解除訂單阻擋。

## 允許修改的確切檔案

- `.cursor/prompts/shopify-candidate-resolution-v2.md`
- `app/(main)/products/shopify-candidates/page.tsx`
- `app/(main)/products/shopify-candidates/actions.ts`
- `app/(main)/products/shopify-candidates/[id]/page.tsx`
- `app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx`
- `lib/shopify/catalog-candidate-resolution.ts`
- `lib/shopify/__tests__/catalog-candidate-resolution.test.ts`
- `lib/shopify/__tests__/catalog-candidate-pages.test.ts`
- `lib/shopify/__tests__/catalog-candidates-page.test.ts`

若完成安全邏輯需要其他檔案，停止並回報，不得自行擴大白名單。
白名單是上限，不要求每個檔案一定修改；不得為了湊白名單建立空殼。

## 禁止範圍

- 不改 Prisma schema、migration、資料庫結構或正式資料。
- 不建立 Product／ProductPriceTier，不寫 `created` resolution，不以 cost `0` 代表未知成本。
- 不改 price、cost、inventory、InventoryTransaction、訂單、blocking issue 或 READY 狀態。
- 不回寫 Shopify，不改 publish／active 狀態，不使用 Shopify inventory 初始化 HQ。
- 不做模糊比對、名稱／重量推測、自動連結、批次操作或「全部建立」。
- 不處理兩筆 HQ-only 鴨肺、不改 auth／middleware／package.json／部署設定。
- 不 merge、不部署、不連正式資料庫做寫入測試。

## 資料來源與安全邏輯

- Shopify 是 product/variant identity、SKU、名稱、售價與狀態來源；HQ 是成本、庫存與營運資料來源。
- 清單依 Shopify 商品分組，同商品所有目前候選規格要清楚列出；每次只處理一個 candidate。
- 詳情頁產生 deterministic expected fingerprint，至少包含 candidate id、shop domain、product/variant GID、normalized SKU、名稱、規格、price、status、lastSeenAt/current resolution 與 HQ claim set 摘要；form 只傳 fingerprint。Server 不信任 form 欄位，Apply 前重新讀取 Candidate、目前 Shopify catalog 與 HQ claims 並重算。Shopify GID、parent product、SKU、名稱、規格、售價或狀態有變，候選已不在目前 unmatched snapshot，或 fingerprint 不同，必須 fail closed、0 writes，請使用者重新整理。
- 只有恰好 1 筆 normalized SKU 完全一致、active、未綁其他 Shopify variant，且屬於已確認 HQ Product 的 tier，才可顯示 LINK 確認。0 筆或多於 1 筆都必須 fail closed、0 writes；多筆時不得讓操作者任選一筆繞過唯一性。
- LINK transaction 只可補上該 tier 的 Shopify identity，並以 compare-and-set 將 Candidate `pending -> linked`、寫入 linked product/tier、resolvedAt/resolvedBy，再在同一 transaction 寫 StatusAuditLog。不得覆寫不同 identity。
- 「這次不建立」reason 必填，固定選項為停售／測試商品／贈品或組合內容／不由 HQ 履約／其他；其他需備註。必須以 compare-and-set 將 Candidate `pending -> blocked`，同時寫入 reason notes、`resolvedAt`、由 HQ session 取得的 `resolvedById`，並在同一 transaction 寫 StatusAuditLog。已非 pending、reason 不合法、其他原因無備註、stale 或 audit 失敗均 0 writes。它不得解除任何訂單阻擋。
- `resolvedById` 與 audit actorId 一律由 server-side HQ session 取得，不接受 form/client 傳入；無 session 或無管理權限為 0 writes。
- 所有錯誤、stale、identity collision、affected row count 不符或 audit 寫入失敗都必須整筆 rollback。
- 重送同一已完成決策回傳既有結果，不可重複寫入或改變另一決策。

## UI 行為

- 沿用既有 PageHeader、Card、Button、Badge、Dialog／Sheet 風格；桌機與手機都能使用。
- 清單提供搜尋、狀態篩選、已處理進度，商品列顯示未處理規格數與「開始／繼續處理」。
- 單商品頁攤開全部規格；技術 GID 收在次要資訊，不搶主視覺。
- 每個 variant 顯示規格、SKU、Shopify 售價及 HQ 對應狀態。
- LINK 需左右對照 Shopify 規格與 HQ 規格，提示「不會修改價格、成本或庫存」。
- DO_NOT_CREATE 使用文字「這次不建立」，不稱「忽略」；明示不刪 Shopify、未對應訂單仍保持阻擋。
- CREATE 顯示 disabled，文字說明「需先確認成本與規格，下一階段開放」；不存在可成功呼叫的 create action/endpoint。
- 成功後更新該列；同商品只有所有 current candidates 都 resolved 才顯示完成。部分成功／部分失敗必須顯示部分完成。

## 測試

- LINK happy path：Candidate＋tier identity＋audit 同 transaction；price/cost/inventory/order 不變。
- LINK stale source/fingerprint、空白或不一致 SKU、0／多個 exact tier、tier 已綁、variant 被 claim、candidate 已處理、權限失敗：0 writes。
- LINK 重送冪等、兩個並發只有一個成功、audit failure 全回滾。
- DO_NOT_CREATE happy path、reason 缺失、其他無備註、stale、已 resolved、重送冪等；只寫 decision＋audit。
- DO_NOT_CREATE 後訂單 blocking 語意不被 UI 或 service 宣稱解除。
- 多規格商品分組、部分完成與全部完成；既有 catalog audit/staging 再次執行並登記新 variant 後，商品分組重新顯示待處理。本工作包不新增 background sync、webhook 或 polling。
- CREATE 沒有可成功 apply 的 action，UI 為 disabled。
- 執行限定 Shopify candidate tests 與完整 `npm run typecheck`；不得連正式 DB。若 typecheck 卡住或失敗，如實回報。

## 驗收與交付

- git diff 僅包含本白名單，逐檔檢查無無關變更。
- 不修改 schema、migration、庫存、成本、商品建立、訂單或部署設定。
- 保存真實 Claude 三題與整合追問的去敏結論；採用 LINK／DO_NOT_CREATE，部分採用 CREATE 方向但延後 apply，不採用 cost=0、模糊／批次／自動對應。
- 只建立 Draft PR；不合併、不主動觸發部署、不操作 Production。若既有 CI 自動產生隔離資料庫的 PR Preview，只作審查用途，不得視為正式部署或對正式資料執行 apply。
- 回復方式是 revert 本工作包程式 commit；不得刪除 audit。已產生的未來正式決策只能以受控 compensating decision 回復。
