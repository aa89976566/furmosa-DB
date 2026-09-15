# 0008 規格同步：正式執行前檢查

## 2026-09-15 production 核對結果

- GitHub main / Railway production 實際執行 `780046272ac0c947fd23c94b6302a75f616ee537`。
- `b960b3b`、`fbea691` 僅在 sandbox 分支，未包含於 main。
- Railway project `4c05f53e-6a0a-43af-b7b3-bc071cdbe7d5`，environment `784b0447-11a7-4aa7-8cce-c1eb13b22624`，deployment `6b30f433-9c75-4ab9-9242-0496ee6b9488`。
- Railway console 與 Supabase SQL Editor 查詢一致；Supabase project `ukjjopridghvwzobrsus`。
- 單號 `SHP-202609-0008`，shipment `cmtudbjqc000e9i644e4htxy4`，泡泡堂 merchant `cmp2idqtk0003qw9lhd4mpk61`。
- request `cmtr4yv2n000110kn5gqwglf3`；order `cmtudbj1b00079i64wr978h73`。
- 出貨狀態 pending，stockPostedAt 空，四個 ShipmentItem 沒有入庫流水。
- 申請明細數量 4/3/3/4，沒有 weight_grams / variant_key 欄位；approved_snapshot 也沒有規格。
- ShipmentItem / OrderItem：原味雞霸重量空；另外三項已是 50g。此為本次查詢前既有狀態。
- ProductPriceTier：原味雞霸 FUR-0002 **只有 1 片**（tier `cmpo2s6r6001hoseb1o5evkd8`），售價 89，成本 40，weightGrams 空；不能猜測它等於 50g。
- 另外三項 50g tier：豬耳朵條 `cmpo2s605000voseb2hh5zong`；雞肉南瓜乾 `cmpo2s6mi001dosebcvjdepqo`；鴨喉嚨 `cmpo2s54o0005osebrei2lcvf`。
- `_prisma_migrations` 沒有本次 sandbox migration；查得的舊失敗紀錄皆已有 rolled_back_at。

## 舊修正的具體問題

- 0008 SQL 使用不存在的 `shipments` / `shipment_items` / `merchants` / `products`，實際表名為帶引號 PascalCase，出貨欄位為 camelCase。
- ShipmentItem 沒有 updated_at 欄位。
- validation_checks 建立後未被強制檢查；店家 CROSS JOIN 未限制 shipment 屬於泡泡堂；LIKE '%0008' 未限定月份。
- b960b3b 的 schema 有重複 model 宣告；POS 修改的是未使用的舊表單；HQ action/page 沒有完整傳遞規格。
- 舊驗證未檢查重量是否存在於商品；入庫函式缺重量時會選第一個 tier。

## 執行順序與影響範圍

1. 先取得使用者對原味雞霸規格的澄清；不能新增猜測價格的 50g tier，也不能改寫既有 1 片規格。
2. 重新跑 `restock-0008-50g-preflight.sql`，必須四行 READY，再核對 production schema/migration 是否有新變動。
3. 本分支 migration 僅增加 restock_request_items.weight_grams / variant_key、ShipmentItem.variantKey，以及正重量 CHECK；不修改既有值。先執行這一份 SQL 並使用 Prisma migrate resolve 記錄此份檔案已套用；不得無條件執行全量待辦 migrations。
4. 備份此單 ShipmentItem、OrderItem、RestockRequestItem 與 approved_snapshot 的原值，再執行 `restock-0008-50g-repair.sql`。一個交易完成四層同步；任何主檔、數量、店家、狀態或入庫檢查失敗即回滾。
5. 基於最新 main 整合程式、完成 Preview 驗收後部署。驗證 Railway 成功部署的 commit、health、HQ 申請完成頁／出貨頁、泡泡堂 POS 申請與出貨頁。不得為測試繞過登入、造 production 帳號或確認真實收貨。
6. 驗證四項 50g 與 4/3/3/4，確認同一 ProductPriceTier identity。待備貨不應憑空增加庫存。

回復：程式回退至前版時保留新增 nullable 欄位（相容舊程式），不要刪除已保存規格。資料修復若需回復，先確認尚未出貨／入庫，依備份精準還原同一組明細；不更動數量或其他訂單。

## 已完成的本地驗證

- Prisma generate 與 TypeScript 檢查。
- 439 項補貨、POS 與共用函式測試通過，含 SELF_SELECT 拒絕缺規格／不合法規格，核准→Order/Shipment/snapshot→庫存 tier identity。
- PGlite 隔離 PostgreSQL 實際執行 schema + repair SQL：缺50g、錯店家、錯數量、已入庫、重複50g 五種失敗均回滾；成功案例保存數量及其他單／庫存；重跑冪等。
- Lint 尚未設定：next lint 進入初始設定提示，未新增設定，不能算通過。
- 未完成：原味雞霸澄清、production migration/repair/deploy、Preview 與 production 畫面驗收。
