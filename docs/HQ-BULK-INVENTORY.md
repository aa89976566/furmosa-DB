# HQ 散裝庫存

## 範圍與規則

- `WH-MAIN` 的 `InventoryBalance` 是 HQ 散裝餘額；同 Product 各販售規格共用一池。
- `unit=null` 的舊數字不能當作已確認的克數。未盤點仍可出貨，但會先提示，並以 0 起算留下負庫存供後續盤點修正。
- 重量主檔 `g/克/公克` 統一扣 g；隻、片、顆、條依 master 的實際單位與 tier.unitQty 扣除。重量商品每件耗用 tier.weightGrams；缺規格、多筆符合、非正整數一律阻擋。
- OrderItem 新增 nullable variantKey，沿用既有表單 tierId 並傳至 ShipmentItem。舊明細只在 master 能唯一解出規格時相容。
- 只有 shipped/delivered/received/completed 的有效來源扣帳。pending、packed、付款成功本身不扣。
- 每個 ShipmentItem（無出貨單時為 OrderItem）有唯一 eventKey。取消、完整退貨或完整退款新增 return_in 並指向原 transaction；重送不重扣、不重補。既有業務流程未提供部分退貨輸入，本版不把部分退款猜成全量退貨。
- 狀態更新、扣帳與帳冊寫入在同一資料庫 transaction；庫存不足會顯示提醒但不阻擋，寄出後可保留負庫存。規格無法辨識等資料錯誤仍會整筆回退。
- 原味雞霸（SKU `FUR-0002`）為接單現做，不要求 HQ 現貨，也不寫入 HQ 庫存扣帳。
- 已提交扣帳明細與帳冊禁止改寫、刪除。已出貨不能直接回到草稿；需走取消／退貨紀錄。直接扣帳訂單禁止再建有效出貨重扣。
- 舊的已出貨來源 `hqInventoryEligible=false`，不因送達通知或其他欄位更新追扣。新版首次有效出貨才啟用。
- Shopify 原有簽章、事件去重、人工 READY gate 不變；資料庫扣帳另檢查審核身份、來源版本、blocking issue。來源更新不重新計算已扣帳快照。
- MerchantStock、MerchantStockTxn、店家 POS 與換罐店家庫存完全不寫入。

## 2026-09-15 人工盤點（約略）

對應證據來自 production `Product` primary key、sku、sourceSku、name、STANDARD 類別與 ProductPriceTier。相同名稱的 JAR_EXCHANGE 是不同 master 身份，沒有重複灌入盤點，也沒有猜測合併。

| 口語名稱 | Master | SKU | sourceSku | 基準 |
|---|---|---|---|---|
| 水晶魚 | 水晶魚凍乾 | FUR-0028 | FD-10 | 約400g |
| 牛肉丁 | 牛肉丁凍乾 | FUR-0022 | FD-08 | 約300g |
| 雞肉丁 | 雞肉丁凍乾 | FUR-0024 | FD-11 | 約1300g |
| 丁香魚 | 丁香魚凍乾 | FUR-0023 | FD-09 | 約300g |
| 蔬果 | 混合蔬果凍乾 | FUR-0003 | FD-12 | 約500g |
| 鵪鶉乾 | 鵪鶉凍乾 | FUR-0031 | FD-05 | 4隻 |

盤點只有日期，未提供精確時間。lastCountedAt 使用日期的午夜作儲存值，countNote 明記時間未提供。不可把它當精確盤點時刻。

## 部署與回復

`node scripts/ops/deploy-hq-bulk.mjs` 僅執行 `20260915130000_hq_bulk_inventory`、`20260917103000_hq_inventory_advisory` 與六項有主鍵驗證的盤點。migration、checksum 登記、盤點同一交易提交；身份不符即全部退回。重跑不重設後續銷售餘額。不可用全量 migrate deploy 代替本次 production 步驟：production 有其他分支的歷史 schema，另有未套用的 POS migration 不在本次範圍。

回復應先停止 HQ 出貨寫入，停用 `hq_bulk_order_post`、`hq_bulk_shipment_post` 與 eligibility triggers，再回復上一個 app 部署；保留新增欄位、所有 InventoryTransaction 與 checksum。若需更正盤點，新增具原始來源的反向／盤點 transaction，禁止刪除帳冊或直接還原舊資料庫覆蓋後續業務。

`hq-pending-stocktake.sql` 列出所有 active 食品/零食沒有當日實體盤點的品項、販售規格與系統舊數字。無餘額列代表未建庫存，不能寫成 0g。

## 驗證

- Node 22 全套測試；新增 PostgreSQL integration test 覆蓋 30g、50g×2、同商品混合规格、計件 tier、重送、取消/退款反向回補、負庫存整筆 rollback、多商品部分失敗 rollback、並行競爭、舊已出貨不追扣、未通過 OMS gate、帳冊不可刪改、POS 餘額不變。
- 獨立新資料庫演練 migration + 六項盤點與重跑去重。
- 本機 production build 與正常登入的隔離 Preview 庫存畫面驗收。
- 正式環境驗證部署 SHA、migration checksum、六項餘額與帳冊，以及真實登入的庫存頁；不建立 production 假訂單。
