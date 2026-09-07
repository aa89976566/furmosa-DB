# OMS 滿額贈月餅（CK-08）

此文件說明 HQ 審核如何計算「滿 NT$555 贈 CK-08 一顆」。尚未部署正式環境；不是完整 OMS 上線證明。

## 活動規則

- 資格由 HQ 判定，不受 Shopify 指定商品限制。所有付費商品 SKU 都計入，包含付費 CK-08。
- 每張訂單最多一顆。滿 NT$1,110 仍只送一顆。
- 幣別必須是 TWD。門檻是 55,500 分（NT$555.00），用整數分計算。
- 計入方式沿用既有 theme 口徑：非本活動贈品的折扣前商品行小計（`price × quantity`），不含運費。不使用含運費 `total_price`、折扣後小計或表單金額。
- 活動起點 `2026-08-27T06:55:00+08:00`，無結束日。以來源 `created_at` 判定，不用系統今天日期。
- 達門檻但日期、金額或數量無效會阻擋。活動前或未達門檻，不會只因為舊快照缺少活動標記而額外阻擋正常舊單。

## 贈品識別

- 標準 SKU 是 `CK-08`，Shopify variant 是 `64368368517497`。
- 新的完整來源（伺服器 `promotionCaptureVersion = 1`）中，精確 variant 或 SKU 且整行實付為 0（`price × quantity − total_discount`；缺折扣視為 0）可識別為已有本活動贈品。不要求每一筆都帶 `_jc_gift_555`。
- `_jc_gift_555=true` 也是來源證據。標記與非零實付、或與 variant/SKU 矛盾時阻擋。兩個非空識別同時提供且一個符合、一個不符合時視為身份衝突，標記不能覆蓋此衝突。
- 付費 CK-08 不是已送贈品。其他 SKU 的免費行不阻止本活動。
- 多份本活動贈品、未知或矛盾標記／顧客選擇，不得靜默刪減或再送，必須阻擋核對。重複的相同 keep／true 也阻擋。缺選擇合法；單一 keep 或 decline 合法。
- 尊重 `jc_mooncake_choice=decline`：不加贈。decline 卻已有本活動贈品則阻擋。`keep` 或未選擇且符合資格可補贈。
- 達門檻但 `created_at` 不是真實日曆日（例如 9/31、非閏年 2/29）會阻擋，不會被 JavaScript Date 正規化成有效日期。未達門檻的舊單不因此額外阻擋。

## 來源快照

- `schemaVersion` 仍是 1。伺服器寫入 `promotionCaptureVersion`，不接受 payload 偽造的能力標記。
- 只多保存 `variant_id`、properties 中精確 `_jc_gift_555`、note_attributes 中 `jc_mooncake_choice`，以及既有超商欄位。不保存任意 properties 或客戶秘密。
- 舊快照仍可讀。達門檻但缺少 capture 標記時，不可假定沒有贈品或沒有拒領；畫面顯示需重新同步來源資料，沒有 checkbox 可繞過。

## 舊單補欄位

只允許 intake 的極窄 reconcile 路徑：

- `origin=reconcile`
- 同一個有效 `updated_at`
- 已存在 OMS、未進入履約或終止、未刪除
- 舊快照尚未 capture、新快照已 capture
- 剝除本次新增欄位後，snapshot hash 與舊快照完全相同

此時才保存新增來源欄位並使舊審核失效。其他同版本真差異、較舊或未知版本、event ID 衝突，仍按原流程阻擋。

## 履約計畫

- `promotion-resolver` 是純函式。`fulfillment-plan` 集中原購買、Shopify 已有贈品、HQ 補贈與總數。計畫版本 `ck08-555-plan-v2`。
- 來源 quantity 不會從 10 改成 11。HQ 贈品是獨立一列，單價與小計 0、`isGift=true`。
- HQ 補贈與來源已有贈品共用同一套商品主檔驗證：去重後唯一精確 `sku`／`sourceSku` = CK-08、active 一般商品、唯一 50g／顆／unitQty 1 且有 `tier.id`。來源贈品必須對到這個唯一商品。
- 成本取第一個「有出現」的 `tier.cost`、`product.cost` 或目錄成本。出現但無效（負值、非有限數字）不得往下 fallback；0 合法。不得把無效成本靜默寫成 `unitCost: null` 作出貨。
- 贈品溫層只來看商品主檔 `defaultTemperature`，不能用人工 chosenTemp 掩蓋主檔空值或衝突。與配送及實體購買行比較；非實體（`requires_shipping=false`）不納入溫層比較。HQ 贈品本身是實體。不預設常溫、不自動改物流。
- 已有全折扣贈品的出貨行標為贈品／0 元，但不改來源快照、Order 金額或付費行結算。
- check / approve / ship 使用同一計畫。計畫存在既有 `oms_review` metadataJson，草稿契約仍是 `schemaVersion: 1`。瀏覽器不能提交或覆寫計畫。
- 凍結計畫會保存實際用到的商品／規格身份（含 `tier.id`）、status／category、sku／sourceSku、主檔溫層與有效 unitCost。approve / ship 會重建比較。舊版計畫或缺欄位必須重新檢查，不回填舊 audit。庫存與預留不納入凍結 hash，每次即時重驗。
- 購買 10 顆加贈 1 顆、同一 `productId` 需要 11 件庫存，含 pending／packed 預留。

## 畫面

顯示「活動贈品：滿NT$555贈月餅×1」。狀態為 HQ補贈／Shopify已有／已拒領／活動期間外／未達門檻／待確認。只有未達門檻才顯示「未達門檻」。阻擋時列出可讀原因與「總數待確認」，缺少 capture 時說明需重新同步來源資料。CK-08 10+1 顯示 11 顆。混合商品用「件」。不新增人工按鈕，也不把勾選當成解除問題。
