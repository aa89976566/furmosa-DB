# Preview 資料庫更新紀錄

日期：2026-08-31。使用者明確同意只更新測試庫結構，不刪資料、不動正式庫。

## 執行目標與方式

- Supabase 專案：`furmosa-preview-test`（`psbaygunjtekphtbzbcl`）。
- 經使用者已登入的 Chrome / Supabase SQL Editor 執行，不讀取或匯出密碼。
- 僅套用下列兩份 migration，在同一交易中完成，設定 lock timeout 5 秒、statement timeout 30 秒。
- 使用實際 SQL 檔 SHA-256，於同一交易寫入 `_prisma_migrations` 完成紀錄；未全面執行 migrate deploy。

| Migration | SHA-256 |
| --- | --- |
| 20260818233000_shopify_order_review_gate | c272853eee75584e28d7ab1f29bcf44828508174c05e738661648f549c2f4ee0 |
| 20260830120000_shopify_oms_foundation | 313d29932e0054a2c22800e037706484f0001b84c7b16efa76f62d74222ab1ba |

OMS foundation 執行前新增事件表 RLS，無公開存取 policy；事件資料由伺服器 Prisma 存取。已套用的 migration 檔不得再直接修改，需要變更時新增 migration。

## 驗證結果

- 訂單新增欄位：12 個（Shopify 識別 3 個、OMS / 快照 / 審核 9 個）。
- 訂單數更新前後均為 1；既有訂單 `oms_status` 仍為 NULL，不自動納入 OMS。
- `ShopifyWebhookEvent` 存在、0 筆事件、RLS 已啟用、0 個公開 policy。
- 預期 8 個索引皆存在且有效；審核者外鍵存在且已驗證。
- 兩筆 migration 完成紀錄及 checksum 與本機 SQL 相符。
- 未回填訂單、未建立測試帳號、未匯入正式資料、未呼叫物流、未部署網站。

第一次送出因編輯器殘留舊查詢造成 SQL 解析錯誤；清空後重新送出完整交易成功，並另行唯讀驗證以上結果。

## 後續注意事項

- 測試庫另有 `20260823120000_refill_fulfillment_ledger` migration 紀錄，本機此分支未包含該檔。未刪除或變更此紀錄；後續全面 migration 前需核對分支差異。
- 此次只驗證 OMS 新增結構，並非整個資料庫與目前 Prisma schema 的全面一致性驗證。
- 尚未執行 Preview build / 部署、應用程式實際連線、Shopify webhook 端到端測試。
- 若需停用 OMS，先停用新流程並保留新增資料結構；不以刪欄位或重設資料庫回復。
