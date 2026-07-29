# 計畫：LINE LIFF 換罐付款流程（Stage 5）

> 狀態：可實作方案（規劃定稿）  
> 分支：`cursor/liff-refill-payment-7337`  
> 基準：`docs/FURMOSA-OS-DOMAIN-SPEC-v1.md`、`docs/MERCHANT-POS-FLOW.md`、現有程式碼  
> 產品定案原則：本需求文件（使用者最新指示）優先；與 Domain Spec 衝突處見 §2.3

---

## 1. 現有系統架構摘要

| 層級 | 現況 |
|------|------|
| 框架 | Next.js 14 App Router、TypeScript、Prisma 5、PostgreSQL（Supabase） |
| Auth | HQ JWT cookie；店家 POS `MerchantUser` JWT；LIFF 用 LINE ID Token |
| 會員 | `Customer`（含 `lineUserId`、毛孩欄位一對一，無獨立 Pet 表） |
| 預約 | `Appointment`（`requested` / `confirmed` / `reschedule_proposed` / `cancelled`）綁 `Merchant` |
| 換罐序號 | `JarCode`：`unused` → LINE 兑碼 → `used` + 立即加點 |
| 點數 | `MemberPointsLedger`（全站餘額，非依店）；10 點兑 `GroomingCoupon`（200／豬窩 250） |
| LIFF | `/liff/register`、`/profile`、`/rewards`；無付款頁 |
| 店家 POS | `/pos` 今天／預約／叫貨；「待換罐」標準備中 |
| 綠界 | **未實作**（僅雞霸運費銀行轉帳 stub） |
| RefillOrder | **未實作**（僅 Domain Spec） |

可重用模組：

- `lib/line/*`：LIFF init、ID Token 驗證、`Customer.lineUserId` 綁定、Flex／push、throttle
- `lib/jar-exchange/*`：8 碼格式、ledger append、兑獎、`JAR_EXCHANGE` 商品辨識
- `lib/booking/*`：預約查詢、店家確認、LINE 提醒
- `lib/merchant-auth/*`：POS session／權限
- `lib/config/product-settings.ts`：`WAITING_FOR_JAR_RESERVATION_DAYS`、`POS_BUTTON_LABELS`
- `StatusAuditLog` 模式可參考（目前僅活動用）

命名對照（本需求用語 → 現有模型）：

| 需求用語 | 現有實體 |
|----------|----------|
| memberId | `Customer.id` |
| petId | **無**；用 `Appointment.petName` + `Customer.pet_*` 快照欄位 |
| storeId / merchantId | 預約與 POS 用 `Merchant.id`（`Store` 僅兑券夥伴，勿混用） |
| container serial | `JarCode.code`（擴充生命週期，不另建重複主檔） |

---

## 2. 已有功能與缺少功能

### 2.1 已有（沿用）

- LINE 登入／LIFF 註冊／查點／兑獎
- 預約建立與店家確認（Round 2）
- 8 碼序號產生、列印、LINE 兑碼入點
- 集點 ledger、10 點美容折抵
- POS 帳號與「今天」骨架、叫貨
- 合作店／寄賣庫存（`MerchantStock`）

### 2.2 缺少（本計畫要做）

1. `RefillOrder` / `PaymentOrder` / 付款 audit
2. 綠界 AIO／CheckMacValue／return／server callback／冪等
3. `/liff/refill` 顧客付款流程
4. 資格檢查（確認預約、有效舊罐、防重複訂單）
5. POS 待換罐佇列：驗舊罐、交付、綁新罐、忘帶空罐 A/B
6. 補差額 NT$30 綠界流程
7. 付款／交付後 LINE 通知
8. 狀態機 transition validation + 完成交易 transaction
9. 對應測試（需求 §十四 20 項）

### 2.3 與 Domain Spec 的關鍵決策（必須對齊產品）

