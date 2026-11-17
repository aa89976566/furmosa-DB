# Shopify 指定地點庫存寫入防護

本次新增 `lib/shopify/inventory-write.ts` 傳輸函式，不新增 API、排程或正式資料寫入。尚未接上 HQ 資料載入，也不代表自動同步已啟用。

## 已完成

- 明確核對 variant、SKU、inventory item、location，要求 tracked=true、售完政策 DENY。
- 資料快照不完整、有 issues、超過30秒、來源版本改變，均阻擋。
- 檢查全部地點（上限50；仍有下一頁時阻擋），其他地點有庫存或已承諾訂單時阻擋。
- Shopify 2026-10 使用 `changeFromQuantity`，不沿用2026-04以前的 `compareQuantity`。
- 每次寫入使用必填的 `@idempotent`；相同計畫與遠端起始量產生同一鍵，不自動重試未知結果。
- 寫後讀回核對；遇並行訂單或拒絕時重新核對，不強制蓋回原量。

## 正式串接前仍須完成

1. HQ 單一一致快照載入及可信 sourceRevision；既有 `loadHqPackPreview` 仍不能發布。
2. HQ與Shopify尚未匯入需求的完整涵蓋、共料分配、跨通路並行控制。單靠遠端比較後寫入不能防止HQ同時新增需求。
3. 明確的主倉到Shopify地點設定；現有「台北」與「Shop location」不能任選或重複灌量。
4. 管理員授權、持久化稽核／待確認紀錄、失敗重試與受控觸發；目前函式不是授權邊界。
5. 以隔離商店與DB驗收後受控發布；不拿歷史100g當作今日現貨。

本次7項單元測試通過；本地TypeScript檢查長時間未回應後已中止，不能視為通過，交由PR的CI重新驗證。讀／寫操作皆通過2026-10 GraphQL schema驗證。未正式呼叫庫存mutation。

來源：https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/inventorySetQuantities
