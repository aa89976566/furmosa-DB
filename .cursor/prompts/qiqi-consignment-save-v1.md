# QIQI 商品合作方式儲存畫面同步 — 凍結 Prompt v1

## 基準

- Repo：`aa89976566/furmosa-DB`
- Branch：`fix/qiqi-consignment-save-fix`
- Base：`7255e976a18470c39a4af393277d544bf6b4399b`
- 問題證據：正式站商品頁把「啟用寄賣」由 true 改為 false 後，POST 成功且重新載入可讀到 false，但 server action 完成當下表單暫時回復舊的 true。

## 目標

修正商品商務條款成功儲存後，`ProductForm` 的 local state 仍顯示舊值直到手動重新載入的問題。

## 允許修改

1. `app/(main)/products/[id]/page.tsx`
2. `lib/products/__tests__/product-form-remount.test.ts`
3. `.cursor/prompts/qiqi-consignment-save-v1.md`

## 實作

- 只在商品詳情頁的 `ProductForm` 加入以商品 ID 與商務條款版本組成的 React key。
- `commercialTermsVersion` 在 schema 為 nullable，舊資料可能沒有版本，因此使用 `product.commercialTermsVersion ?? 0`。
- 商務條款版本或商品 ID 改變時重掛載表單；兩者皆不變時保留同一個表單 instance。
- 禁止加入 `useEffect` 同步 props、修改 server action、schema、migration、商業規則、樣式、toast 或其他檔案。

## Preflight 與停止條件

- HEAD 必須等於上述 Base，worktree 不得有其他任務變更。
- 只讀確認 `ProductForm` 的商務欄位由 product props 初始化。
- 只讀確認成功更新 canonical 商務條款時，`commercialTermsVersion` 會在同一筆 Prisma update 中遞增，頁面會 revalidate 並重新讀取 product。
- 任一條件不成立即停止，不得擴張修改 server action。

## 測試與驗收

- 靜態 regression test 必須鎖定唯一一個實際 `<ProductForm ... />` JSX，並斷言 key 同時包含 product ID 與 nullable version fallback。
- 執行新增測試、既有 `commercial-terms-input.test.ts` 與 repo 的 `npm run typecheck`；不得修改 package script 或放寬檢查。
- 不執行可能含資料庫副作用的 build。
- 互動驗收分開記錄：true → false 成功後不重新載入也維持 false；重新載入後仍為 false。若沒有可用 Preview，不得宣稱互動驗收已通過。

## Claude 三題與追問摘要

- 架構：採用 versioned key；不採用 `useEffect`，避免延遲回應覆蓋未提交輸入及漏同步其他 local state。
- UX：本次只修狀態同步；不擴張新增 toast。既有送出中狀態維持不變。
- 風險：key 必須包含商品 ID；只有 canonical 商務條款變更才遞增版本；失敗或 no-op 不得清除草稿。
- 測試：靜態測試只證明 JSX key 契約，不能取代 Preview／真實互動驗收。
- Rollback：revert 本工作包三個檔案；不需 migration 或資料修復。

## 完成條件

- `git diff --name-only` 只包含上述三個白名單路徑。
- 測試結果如實記錄；失敗不得宣稱完成。
- 只建立 PR，不合併、不部署、不新增正式資料寫入。