| 議題 | Domain Spec | 本需求 | **採用** |
|------|-------------|--------|----------|
| 誰綁新罐序號 | 顧客 LINE 登新罐才加點；店家不輸新序號（JE-06） | 店家輸入／綁定新罐；完成交付即加點 | **本需求**（Stage 5 產品更新）；Spec 文件後續修訂 |
| 狀態名 | `Draft`/`PendingPayment`/`Paid`/`Delivered`/`waiting_for_jar`… | snake_case：`draft`/`payment_pending`/`paid_waiting_return`/… | **本需求 snake_case**；文件對照表見 §4 |
| 加點時機 | 顧客登新罐後 | 舊罐回收＋新罐交付完成 | **本需求**；ledger `sourceType=refill_completed`，`sourceRefId=refillOrderId` 冪等 |
| 點數維度 | 依 Merchant 分開 | 沿用現有全域 ledger／折抵 | **沿用現有**（不在本階段拆 per-merchant points，避免破坏兑券） |
| 庫存 Reserve | webhook 成功後 Reserve | 本需求未強制首版完成 | **Phase B 最小**：付款後可選記 `refill_reservation`；不足時 `payment_needs_hq` 或記錄 audit，不阻塞付款狀態 |
| 舊兑碼流程 | 將被新資產圖取代 | 不可破壞現有 LINE 兑碼 | **雙軌**：`unused→used` 兑碼保留；換罐用 `issued↔returned` |

---

## 3. 預計修改／新增檔案清單

### 3.1 資料庫

- `prisma/schema.prisma` — 新增 `RefillOrder`、`PaymentOrder`、`RefillAuditLog`；擴充 `JarCode`、`Appointment`／`Customer`／`Merchant` 關聯；`MemberPointsLedger` source 註解
- `prisma/migrations/YYYYMMDDHHMMSS_refill_payment/` — 完整 migration

### 3.2 Domain／後端

| 路徑 | 用途 |
|------|------|
| `lib/refill/constants.ts` | 價格 129/99/30、狀態、order_type、允許轉移 |
| `lib/refill/transitions.ts` | 狀態機 validation |
| `lib/refill/eligibility.ts` | 資格檢查 |
| `lib/refill/orders.ts` | 建立／查詢訂單、idempotency |
| `lib/refill/complete.ts` | 驗舊／綁新／完成 transaction＋加點 |
| `lib/refill/missing-container.ts` | 忘帶空罐 A/B |
| `lib/refill/audit.ts` | audit log |
| `lib/refill/copy.ts` | 顧客／錯誤文案 |
| `lib/payments/ecpay/*` | CheckMacValue、建立訂單、callback 解析 |
| `lib/payments/constants.ts` | provider／payment status |
| `lib/jar-exchange/constants.ts` | 擴充 `issued`/`returned`、ledger source |
| `lib/line/liff-config.ts` | 新增 `refill` LIFF page |
| `.env.example` | ECPay＋`LINE_LIFF_ID_REFILL` |

### 3.3 API Routes

顧客（LIFF，ID Token）：

- `GET/POST` `app/api/refill/eligibility/route.ts`
- `GET` `app/api/refill/bookings/route.ts`
- `POST` `app/api/refill/orders/route.ts`
- `GET` `app/api/refill/orders/[id]/route.ts`
- `POST` `app/api/refill/orders/[id]/payment/route.ts`
- `POST` `app/api/refill/orders/[id]/extra-payment/route.ts`

綠界：

- `POST` `app/api/payments/ecpay/callback/route.ts`（webhook 真相）
- `GET/POST` `app/api/payments/ecpay/return/route.ts`（導回＋polling 提示）

店家：

- `GET` `app/api/merchant/refill-orders/route.ts`
- `POST` `app/api/merchant/refill-orders/[id]/verify-old-container/route.ts`
- `POST` `app/api/merchant/refill-orders/[id]/assign-new-container/route.ts`
- `POST` `app/api/merchant/refill-orders/[id]/complete/route.ts`
- `POST` `app/api/merchant/refill-orders/[id]/mark-missing-container/route.ts`

Middleware：放行 `/api/refill`、`/api/payments/ecpay/*`（callback 無 session）。

### 3.4 UI

- `app/liff/refill/*` — 手機優先多步驟
- `components/liff/refill/*`
- `app/pos/refill/*` 或擴充 `app/pos/page.tsx` — 待換罐
- `components/pos/refill-*`
- LINE 選單「我要換罐」連結（`lib/line/comic-menu.ts` / flex）

### 3.5 測試

- `lib/refill/__tests__/*.test.ts`
- `lib/payments/ecpay/__tests__/*.test.ts`
- 更新 `package.json` `test` script

---

## 4. 資料流與狀態流

### 4.1 顧客付款資料流

```text
LINE「我要換罐」→ LIFF /liff/refill(?storeId=)
  → init LIFF + ID Token
  → 無會員 → /liff/register?return=/liff/refill…
  → GET eligibility + bookings（僅未來 confirmed、合作店）
  → 選預約 → POST orders（後端算價 99 或 129）
  → POST payment → 綠界表單
  → ECPay server callback（唯一 paid 真相）
  → return URL → polling GET order →「付款完成／記得帶空罐」
  → LINE push 通知
```

