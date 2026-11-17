# HQ 單一克重現貨 → Shopify 台北庫存同步

## 2026-11-17 單一規格凍乾擴充

`exclusive-stock-batch.ts` 明列已逐款核對的10款QIQI 40g凍乾，重用既有來源、訂單覆蓋及寫入閘門。每款只容許一個active規格、唯一綁定、已盤點克數、無來源共料及組合消耗。變更規格或新增共料會自動阻擋該款，不能把同一池克數同時發布給多個規格。

擴充使用獨立開關 `SHOPIFY_INVENTORY_SYNC_EXTENDED_ENABLED=false`，獨立模式 `SHOPIFY_INVENTORY_SYNC_EXTENDED_MODE=inspect`；鮭魚皮開關與受保護cron行為不變。worker逐款依序處理，一款阻擋不會阻止其他款或原有LINE、訂單重試與領養工作。各款紀錄仍以product ID區分，保留個別未解寫入結果的停止規則。

先部署預設關閉版本，啟用inspect檢查實際逐款紀錄，再依結果啟用apply。HQ已出貨而Shopify仍未出貨的雞柳條，不能強制略過訂單差異，也不能為了庫存同步擅改訂單或再次扣HQ；其餘核對成功商品可獨立繼續。以下鮭魚皮段落保留最初版本歷史，不代表目前正式開關狀態。

## 範圍

只處理已核實的 FUR-SALMON-SKIN-50，每份50g、WH-MAIN → 台北114718703993。HQ保持克數；Shopify可售數為 floor(max(0, 實存克數−尚未過帳需求克數)/50)。不提前扣HQ、不修改價格、不繞過出貨READY、不處理共料或組合商品。

## 已接通的程式

- RepeatableRead讀取盤點、規格、所有相關未取消／未退款訂單與獨立出貨、扣庫流水；已出貨狀態不能單獨釋放保留量。
- 規格、SKU、單位、唯一綁定、盤點或來源不完整時停止。關聯出貨與訂單只計一次；已過帳消耗不重複扣。
- Shopify未出貨訂單逐單對照HQ，防止尚未匯入的訂單被補回庫存；分頁不完整、API錯誤或綁定變動均停止。
- 逐值核對variant、SKU、inventory item與全部地點，要求tracked、DENY；其他地點有庫存或承諾需求時停止。只寫台北，不刪除Shop location。
- apply沿用APP_ENV=production與EXTERNAL_EFFECTS_MODE=enabled的共用閘門，其他／未知環境阻擋；遠端需實際授予write_inventory，即使no-op也核對。
- 寫入前再次核對HQ版本、遠端訂單及committed量；來源最多30秒。使用2026-10的changeFromQuantity與必填@idempotent，寫後讀回。
- status_audit_logs保存STARTED／INSPECTED／VERIFIED／BLOCKED／NEEDS_VERIFICATION。未知結果不強制重試；存在未結束STARTED或NEEDS_VERIFICATION時阻擋後續apply，必須先人工核對並處理該紀錄。
- 既有automation worker及POST /api/cron/shopify-inventory都接同一函式；沿用CRON_SECRET授權。預設SHOPIFY_INVENTORY_SYNC_ENABLED=false，模式inspect。

## 驗證與正式發布界線

22項針對性測試通過。遠端訂單讀取經Shopify schema驗證且執行成功；目前無該SKU訂單。完整TypeScript、測試、build與隔離DB驗證交由PR CI，不宣稱本地完整檢查已通過。

核心已於2026-11-17透過Deploy Production #208正式部署（PR651，merge 10b2039abf40768c38328fb0ee0b07b75a651433），網站及DB讀取驗收通過。每5分鐘排程目前為inspect，自動寫入尚未啟用。首輪正式訂單讀取以ORDER_SCAN_INVALID阻擋，未改庫存；PR654補上較低成本分頁、可辨識的API錯誤分類及共用外部寫入政策。主倉100g／Shopify台北2份是核對結果，不能當作永久固定值。

跨系統無共同交易：HQ可能在最後核對後新建其他通路需求。寫後重查與後續排程可偵測，但不能保證零時間差。此版本預設inspect；未完成跨通路同時預留的驗收前不可宣稱即時同步已完成。未設定共料分配，不可擴到其他商品。

HQ訂單掃描上限1000筆、流水5000筆；Shopify每頁5筆、最多20頁（100筆），降低巢狀明細查詢成本，超限停止而非截斷發布。Shopify歷史訂單權限不足、HQ已扣但Shopify仍未出貨、舊單無扣庫流水等差異會阻擋，需依操作紀錄解決。

來源：https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/inventorySetQuantities

2026-11-17正式資料修正：鮭魚皮補貨提醒由10g改50g，讓最後一份售出前提醒；既有稽核表保留修改紀錄。庫存仍100g，未為此扣庫。
