# Furmosa 店家商務流程簡化執行計畫

狀態：Draft for implementation review  
基準：現有 HQ 已支援一張店家訂單選擇寄賣／販售／換罐，以及逐單運費；本計畫不建立平行訂單系統。

## 1. 固定邊界

- 產品管理保存 SKU 的穩定商務屬性與預設值。
- 店家管理只保存可使用的合作模組與有效期間。
- 一張店家訂單只能是寄賣、買斷或換罐其中一種。
- 訂單建立時選擇運費負擔並保存快照。
- 訂單可受控覆寫 SKU 預設；覆寫必須有原因與稽核資料。
- 換罐維持獨立商品、點數、券與補貼流程，不進一般寄賣佣金。

## 2. 沿用現有能力

| 現有能力 | 決定 |
|---|---|
| `Merchant.types` 可複選合作類型 | 沿用；後續只補有效期間，不重建店家類型系統 |
| `MerchantProductRule` | 沿用為店家 × SKU 寄賣特約例外 |
| `MerchantWholesalePrice` | 沿用為店家 × SKU／規格買斷特約例外 |
| `merchantOrderMode` | 沿用；一張訂單維持單一模式 |
| `shippingFeeType`、`shippingFee`、`companyShippingCost` | 沿用為逐單運費快照 |
| `OrderItem.unitPrice`、`subtotal` | 沿用既有成交快照；新商務欄位另行提出 migration |

## 3. 需要補齊的資料

### SKU 商務預設

- `businessTier`: `standard | premium`
- `defaultConsignmentCommissionMode`: `percent | amount`
- `defaultConsignmentCommissionValue`
- `defaultWholesalePricingMode`: `percent_of_retail | fixed`
- `defaultWholesalePricingValue`
- `consignmentEnabled`
- `wholesaleEnabled`
- `jarExchangeEnabled`
- `commercialTermsVersion`

### 訂單／明細快照

- 模式與 SKU 商務版本。
- 預設值與本單實際值。
- 是否覆寫、覆寫原因、操作人與時間。
- 運費負擔方及實際金額。

以上欄位只是一份 schema 提案；取得使用者明確同意前不得修改 `schema.prisma` 或建立 migration。

## 4. 解析優先順序

1. 本單經授權覆寫。
2. 店家 × SKU 特約例外。
3. SKU 有效版本預設。
4. 缺少必要設定就阻擋，不從店名、歷史訂單或畫面文字猜值。

## 5. 今日工作順序

### P0 — 規格與現況對齊

- 更新帳務合約，移除店家包郵門檻及件數佣金級距。
- 建立本計畫與現況沿用表。
- 驗證 POS-01、換罐規則與現有訂單模式沒有矛盾。

完成條件：沒有文件再要求在店家方案設定包郵或件數級距。

### P1 — Schema／migration 設計（需另行批准）

- 只做 expand migration，不刪舊欄位。
- 新欄位先 nullable／有安全預設，舊流程維持相容。
- 提供 rollback：程式回退後忽略新欄位；migration 不做 destructive down。
- 提供唯讀 backfill 報告，正式資料 backfill 另行批准。

完成條件：migration、舊資料策略與 rollback 經 review。

### P2 — 產品管理

- 商品表單加入一般／Premium、寄賣預設、買斷預設與允許模式。
- 伺服器端驗證比例、固定金額及模式組合。
- 商品詳情顯示目前有效版本。

完成條件：新增與編輯 SKU 都能保存、重載並正確顯示設定。

### P3 — 店家管理

- 店家頁只顯示寄賣／買斷／換罐三個模組與有效期間。
- 特約例外改為次層入口；沒有例外時不顯示複雜表格。
- 不顯示包郵、件數級距或 SKU 預設。

完成條件：新增換罐不會改變寄賣或買斷設定與歷史。

### P4 — 新增訂單

- 選店家後，只顯示該店已啟用的訂單模式。
- 選模式後，只顯示 SKU 允許該模式的商品。
- 自動套用特約例外或 SKU 預設。
- 特殊調整藏在「調整本單條件」，並強制填原因。
- 運費在訂單末段選擇，不讀店家預設門檻。
- 確認前分開顯示商品小計、折扣、運費、應收及覆寫提示。

完成條件：一般日常訂單只需「選店家 → 選模式 → 選商品與數量 → 選運費 → 確認」。

### P5 — 帳務與回歸

- 寄賣只在實際銷售時形成佣金。
- 買斷在訂單確認時形成店家應付。
- 換罐不套一般佣金或買斷價。
- 保存訂單快照，修改 SKU 不改歷史訂單。

完成條件：正常、覆寫、重送、退款、停用與跨店權限測試通過。

## 6. 必測案例

1. 一般肉乾寄賣自動帶入 20%。
2. 一般凍乾寄賣自動帶入 30%。
3. Premium SKU 使用自身預設，不由操作人選等級。
4. 店家特約優先於 SKU 預設。
5. 本單覆寫優先於特約，且沒有原因時拒絕。
6. 買斷單不計寄賣佣金。
7. 寄賣單不形成買斷應收。
8. 同一張店家訂單不能混合寄賣與買斷。
9. 店家未啟用的模式不能建立訂單。
10. SKU 未允許的模式不能加入訂單。
11. 匠寵負擔、店家負擔及免運都保存正確快照。
12. 修改 SKU 預設後，既有訂單金額與條件不變。
13. 換罐模組啟用／停用不改寄賣庫存與佣金。
14. 跨店讀取或覆寫被拒絕。

## 7. 品質閘門

- 不承諾「零錯誤」；以 fail closed、快照、稽核、transaction 與測試降低風險。
- 每個 Phase 單獨 PR；不得把 schema、產品頁、店家頁、訂單與正式 backfill 一次混在同一 PR。
- 未通過相關單元測試、型別檢查、隔離 PostgreSQL 與 Preview E2E，不進下一階段。
- 不直接 push `main`，不自行執行正式 migration、backfill 或部署。