### 4.2 店家交付資料流

```text
POS 待換罐 → 選訂單（必須同 merchantId + 已付款）
  → 輸入舊罐 8 碼 → verify-old-container
       （屬會員、issued、未回收、未被占用）
  → 輸入新罐 → assign-new-container + complete（同 transaction）
       舊→returned、新→issued、訂單 completed、+1 點（若 exchange）、audit
  → LINE「換罐完成」
```

忘帶空罐：

```text
mark-missing-container
  A keep → 維持 paid_waiting_return + note「顧客未帶空罐」
  B topup → awaiting_extra_payment → ECPay 30
       → webhook → 改 first 交付語意（不要求舊罐）→ 交付新罐 → completed（首罐不加換罐點）
```

### 4.3 狀態機（採用本需求）

```text
draft → payment_pending → paid_waiting_return → old_container_verified → completed
                         ↘ payment_failed
payment_pending / * → cancelled | expired（規則限制）
paid_waiting_return → awaiting_extra_payment → paid_waiting_return（補付成功後走首罐交付）
                    → completed（首罐／補差額路徑直接交付，跳過舊罐）
```

對照 Domain Spec：`Paid`≈`paid_waiting_return`；`waiting_for_jar`≈同狀態＋note／旗標；`Delivered+NewSerialRegistered`≈`completed`。

### 4.4 金額（後端固定）

| order_type | base | extra | total |
|------------|------|-------|-------|
| exchange | 99 | 0 | 99 |
| first | 129 | 0 | 129 |
| exchange→topup | 99 | 30 | 129 |

前端傳入金額一律忽略。

---

## 5. 潛在風險

| 風險 | 影響 | 緩解 |
|------|------|------|
| `JarCode` 雙軌狀態 | 兑碼與換罐語意衝突、重複加點 | 明確狀態；完成交付用 `refill_completed`＋`sourceRefId` 唯一；兑碼僅 `unused→used` |
| 歷史序號無 `issued` | 全無 99 資格 | HQ 工具／遷移：曾兑碼或已知出貨的碼可標 `issued`；否則引導首罐 129 |
| Spec vs 需求（新罐誰登） | 文件／訓練不一致 | 本計畫採用店家綁新罐；更新 BIBLES／POS 文案 |
| 綠界環境／CheckMac | 付款錯帳 | staging 金鑰；callback 驗 MAC＋金額＋MerchantTradeNo；重複 callback 冪等 |
| 預約取消後已付款 | 無法領取 | 取消時若已 paid：禁取消或轉 HQ；eligibility／POS 再驗證 |
| PgBouncer＋長交易 | 死鎖／timeout | 短 transaction；callback 快速 ack |
| `/pay` middleware | return URL 被擋 | 使用 `/liff/refill` 與 `/api/payments/ecpay/*` 公開路徑 |
| per-merchant 點數未做 | 與 Spec JE-14 差 | 本階段沿用全域；列為後續風險，不阻塞 LIFF 付款 |
| 庫存 Reserve 未完整 | 超賣 | Phase B 最小 audit；完整 Reserve 列 Phase C |

---

## 6. 分階段實作方案

### Phase A — Schema 與 Domain 核心（先做）

- migration：`refill_orders`、`payment_orders`、`refill_audit_logs`
- `JarCode` 擴充：`issued` / `returned`、時間戳、merchant、`lockedByRefillOrderId`
- constants、transitions、eligibility 純邏輯＋單元測試骨架

### Phase B — 訂單 API＋綠界

- 顧客 eligibility／bookings／orders／payment
- ECPay create＋callback＋return＋payment log
- idempotency（同 booking 不可兩筆有效單；同 trade no 不重覆付）

### Phase C — LIFF UI

- `/liff/refill` 步驟 1–6、註冊 return、storeId QR 備援
- 文案用台灣長輩可懂用語；錯誤映射 `lib/refill/copy.ts`

### Phase D — POS＋忘帶空罐

- 待換罐列表與 ≤3 點擊操作
- verify／assign／complete／missing-container
- 付款 QR（連到 LIFF，店家不代收）

### Phase E — 通知、hardening、測試、build

- LINE 付款成功／交付完成訊息
- 20 項測試、lint、typecheck、build
- 上線檢查清單（見文末）

**刻意延後（不阻塞 MVP）：**

