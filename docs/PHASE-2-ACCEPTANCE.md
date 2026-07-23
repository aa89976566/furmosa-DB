# Phase 2 驗收筆記（Merchant POS QA）

> **分支：** `cursor/phase2-merchant-qa-24aa`  
> **狀態：** Phase 2 功能驗收＋手機 UX 對齊；**不開始 Phase 3**  
> **Flow：** `docs/MERCHANT-POS-FLOW.md` v1.0-approved  
> **可用性腳本：** `docs/MERCHANT-POS-USABILITY-TEST-v1.md`

---

## 1. Branch／PR 依賴

| 層級 | Branch | 內容 |
|------|--------|------|
| Phase 1 | `cursor/phase1-merchant-user-24aa` | `MerchantUser`、POS login、migration `20260722100000_merchant_user` |
| Phase 2 | `cursor/phase2-restock-request-24aa` | RestockRequest、ProductCategory、MerchantSettings、migration `20260723130000_restock_request`（已 merge Phase 1） |
| Flow 文件 | `cursor/phase2-5-merchant-pos-flow-24aa` | Merchant POS Flow v1.0-approved |
| 本輪 QA | `cursor/phase2-merchant-qa-24aa` | 疊在 Phase 2＋Flow 文件之上：UI 對齊、去掉名稱前綴雙重真相、可用性測試文件 |

**Production 部署順序（必須分開）：**

1. Phase 1 migration  
2. Phase 1 code  
3. Phase 2 migration  
4. Phase 2 code（含本輪 POS UX）

兩個 migration **不可**壓成單一變更。若 Phase 2 PR 無法獨立 review，保留 stacked 結構，不要複製 Phase 1 code。

`main` 在本輪開始時**尚未**包含 MerchantUser／POS login。

---

## 2. Migration 安全檢查

### `20260723130000_restock_request`

- `product_category` 預設 `STANDARD`（additive）  
- **一次性回填：** 僅 `name LIKE '換罐%'` → `JAR_EXCHANGE`；其餘維持 `STANDARD`  
- 之後 runtime **只看** `productCategory`（見 `lib/product-category.ts`、`lib/jar-exchange/revenue.ts`、叫貨 service）  
- **不可**再以名稱前綴當 fallback（本輪已移除 `isJarExchangeProductName`）

### 回填檢查 SQL（migration 前後）

```sql
-- 預計會被回填為 JAR_EXCHANGE
SELECT id, name, product_category
FROM "Product"
WHERE name LIKE '換罐%';

-- 回填後應全部為 JAR_EXCHANGE
SELECT COUNT(*) AS jar_by_name_still_standard
FROM "Product"
WHERE name LIKE '換罐%' AND product_category <> 'JAR_EXCHANGE';
-- 期望：0

-- 非換罐前綴不應被誤標（抽樣）
SELECT id, name, product_category
FROM "Product"
WHERE name NOT LIKE '換罐%' AND product_category = 'JAR_EXCHANGE';

-- 回填數量摘要
SELECT product_category, COUNT(*) FROM "Product" GROUP BY product_category;
```

### MerchantSettings

- 每 Merchant 最多一筆；`ensureMerchantSettings` upsert  
- `waitingForJarDays` 預設 14  
- Phase 2 **不**做設定頁、**不**讓 feature flags 影響叫貨

---

## 3. 手機 UI（本輪修正）

- 底部導航：**今天｜叫貨｜紀錄**  
- **今天：** 真實補貨進度；預約／換罐／缺貨標「準備中」，無假數字  
- **叫貨：** 我要自己選／請幫我配／申請進度  
- **紀錄：** 僅「今天的叫貨紀錄」  
- CTA ≥ 44px、送出鎖定、店員文案錯誤、成功顯示編號／時間  
- 未送出表單以 `sessionStorage` 暫存；成功後清除  
- 跨店申請 → 找不到／無權限文案（不洩漏他店資料）

---

## 4. 尚無後端能力的畫面（誠實列出）

| 區塊 | 狀態 |
|------|------|
| 今天 → 下一位客人 | 準備中 |
| 今天 → 待換罐 | 準備中 |
| 今天 → 缺貨提醒 | 準備中（庫存可靠前不顯示） |
| 紀錄 → 美容／換罐 timeline | 未做；不建假 timeline |
| Appointment / Refill / LIFF / ECPay | Phase 3+；本輪不做 |

---

## 5. Idempotency／隔離（程式已具備；合作店測前 HQ 再跑一次）

- `approveAndConvertRestockRequest`：`updateMany` claim `shipmentId IS NULL`；已有 `shipmentId` 則 `idempotent: true`  
- RestockRequest **不**扣庫存；庫存仍走既有 Shipment shipped／delivered  
- Merchant 查詢一律帶 session `merchantId`（忽略客戶端偽造）

---

## 6. 測試前仍需設定

| 項目 | 說明 |
|------|------|
| `DATABASE_URL` | 指向已跑完 Phase 1＋2 migration 的 DB |
| MerchantUser | `MERCHANT_ID` + `USERNAME` + `PASSWORD` → `npm run merchant:create-user` |
| POS URL | `/pos/login` |
| JAR_EXCHANGE 商品 | migration 回填或手動將真實換罐 SKU 設為 `JAR_EXCHANGE` |
| HQ 帳號 | 既有內部 User，可進 `/restock-requests` |

**不要**把店員密碼寫進 repo。

---

## 7. 建議合作店

豬窩體系、已在換罐寄賣且習慣 LINE 叫貨的一間分店（以當週可配合為準）。詳見可用性測試文件。
