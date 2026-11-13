# HQ 單品同步至 Shopify

## 本次可驗收行為

管理員在既有 HQ 商品頁儲存規格後，按「同步售價、成本與重量」。
伺服器重查管理員權限、HQ 指紋、唯一綁定與組合配方，讀取 Shopify 確認 SKU 及新台幣幣別，
再更新指定 variant 的售價、每包成本與重量。最後重新讀回逐值核對。
相同內容重送不再寫入；不建立重複商品。操作前後保存既有 StatusAuditLog。
網路結果不明時標記需核對，不自動重送。

這版只支援 active STANDARD 商品的一個有效克重規格；不得從 Product.cost 換算每包成本。
其他有效規格、組合配方、缺少成本、未綁定 variant 或 SKU 不符均阻擋。
現有 Shopify → HQ 同步功能保留；操作時應留意方向，兩方向不是自動雙向同步。

## 尚未提供

- 新建 Shopify 商品、圖片與完整上架資訊管理、營養欄位、CSS 產生或發布。
- 自動同步或同步庫存。散裝可售包數仍沿用另一份計算預覽，尚未正式啟用。
- 遠端價格的比較後寫入或與所有 HQ 編輯入口共用的鎖；讀回確認當下結果，不代表之後不會被其他管理員修改。

## 啟用與回復

`HQ_SHOPIFY_PRODUCT_PUSH_ENABLED` 預設 false；只在後續受控發布明確啟用。
本變更沒有操作正式環境或變更憑證、權限、schema、migration、webhook。
所需 Admin API scopes：read_products、read_inventory、write_products（驗證器回報）；仍需實際驗證應用授權與成本存取。
先在隔離 DB 與 Shopify 測試商店驗收。關閉旗標會停止後續寫入，不自動回復先前價格；先前值可由 VERIFIED 稽核紀錄核對後人工恢復。

## 驗證

- 8 項單元測試：50g／250元／成本100元寫入與讀回、重送、SKU／幣別不符、金額與規格限制、API 錯誤、網路結果不明、來源指紋、異常回傳及 HTTP 拒絕。
- GraphQL 讀取與寫入均通過 Shopify 2026-10 schema 驗證。
- 尚未完整 TypeScript／Next 建置、瀏覽器驗收或真實 DB／Shopify 測試。
- 隔離驗收還需確認未登入／非管理員被拒、旗標關閉被拒、來源更新後阻擋、重複綁定阻擋、稽核故障顯示待確認，及既有商品頁不變。

API 依據：
https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/InventoryItemInput
https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/productVariantsBulkUpdate

## 補查結果與發布阻擋

- 已補：只有克重單位、unitQty=1、inventoryPolicy=shared 可套用；這三欄也納入來源指紋。
- 已補：重量單位轉換的字串索引型別、null／異常 API envelope 保護。
- 尚缺：`catalog-sync-service.ts` 的既有 Shopify → HQ 套用仍會更新 HQ 價格，與 HQ 唯一主檔目標衝突。完整主檔上線前，需調整雙向欄位所有權及測試；不能同時宣稱兩邊都是真實來源。
- 尚缺：同步期間 HQ 編輯與遠端價格變更的並行控制。
- 尚缺：完整型別檢查、伺服器 action 的權限／旗標／稽核整合測試、隔離 Preview 驗收。
- 尚缺：商品建立／唯一對應回存、圖片、完整食品資料／營養欄位／CSS、庫存扣克數與訂單全流程。此按鈕僅是既有規格更新功能，不能視為一鍵上架已完成。