- 完整 per-merchant 點數帳本
- 完整 Inventory Reservation 狀態機與超賣 HQ 工單 UI
- 顧客自行 LINE 登新罐（改由店家綁定）
- Event Store

---

## 7. Schema 草案（擴充優先）

```prisma
model RefillOrder {
  id                    String    @id @default(cuid())
  customerId            String
  appointmentId         String
  merchantId            String
  petName               String?
  productId             String?
  orderType             String    // first | exchange
  baseAmount            Int       // 99 or 129
  extraAmount           Int       @default(0)
  totalAmount           Int
  status                String
  oldContainerSerial    String?
  newContainerSerial    String?
  missingContainerNote  String?
  deliveryMode          String    @default("exchange") // exchange | first
  paidAt                DateTime?
  oldContainerReturnedAt DateTime?
  completedAt           DateTime?
  pointsAwardedAt       DateTime? // 冪等標記
  idempotencyKey        String?   @unique
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  // relations...
}

model PaymentOrder {
  id               String    @id @default(cuid())
  refillOrderId    String
  purpose          String    // refill | extra_topup
  provider         String    @default("ecpay")
  merchantTradeNo  String    @unique
  amount           Int
  status           String    // pending | paid | failed
  providerTradeNo  String?
  paidAt           DateTime?
  callbackPayload  Json?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model RefillAuditLog {
  id            String   @id @default(cuid())
  refillOrderId String?
  paymentOrderId String?
  action        String
  actorType     String   // customer | merchant | system | ecpay
  actorId       String?
  merchantId    String?
  serial        String?
  success       Boolean
  detail        Json?
  createdAt     DateTime @default(now())
}
```

`JarCode` 增量欄位（不刪既有）：

- `status` 允許：`unused | issued | returned | used | expired`
- `issuedAt`、`returnedAt`、`issuedMerchantId`、`returnedMerchantId`、`lockedByRefillOrderId`

---

## 8. 環境變數（將加入 `.env.example`）

```bash
LINE_LIFF_ID_REFILL=

ECPAY_MERCHANT_ID=
ECPAY_HASH_KEY=
ECPAY_HASH_IV=
ECPAY_PAYMENT_URL=https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
# Production: https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5
ECPAY_RETURN_URL=   # 可預設 {APP_URL}/api/payments/ecpay/return
ECPAY_ORDER_RESULT_URL=  # {APP_URL}/api/payments/ecpay/callback
```

Webhook URL（正式）：`https://<domain>/api/payments/ecpay/callback`

---

## 9. LIFF／綠界設定步驟（上線用）

### LIFF

1. LINE Login 頻道 → 新增 LIFF：Endpoint `https://<domain>/liff/refill`，Size Full
2. 設 `LINE_LIFF_ID_REFILL`
3. 富選單／Flex「我要換罐」→ `https://liff.line.me/<LIFF_ID>`
4. 店家 QR：`https://liff.line.me/<LIFF_ID>?storeId=<Merchant.id 或 merchantId>`

### 綠界

1. 廠商後台取得 MerchantID／HashKey／HashIV
2. 先接 Stage，確認 CheckMacValue
3. 設定 OrderResultURL = callback；ClientBackURL／ReturnURL = return
4. 驗證重複通知與金額不符拒絕對帳

---

## 10. 上線前檢查清單

- [ ] migration 已 deploy
- [ ] ECPay 正式／測試金鑰與 URL 正確
- [ ] callback 可從綠界連到（非 localhost）
- [ ] LIFF Endpoint 與 Channel 綁定
- [ ] 至少一間合作店有 confirmed 預約可測
- [ ] 測試會員有 `issued` 舊罐（99）與無舊罐（129）兩案
- [ ] POS 帳號僅能看本店訂單
- [ ] 完成交付只加一次點；重複 complete 不加倍
- [ ] 忘帶空罐不可現金通融
- [ ] 既有 LINE 兑碼入點仍可用
- [ ] lint／typecheck／test／build 全過

---

## 11. 本階段產出進度

| 階段 | 狀態 |
|------|------|
| 架構掃描與本計畫 | ✅ |
| Phase A Schema／Domain | ✅ |
| Phase B 訂單 API＋綠界 callback | ✅ |
| Phase C `/liff/refill` | ✅ 初版 |
| Phase D POS 待換罐／忘帶空罐 | ✅ 初版 |
| Phase E 完整 20 測項／上線清單 | 進行中（純邏輯測已補；DB 整合測待環境） |
