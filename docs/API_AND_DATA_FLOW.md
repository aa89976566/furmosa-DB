# API and Data Flow

**依據：** `app/api/**`, `app/**/actions.ts`, `middleware.ts`

---

## 1. Route Handlers（`app/api`）

| Method / Path | Auth | 服務 | 讀寫 | 外部 | Idempotent | 備註 |
|---------------|------|------|------|------|------------|------|
| `POST /api/auth/logout` | Cookie clear | auth | cookie | — | 是 | |
| `GET\|POST /api/cron/expire-coupons` | Bearer `CRON_SECRET` | coupons expire | GroomingCoupon | — | 大致是 | 未設 secret 時僅 development 放行 |
| `GET\|POST /api/cron/maintain-shipments` | 同上 | sync／ensure／KPI／booking reminders | 多表 | LINE push | 提醒靠 DB 時間戳 | Hobby 每日 |
| `POST /api/line/webhook` | HMAC `x-line-signature` | `handleLineWebhookEvent` | Customer／Jar／Session… | LINE Reply | 事件級待確認 | |
| `GET /api/line/webhook` | 無 | health | — | — | 是 | |
| `POST /api/line/liff/me` | LINE idToken | LIFF dashboard | Customer／points | LINE verify | 是 | |
| `POST /api/line/liff/register` | idToken | 註冊／更新 | Customer | LINE verify | 部分 | |
| `POST /api/line/liff/redeem` | idToken | 兑獎 | points／redemption | LINE verify | 需業務冪等 | |
| `POST /api/coupons` | 無 session；storeId slug | verify／redeem coupon | GroomingCoupon | — | redeem 後不可再兑 | middleware 放行 |
| `GET\|POST /api/admin/ensure-zhuwo` | HQ `getCurrentUser` | ensure merchants | Merchant／Store | — | 大致是 | |
| `GET /api/notifications/new-orders` | HQ session (middleware) | poll orders | Order | — | 是 | |
| `POST /api/notifications/subscribe` | HQ | upsert push | UserPushSubscription | — | upsert | |
| `POST /api/notifications/unsubscribe` | HQ | delete | UserPushSubscription | — | 是 | |
| `GET /api/notifications/vapid-public-key` | middleware HQ | 回傳公鑰 | — | — | 是 | handler 內未再驗 |
| `GET /api/jar-exchange/codes/pdf` | middleware HQ | PDF labels | JarCode | — | 是 | `all=1` 可大量 |

**錯誤：** 多為 JSON `{ ok:false, error }` 或 HTTP 401／400／500；部分 500 回傳 `e.message`。

---

## 2. Server Actions（精選）

| 位置 | 角色 | 代表動作 | 表 |
|------|------|----------|-----|
| `app/login/actions.ts` | 公開 | HQ login | User |
| `app/book/actions.ts` | 公開 | publicBookAction | Appointment, Customer |
| `app/pos/login/actions.ts` | 公開 | POS login | MerchantUser |
| `app/pos/appointments/actions.ts` | Merchant | confirm／reschedule／cancel／create／schedule | Appointment, MerchantSettings |
| `app/pos/restock/actions.ts` | Merchant | 自己選／幫我配 | RestockRequest |
| `app/(main)/restock-requests/actions.ts` | HQ（顯式 requireHqUser） | approve／reject | RestockRequest, Shipment |
| `app/(main)/orders/actions.ts` | HQ（middleware） | CRUD／狀態 | Order |
| `app/(main)/shipments/actions.ts` | HQ | 出貨狀態／入庫副作用 | Shipment, MerchantStock* |
| `app/(main)/jar-exchange/actions.ts` | HQ | 序號／點數／獎勵 | Jar* |
| `app/(main)/merchants/[id]/actions.ts` | HQ | 庫存／銷售／設定 | MerchantStock* |
| 其他 `app/(main)/**/actions.ts` | HQ | 客戶／商品／結算／訂閱／任務 | 各自主檔 |

