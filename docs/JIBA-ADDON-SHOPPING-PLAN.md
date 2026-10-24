# 雞霸開箱任務 — 加購購物延伸計畫（審核用）

> **狀態：** 計畫審核中 — **尚未實作 schema／migration／程式**  
> **日期：** 2026-07-26  
> **前置條件：** PR [#38](https://github.com/aa89976566/furmosa-DB/pull/38)（基礎對話狀態機＋玉珊審核＋付款 stub）須先合併或本分支 rebase 其上  
> **約束：** 審核通過前，不寫 production migration、不改 production 資料

---

## 1. 現有架構摘要

### 1.1 `main` 現況（已上線）

| 模組 | 現況 |
|------|------|
| LINE webhook | `app/api/line/webhook/route.ts` → `handle-event.ts` / `postback-actions.ts` |
| 「開箱任務」 | 一起野放垂直按鈕選單 → 目前僅靜態文案路徑（PR #38 未合前） |
| 多步驟對話 | 僅開戶：`LineChatSession` + `register-from-chat.ts` |
| 商品 | `Product` + **`ProductPriceTier`**（克數／售價；**無**獨立 `ProductVariant` 表） |
| 庫存 | `InventoryBalance`（HQ）；建單時**不**自動扣庫存 |
| 訂單 | `Order` / `OrderItem`；收件人在 **`Shipment`**，Order 本身無 `recipientName` |
| 運費 | `lib/shipping-policy.ts`：7-11 = 60；免運靠手動 `shippingFeeType=free`，**無滿額門檻** |
| 7-11 | 後台手動欄位；無 emap；LINE 選店是**合作美容店**，不是 CVS |
| 金流 | **無 ECPay 實作**（僅 Domain Spec 目標）；付款狀態為後台手動欄位 |
| 出貨 | `createOrder` 當下就建 `Shipment(pending)`，**不**等付款 |

### 1.2 PR #38 已實作（未合併 `main`）

可複用基底：

- DB：`campaigns` / `campaign_applications` / `conversation_sessions` / `conversation_messages` / `order_reviews` / `status_audit_logs`
- LINE：`lib/line/campaigns/jiba-unbox/flow.ts` 狀態機（介紹→收件→授權→送審）
- Service：`lib/campaigns/jiba-two-piece/service.ts`（建申請＋draft order、審核、付款 token stub）
- 後台：`/campaigns/jiba-two-piece` 審核＋對話時間軸
- 付款：`/pay/jiba/[token]` **確認付款 stub**（非綠界）
- 門市：手動輸入＋候選確認（`store-search.ts`）

**PR #38 缺口（相對本需求）：**

- 參加後立刻問收件，**沒有加購／逛商店**
- **未建立** `OrderItem`（雞霸贈品兩片未入明細）
- 無商品 parser／別名／庫存再驗證
- 無滿 NT$199 免運（加購小計）
- 付款固定 NT$60，非 `order.total`
- 無 ECPay
- 審核頁無加購商品／parser／價格異動警示

---

## 2. 複用計畫

| 需求 | 複用 | 新建／延伸 |
|------|------|------------|
| 對話狀態持久化 | PR #38 `ConversationSession` + `LineChatSession` 備援 | 新 states（加購相關） |
| Draft 訂單 | PR #38 `Order` draft + application.orderId | 寫入 `OrderItem`；計算服務 |
| 商品／克數 | `Product` + `ProductPriceTier` | **以 priceTier 當 variant**；不新建 ProductVariant 表 |
| 商品搜尋 | `productSearchWhere` / `searchProductsForOrderForm` | `ProductIntentParser` + `product_aliases` |
| 運費常數 60 | `SHIPPING_FEE_CVS_711` | `calculateUgCOrderTotals()`：滿 199 免運 |
| 出貨 | `Shipment` 模式 | **付款成功後才建**（維持 PR #38 門禁） |
| 審核 UI | `/campaigns/jiba-two-piece/[id]` | 加商品明細、警示、退回商品 |
| 付款 | `/pay/jiba/[token]` stub | Phase A stub 支援動態 total；Phase B 接 ECPay |
| 7-11 | `store-search` + cvs 欄位 | 後續可接 emap；本階段不硬接新選店系統 |
| Audit | `StatusAuditLog` | 擴充 action 類型／metadata |
| Idempotency | LINE message id 寫入 `conversation_messages` | `line_webhook_events` 或 unique on message id |

**不重複建：** 第二套 Customer／Order／獨立購物車表。加購狀態放在 draft `Order` + `OrderItem` + session `collected_data_json`（pending parse）。

---

## 3. 新狀態機（對話）

```text
CAMPAIGN_INTRO
  → SHOW_RULES (optional)
  → [JOIN] create application + draft order + gift items
  → ASK_ADD_ON_INTEREST
       ├─ RULES → (回 ASK_ADD_ON_INTEREST)
       ├─ SKIP → ASK_RECIPIENT_NAME
       └─ SHOP → WAITING_FOR_SHOPPING_RETURN
                    ├─ 還在看 → (同態，重丟商店連結)
                    ├─ 算了不加購 → clear add-ons → ASK_RECIPIENT_NAME
                    └─ 我挑好了 → ASK_ADD_ON_ITEMS
                                   → (parser loop / pending confirm)
                                   → SHOW_CART_SUMMARY
                                        ├─ 再逛／還要加 → WAITING… 或 ASK_ADD_ON_ITEMS
                                        ├─ 全部不加了 → clear add-ons → ASK_RECIPIENT_NAME
                                        └─ 就這些 → ASK_RECIPIENT_NAME
  → ASK_RECIPIENT_NAME → ASK_RECIPIENT_PHONE → ASK_STORE → CONFIRM_STORE
  → ASK_INSTAGRAM → ASK_PET_NAME → ASK_CONTENT_LICENSE
  → SHOW_ORDER_CONFIRMATION
  → PENDING_REVIEW
  → AWAITING_PAYMENT   (玉珊通過後；含運費+加購)
  → READY_TO_SHIP      (付款成功後 QUEUED)
  → CANCELLED
```

Pending 子狀態（存 `collected_data_json`，不必全成 enum）：

- `pending_parse`：多行解析結果佇列  
- `awaiting_weight` / `awaiting_quantity` / `awaiting_disambiguation` / `awaiting_item_confirm`

---

## 4. Database Migration 提案（審核後才套用）

### 4.1 前置

1. 合併或 rebase **PR #38** migration：`20260726140000_ugc_campaign_unbox`  
2. 新建 migration（建議名）：`YYYYMMDDHHMMSS_ugc_addon_shopping`

### 4.2 新建表

#### `product_aliases`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | text PK | |
| product_id | text FK → products | |
| alias | text | 顯示用 |
| normalized_alias | text | 去空白／小寫／全半形正規化 |
| priority | int default 0 | 愈高愈優先 |
| active | boolean default true | |
| created_at / updated_at | timestamptz | |

- Unique：`(normalized_alias)` 或 `(product_id, normalized_alias)`  
- Index：`normalized_alias` where active

Seed（審核後才寫入 production）：水晶魚→對應凍乾商品 id、雞丁／牛丁／蔬果／雞霸等，**以實際 DB 商品為準**，禁止幻造。

#### `line_webhook_events`（冪等）

| 欄位 | 型別 |
|------|------|
| id | text PK |
| event_key | text unique（LINE messageId 或 webhook eventId） |
| line_user_id | text? |
| processed_at | timestamptz |
| result_json | text? |

### 4.3 延伸既有表

#### `order_items` 新增（nullable，不破壞舊單）

| 欄位 | 說明 |
|------|------|
| item_type | `STANDARD`（既有）/ `CAMPAIGN_GIFT` / `REGULAR_ADD_ON`；default `STANDARD` |
| product_variant_id | **對應 `ProductPriceTier.id`**（命名沿需求；實作映射 tier） |
| variant_name_snapshot | 例：`30g` |
| weight_grams | 可與既有 `weightGrams` 對齊或複用 |
| excluded_from_free_shipping | bool default false |
| customer_input_text | 原始輸入 |
| source_line_message_id | |
| parser_match_status | |
| parser_confidence | float? |
| inventory_status | |
| confirmed_by_customer_at | timestamptz? |

> 既有 `productName` / `sku` / `unitPrice` / `quantity` / `subtotal` / `isGift` 繼續用；`CAMPAIGN_GIFT` 可同時 `isGift=true`。

#### `orders` 新增（可選但建議）

| 欄位 | 說明 |
|------|------|
| order_type | default `STANDARD`；UGC 用 `UGC_CAMPAIGN` |
| shipping_queue_status | `NOT_READY` / `QUEUED`（與 application 對齊；避免只存在 application） |
| regular_product_subtotal | float? 快取加購小計 |
| free_shipping_threshold | int? default 199（快照） |

收件人：維持 PR #38 寫在 `campaign_applications` + `orders.cvs*` + `note`；出貨時寫入 `Shipment.recipient*`。  
**不強制**在 Order 加 `recipient_name`（避免與現有表單雙寫）；若產品堅持 Order 欄位，可另開 migration，審核時決定。

#### `campaign_applications`

- 既有欄位足夠；可加 `addon_subtotal_snapshot`（可選）  
- `payment_status` / `payment_token` 已存在於 PR #38

### 4.4 不修改／暫緩

- **不**新建第二套 orders  
- **不**在本階段接 7-11 emap API（沿用候選確認）  
- **不**在審核前 seed production 別名或改庫存數字  
- ECPay 金鑰：**新 env**，見 §9；未備妥前維持 stub

### 4.5 Rollback

```text
1. 功能旗標 UGC_ADDON_SHOPPING_ENABLED=false → LINE 退回「僅雞霸＋運費60」路徑
2. prisma migrate resolve / 向下 migration：drop 新增欄位與 product_aliases、line_webhook_events
3. 進行中 UGC draft 訂單：status=cancelled；不碰非 UGC 訂單
```

---

## 5. 商品別名策略

1. **唯一真相：** `product_aliases` + `products.status=active`  
2. Parser 正規化輸入 → 查 `normalized_alias` → 得 `product_id`  
3. 同 alias 多產品 → `MULTIPLE_MATCHES`，不猜測  
4. 別名優先級：`priority` DESC，再官方名精確匹配  
5. Import 腳本既有 `PRODUCT_NAME_ALIASES`（`prisma/import.ts`）可**一次性匯入**別名表，之後營運在後台維護（後台 CRUD 可 Phase 2）  
6. **禁止**在 LINE handler 寫死商品清單（除開發用 fixture 測試）

---

## 6. ProductIntentParser 設計

路徑建議：`lib/campaigns/product-intent-parser/`

```text
parseCustomerProductText(raw, ctx) → ParsedLine[]
resolveProduct(name) → MatchResult
resolveWeight(productId, grams?) → WeightResult
resolveQuantity(token?) → number | null
validateInventory(tierId, qty) → InventoryResult
```

輸出（每行）：

- `raw_text`, `product_name_input`
- `matched_product_id`, `matched_product_name`
- `matched_variant_id`（= priceTier.id）
- `weight`, `quantity`, `confidence`
- `missing_fields[]`, `match_status`

`match_status`：`EXACT_MATCH` | `ALIAS_MATCH` | `MULTIPLE_MATCHES` | `MISSING_WEIGHT` | `MISSING_QUANTITY` | `NO_MATCH` | `OUT_OF_STOCK` | `INSUFFICIENT_STOCK`

規則摘要：

- 只問缺的欄位；pending 存在 session JSON  
- 多行：完整項暫存、缺項逐問  
- 確認前不寫最終 `REGULAR_ADD_ON`  
- 價格只讀 DB tier，忽略顧客自報價

---

## 7. 訂單計算設計

路徑：`lib/campaigns/jiba-two-piece/totals.ts`（單一真相）

```text
regular_product_subtotal = Σ REGULAR_ADD_ON.line_total
shipping_fee =
  regular_product_subtotal >= 199 ? 0 : 60
total = regular_product_subtotal + shipping_fee
```

- `CAMPAIGN_GIFT`：**永不**計入 199  
- LINE／審核頁／付款頁**只讀**已存欄位，不各自重算商業規則（可呼叫同一函式重算後寫回）  
- 與 `resolveOrderShipping` 整合：免運時 `shippingFeeType='free'` + `shippingFee=0`；否則 `unpaid`/`prepaid` 依付款狀態

付款金額 = **`order.total`**（不再寫死 60）。

---

## 8. 預計修改／新增檔案

### 修改（以 PR #38 為底）

- `lib/line/campaigns/jiba-unbox/flow.ts` — 插入加購狀態、新文案、payload  
- `lib/campaigns/jiba-two-piece/constants.ts` / `copy.ts` / `service.ts`  
- `lib/campaigns/jiba-two-piece/validation.ts` — join intents 擴充  
- `lib/shipping-policy.ts` — 或旁路 `ugcFreeShippingFee()`（避免弄壞後台手動免運）  
- `prisma/schema.prisma` + migration  
- `app/(main)/campaigns/jiba-two-piece/[id]/page.tsx` + `actions.ts` — 商品／警示／退回商品  
- `app/pay/jiba/[token]/*` — 顯示動態 total  
- `lib/line/handle-event.ts` — webhook 冪等鍵  
- `package.json` test glob

### 新增

- `lib/campaigns/product-intent-parser/*`  
- `lib/campaigns/jiba-two-piece/totals.ts`  
- `lib/campaigns/jiba-two-piece/order-items.ts`（gift／addon CRUD）  
- `lib/campaigns/jiba-two-piece/__tests__/parser*.test.ts` / `totals.test.ts` / `webhook-idempotency.test.ts`  
- （Phase B）`lib/payments/ecpay/*` + `app/api/pay/ecpay/webhook/route.ts`

---

## 9. 環境變數

| 變數 | Phase | 說明 |
|------|-------|------|
| `NEXT_PUBLIC_APP_URL` | A | 付款／封面／商店連結 |
| `UGC_ADDON_SHOPPING_ENABLED` | A | 功能旗標，預設 false 直到 QA 通過 |
| `UGC_FREE_SHIPPING_THRESHOLD` | A | 預設 199 |
| `FURMOSA_SHOP_COLLECTION_URL` | A | 預設 `https://furmosa.com/collections/all` |
| `ECPAY_MERCHANT_ID` | B | |
| `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | B | |
| `ECPAY_RETURN_URL` / `ECPAY_ORDER_RESULT_URL` | B | |
| `ECPAY_PAYMENT_ENABLED` | B | false 時走 stub |

---

## 10. 測試計畫（對應需求 18 項）

單元：parser（別名、克數、數量、缺欄、多行、無效克數、歧義、無匹配）  
單元：totals（0／198／199／200／移除加購）  
整合：確認商品才寫 OrderItem；重複 webhook 不雙寫  
整合：審核前價格／庫存變更 → 擋通過  
整合：付款 webhook 兩次 → 僅一筆 QUEUED Shipment  

手動 QA：

1. 開箱→參加→免運規則→逛商店→自然語言加購→確認袋→收件→授權→送審  
2. 玉珊看對話＋商品→通過→付 total→出貨列出現  
3. 不加購→total=60  
4. 找真人／取消／查看目前資料  

---

## 11. 風險與 Rollback

| 風險 | 緩解 |
|------|------|
| PR #38 未合導致雙軌 | 本工作以 #38 為 base；或先合 #38 |
| 商品名與別名不齊 | 上線前用 staging 對真實 catalog 建 alias；NO_MATCH 不幻造 |
| 無 ECPay | Phase A stub 收 `order.total`；旗標切 Phase B |
| 滿額免運與後台手動免運衝突 | UGC 專用計算函式，不改寫既有 admin 表單語意 |
| 建單即出貨舊行為 | UGC 路徑堅持付款後才 `Shipment` |
| Parser 誤匹配 | 一律顧客確認；置信度低走歧義選單 |
| Migration 失敗 | 可逆 SQL；旗標關閉即回舊對話（僅贈品） |

**Rollback 步驟：** 見 §4.5。

---

## 12. 實作分期（建議）

| Phase | 內容 | 可上線？ |
|-------|------|----------|
| **0** | 本計畫審核；合併 PR #38 | — |
| **A** | 加購狀態機 + parser + aliases + totals + OrderItem + 審核頁延伸 + 動態 total stub 付款 | 是（stub 金流） |
| **B** | ECPay 建立付款＋webhook 冪等；取代 stub | 金鑰就緒後 |
| **C** | 7-11 emap 正式選店；別名後台 CRUD | 可選 |

---

## 13. 請審核後確認的決策點

請回覆確認或修改後，再開始寫 migration／程式：

1. **是否同意**以 `ProductPriceTier.id` 作為需求中的 `product_variant_id`？  
2. **是否同意** Phase A 先用付款 stub（金額=`order.total`），Phase B 再接綠界？  
3. **是否同意**收件人維持 application／Shipment，不強制加 Order.recipient_*？  
4. **別名 seed** 要用哪些正式商品名稱／SKU（請提供或授權從現有 catalog 對應）？  
5. **功能旗標**預設關閉，QA 後再開——是否接受？  
6. PR #38 是否先合併進 `main`，再開實作 PR？

---

## 附：需求對照（完成定義）

- [ ] 對話感店員、非表單用語  
- [ ] 加購／滿 199 免運／贈品不計入  
- [ ] Parser + aliases + 只問缺欄 + 確認後才入單  
- [ ] 玉珊審核含商品／對話／警示  
- [ ] 審核＋付款後才 QUEUED  
- [ ] Webhook／付款冪等 + audit  
- [ ] 18 項自動化測試  

**本文件審核通過前：不執行 production migration、不修改 production 資料。**