**角色限制：** POS 用 `requireMerchantSession`；多數 HQ 僅 middleware session，**未**依 `User.role` 細分（例外：restock-requests 有 `requireHqUser`）。

---

## 3. 重複付款／扣庫存／通知風險

| 風險 | 現況 | 依據 |
|------|------|------|
| 重複付款 | 無金流 webhook；Order.paymentStatus 人工／表單 | 無 ECPay code |
| 重複扣／入庫 | merchant_restock 以 txn note 冪等 | `merchant-restock-inventory.ts` |
| 重複 Restock Shipment | shipmentId unique + approve claim | restock service |
| 重複預約 | Serializable tx | booking service |
| 重複 LINE 通知 | `lineNotify*At`／`lineReminder*At` | booking notify／reminders |
| 重複兑碼 | JarCode status 轉換（transaction） | redeem-code |

---

## 4. Sequence — 顧客預約（主要使用者流程）

```mermaid
sequenceDiagram
  actor C as Customer
  participant Book as app/book
  participant Act as publicBookAction
  participant Svc as lib/booking/service
  participant DB as Postgres
  participant N as lib/booking/notify
  participant LINE as LINE Push API
  actor M as Merchant POS

  C->>Book: 選時段並送出
  Book->>Act: FormData (+ optional idToken)
  Act->>Svc: submitCustomerBooking
  Svc->>DB: Serializable tx create Appointment requested
  Svc-->>Act: appointment
  Act-->>C: redirect /done
  Svc->>N: fireAndForget notifyRequested
  N->>DB: read customer/merchant settings
  N->>LINE: 顧客已收到 / 店家有新預約
  M->>M: confirmAppointmentAction
  M->>Svc: confirmAppointment
  Svc->>DB: status confirmed
  Svc->>N: notifyConfirmed
  N->>LINE: 預約已確認
```

---

## 5. Sequence — Webhook（LINE；非付款）

> 付款 webhook：**未實作**。以下為現行 LINE webhook。

```mermaid
sequenceDiagram
  participant LINE as LINE Platform
  participant WH as POST /api/line/webhook
  participant Sig as verify-signature
  participant H as handleLineWebhookEvent
  participant DB as Postgres
  participant Reply as LINE Reply API

  LINE->>WH: events + x-line-signature
  WH->>Sig: HMAC-SHA256 body
  alt invalid signature
    WH-->>LINE: 401
  else ok
    WH->>H: each event
    H->>DB: session / customer / jar redeem...
    H->>Reply: reply messages
    WH-->>LINE: 200
  end
```

---

## 6. Sequence — 叫貨與入庫（庫存／預約相關）

```mermaid
sequenceDiagram
  actor Store as Merchant POS
  actor HQ as HQ User
  participant RS as restock-request/service
  participant MRO as merchant-restock-order
  participant Ship as shipments/actions
  participant Inv as merchant-restock-inventory
  participant DB as Postgres

  Store->>RS: submitSelfSelect / AutoReplenish
  RS->>DB: RestockRequest submitted
  HQ->>RS: approveAndConvert
  RS->>MRO: createRestockOrderWithShipment
  MRO->>DB: Order + Shipment merchant_restock
  RS->>DB: RestockRequest converted_to_shipment
  HQ->>Ship: mark shipped/delivered
  Ship->>Inv: apply restock inventory
  Inv->>DB: MerchantStock upsert + MerchantStockTxn (idempotent)
```

---

## 7. 認證需求速查

| 區域 | 機制 |
|------|------|
| `/pos/*`（除 login） | merchant JWT |
| `/ (main)/*` | HQ JWT |
| `/book/*`, `/liff/*` | 公開／LIFF token |
| `/api/line/*` | signature 或 idToken |
| `/api/cron/*` | CRON_SECRET |
| `/api/coupons` | storeId 驗證 |
