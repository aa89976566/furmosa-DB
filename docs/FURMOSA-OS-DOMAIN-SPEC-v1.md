# Furmosa OS Domain Specification v1

> **地位：** 整份 Furmosa 未來五年的憲法（Single Source of Truth）  
> **版本：** v1.0-draft  
> **制定日期：** 2026-07-21  
> **範圍：** 定義業務規則與領域邊界；**不含** Prisma schema、migration、實作程式碼  
> **下一里程碑：** 本文件定案後，才允許開始 Schema / Migration / Code

---

## 0. 文件定位與硬性約束

### 0.1 我們在建什麼

**Furmosa OS（Operating System）** — 長期寵物商業生態系平台，不是 POS、不是零食管理系統、也不是單純的 HQ 後台。

美容、換罐、寄賣、訂閱、獎勵……全部都是 **Module**。  
真正跨模組共用的核心是：

**Customer · Pet · Merchant · Product · Asset · Payment · Event · Notification**

### 0.2 第一性原理

所有業務只回答四個問題：

| 問題 | 對應 |
|------|------|
| 誰？ | Customer / Pet / Merchant / MerchantUser |
| 在哪？ | Branch / Merchant / Warehouse |
| 發生什麼？ | Event（業務事實） |
| 何時？ | Event.occurredAt / 狀態機時間戳 |

### 0.3 本文件硬性約束（給實作團隊）

1. **本階段禁止**寫 schema、migration、程式碼、PoC。
2. **本階段禁止**全面 Event Sourcing 重寫。
3. Event 清單只做**業務事件目錄**（語意凍結），不當成實作契約。
4. 現有 HQ（訂單／寄賣／庫存／換罐點數）繼續運作；本 Spec 定義的是**目標領域真相**。
5. 第一個要跑通的產品線：**美容預約 + 換罐**，不是整個平台重構。

### 0.4 CURRENT vs TARGET 標記

| 標記 | 意義 |
|------|------|
| **CURRENT** | 今日程式／資料庫已存在的行為 |
| **TARGET** | 本 Spec 定案後必須遵守的業務規則（可能尚未實作） |
| **OPEN** | 仍需產品決策才能凍結 |

---

## 1. System Context Map

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Furmosa OS                              │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │ Core Identity│   │   Booking    │   │    Refill    │         │
│  │ Customer     │──▶│ Appointment  │──▶│ RefillOrder  │         │
│  │ Pet          │   │ Technician   │   │ Asset xfer   │         │
│  └──────────────┘   └──────┬───────┘   └──────┬───────┘         │
│           │                │                  │                 │
│           ▼                ▼                  ▼                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │   Commerce   │   │  Inventory   │   │   Rewards    │         │
│  │ Product      │   │ Reservation  │   │ Ledger/Event │         │
│  │ Order*       │   │ Stock        │   │ Coupon       │         │
│  │ Payment      │   │ Restock      │   └──────────────┘         │
│  └──────────────┘   └──────────────┘                            │
│           │                │                  │                 │
│           └────────────────┼──────────────────┘                 │
│                            ▼                                    │
│                   ┌──────────────┐                              │
│                   │ Notification │◀── 所有 Context 的出口        │
│                   │ (Adapters)   │                              │
│                   └──────────────┘                              │
│                            │                                    │
│                   ┌──────────────┐                              │
│                   │ Settlement   │  Merchant ↔ HQ 金流對帳       │
│                   └──────────────┘                              │
│                   ┌──────────────┐                              │
│                   │    Admin     │  HQ 營運／審核／主檔          │
│                   └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘

Actors outside:
  Customer (LINE / Booking UI)
  MerchantUser (POS)
  HQ Staff (Admin)
  Payment Gateway (ECPay) — TARGET
  Warehouse / Logistics
```

### 1.1 各實體職責（Responsibility）

| 實體 | 一句話職責 | 不是什麼 |
|------|------------|----------|
| **Customer** | 跨店唯一的「人」；生命週期與所有服務的錨點 | 不是「會員卡」、不是點數帳戶本身 |
| **Pet** | 獨立生命體；美容／住宿／醫療未來共用主體 | 不是 Appointment 的欄位 |
| **Merchant** | 合作夥伴組織（品牌／業主） | 不是單一分店、不是 Warehouse |
| **Branch** | Merchant 底下可預約／可核銷的實體據點 | CURRENT 多半把 Store 當 Branch 用 |
| **MerchantUser** | 店家端操作者（登入、班表、核銷、確認預約） | 不是 HQ `User` |
| **Appointment** | 美容（或其他服務）時段與履約契約 | 不是 Payment、不是 Refill |
| **Refill**（RefillOrder） | 換罐履約單：舊罐驗證 → 新罐配發 → 獎勵 | 不是 JarCode 狀態欄位本身 |
| **Payment** | 金流事實：誰付給誰、多少、透過什麼管道 | 不是 Appointment 的子狀態 |
| **Inventory** | 可售／可配發數量與保留（含換罐商品） | 不是 Asset 序號本體 |
| **Reward** | 點數與兌換權益的事實流 | 不是 Customer 上的餘額欄位 |
| **Asset** | 有序號的可追蹤物（玻璃罐、未來會員卡／晶片） | 不是 Product SKU |
| **Notification** | 對 Actor 的對外溝通意圖與投遞 | 不是 LINE SDK 呼叫本身 |
| **Product** | 可販售／可履約的品項類型（零食／服務／券／贈品） | 不是 Asset 實例 |
| **Event**（業務事件） | 「發生過什麼」的不可變事實目錄 | 本階段不實作 Event Store |

### 1.2 Actor 一覽

| Actor | 入口 | 可做的事 |
|-------|------|----------|
| Customer | LINE / Booking 前台 | 預約、預付換罐、到店、收通知 |
| MerchantUser | POS | 班表、確認預約、驗舊罐、輸新罐、叫貨 |
| HQ Staff | Admin | 主檔、審核叫貨、結算、序號批次、例外處理（僅規格允許者） |
| System | Cron / Webhook | 逾時、提醒、金流回呼、庫存釋放 |

---

## 2. Bounded Contexts

> 原則：**每個 Entity 只有一個 Owner Context。**  
> 其他 Context 只能引用 ID，不能擁有／隨意改寫對方的不變量。

### 2.1 Context 清單與所有權

| Bounded Context | Owns（擁有） | References（只引用） | 對外發布的關鍵業務事件 |
|-----------------|--------------|----------------------|------------------------|
| **Core Identity** | Customer, Pet, Customer↔Pet, LINE 綁定身份 | Merchant/Branch（開戶店） | `CustomerRegistered`, `PetProfileUpdated` |
| **Booking** | Appointment, Technician, Schedule/Slot, CustomerRating（店評客） | Customer, Pet, Branch, MerchantUser, Product(Service) | `AppointmentCreated`, `AppointmentConfirmed`, `AppointmentCheckedIn`, `AppointmentCompleted`, `AppointmentNoShow`, `AppointmentCancelled` |
| **Refill** | RefillOrder, ReturnedJarVerification, NewJarAssignment | Customer, Asset, Branch, Inventory Reservation, Payment | `RefillRequested`, `ReturnedJarVerified`, `ReturnedJarRejected`, `NewJarAssigned`, `RefillCompleted`, `ForgotJarOptionChosen` |
| **Commerce** | Product（類型）, Payment, （既有 Order 作為銷售憑證過渡） | Customer, Merchant | `PaymentInitiated`, `PaymentCompleted`, `PaymentFailed`, `PaymentRefunded` |
| **Inventory** | Warehouse stock, Merchant/Branch stock, **InventoryReservation** | Product, Branch, RefillOrder/Appointment | `StockReserved`, `StockReleased`, `StockConsumed`, `RestockRequested`, `RestockApproved` |
| **Rewards** | Points ledger 語意, Reward catalog, Coupon issuance | Customer, Merchant/Branch | `RewardEarned`, `RewardRedeemed`, `CouponIssued`, `CouponRedeemed`, `CouponExpired` |
| **Settlement** | Settlement period, merchant payouts, refill subsidy lines | Merchant, Payment, Rewards cost | `SettlementOpened`, `SettlementClosed`, `PayoutRecorded` |
| **Notification** | NotificationIntent, DeliveryAttempt, Template, Channel preference | 任何 Context 的 Actor ID | `NotificationRequested`, `NotificationDelivered`, `NotificationFailed` |
| **Admin** | HQ User, Task, 主檔維護流程、審核工作佇列 | 全部（操作介面，不擁有業務不變量） | （多為操作結果轉發他 Context 事件） |
| **Asset**（可為 Refill 子域或獨立 Core） | Asset（序號、當前 Owner、類型） | Customer, Merchant, Warehouse | `AssetIssued`, `AssetTransferred`, `AssetRetired` |

### 2.2 邊界規則（不可違反）

1. **Booking 不擁有 Payment** — 預約只引用 `paymentId`；美容費可能根本不經 Furmosa Payment（見 §5）。
2. **Refill 不擁有 Inventory 數量** — 只請求 Reservation；扣庫存由 Inventory 執行。
3. **Rewards 不寫 Asset** — 換罐成功由 Refill 發出事實後，Rewards 入點。
4. **Notification 不包含業務決策** — 只接收「請通知」意圖；重試／通道選擇在此 Context。
5. **Merchant 與 Branch** — 多據點時 Merchant 是組織，Branch 是履約點；CURRENT 的 `Store` 應對齊為 Branch 概念（遷移策略見 §8）。

### 2.3 與現有 POS 計畫文件的關係

既有 `docs/PLAN-pos-booking-system.md`（店家 POS＋預約擴充計畫）仍有效，定位為**工程落地路線圖**。  
**本文件優先於該計畫的業務語義**；若衝突，以本 Domain Spec 為準，再回頭改計畫文件。

---

## 3. Customer Journey

> 主路徑：**預約美容 + 換罐**（可只預約美容、或美容＋換罐；本節以「兩者一起」為完整路徑）。

### 3.0 旅程總覽

```text
Book Grooming
  → Merchant Confirm
  → LINE Payment（僅換罐預付；美容費除外）
  → Arrival / Check-in
  → Return Jar（驗舊序號）
  → Receive New Jar
  → Input New Jar Serial
  → Reward Earned
  → Next Booking（循環）
```

### 3.1 Step-by-step

#### Step 1 — Book Grooming（建立預約）

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer |
| **Input** | Branch、服務 Product（美容）、Pet、時段、技師（可選）、是否加換罐（Refill） |
| **Output** | Appointment = `Requested`（或直接進待確認）；若含換罐 → RefillOrder = `Draft`/`PendingPayment` |
| **Database Change（語意）** | 新增 Appointment；可選新增 RefillOrder 連結；**請求** Inventory Reservation（換罐商品 ×1，綁定該 Branch） |
| **LINE Notification** | 「預約已送出，等待店家確認」 |
| **Inventory Change** | Soft reserve：該 Branch 可換罐庫存 −1（保留，未消耗） |
| **Reward Change** | 無 |
| **Payment Change** | 若含換罐：建立 Payment Intent（金額見 §5）；美容費**不**建立 Furmosa Payment |

#### Step 2 — Merchant Confirm

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 確認／拒絕／請客人改期；技師最終指派 |
| **Output** | Appointment = `Confirmed` 或 `Rejected`/`Cancelled` |
| **Database Change** | Appointment 狀態轉移；拒絕時釋放 Reservation |
| **LINE Notification** | 確認成功／請改期／已拒絕 |
| **Inventory Change** | 確認：保留維持；拒絕：Release |
| **Reward Change** | 無 |
| **Payment Change** | 確認後才允許／觸發換罐付款連結（若尚未付） |

#### Step 3 — LINE Payment（換罐預付）

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer + Payment Gateway（ECPay） |
| **Input** | 付款連結；規則金額（首罐 129 / 換罐 99；忘帶罐 30 見 §5） |
| **Output** | Payment = `Completed`；RefillOrder = `Paid`/`ReadyForFulfillment` |
| **Database Change** | Payment 完成；RefillOrder 可履約 |
| **LINE Notification** | 付款成功＋到店提醒（含「請帶空罐」） |
| **Inventory Change** | Reservation 維持（已付更能保證履約） |
| **Reward Change** | 無（入點在新罐配發後） |
| **Payment Change** | `Initiated` → `Completed`（失敗則 `Failed`，可重試） |

#### Step 4 — Arrival（到店／Check-in）

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser（為主）；Customer 出示身分 |
| **Input** | Appointment 識別（QR／手機／姓名） |
| **Output** | Appointment = `CheckedIn` |
| **Database Change** | Check-in 時間 |
| **LINE Notification** | 可選「已報到」 |
| **Inventory / Reward / Payment** | 無必然變更 |

#### Step 5 — Return Jar（歸還舊罐／驗序號）

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 舊罐序號；系統驗證：屬於該 Customer、且仍可換（見 §5） |
| **Output** | `ReturnedJarVerified` 或 `ReturnedJarRejected`；若忘帶罐 → 僅允許 §5.4 兩動作 |
| **Database Change** | RefillOrder 標記 returned serial；Asset Owner：Customer → Merchant（語意） |
| **LINE Notification** | 驗證失敗時通知客人原因；成功可靜默或簡訊確認 |
| **Inventory Change** | 無（舊罐是 Asset，不是可售庫存扣減） |
| **Reward Change** | 無 |
| **Payment Change** | 無（除非走忘帶罐 NT$30 連結） |

#### Step 6 — Receive New Jar + Input New Serial

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 新罐實體序號（必須 unique、來自該店可配發庫存／Asset 池） |
| **Output** | `NewJarAssigned`；RefillOrder → `Completed`；Appointment 可 → `Completed`（若服務也完成） |
| **Database Change** | Asset Owner：Warehouse/Merchant → Customer；序號綁定 Customer |
| **LINE Notification** | 「換罐完成」 |
| **Inventory Change** | Reservation → Consume（Branch 換罐可售／可配發 −1 落實） |
| **Reward Change** | 觸發入點（見下一步） |
| **Payment Change** | 無（已預付）；結算側記一筆可對帳事實 |

#### Step 7 — Reward Earned

| 欄位 | 內容 |
|------|------|
| **Actor** | System（Rewards） |
| **Input** | `NewJarAssigned` / `RefillCompleted` |
| **Output** | `RewardEarned`（預設 +1，活動可 +N） |
| **Database Change** | 點數帳本新增一筆（append-only） |
| **LINE Notification** | 「點數 +N，目前餘額 X」 |
| **Inventory / Payment** | 無 |

#### Step 8 — Next Booking

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer / Notification |
| **Input** | 建議回訪日、優惠、剩餘點數 |
| **Output** | 可開新 Appointment；或排程提醒 |
| **Database Change** | 無必然；可建 NotificationIntent |
| **LINE Notification** | 回訪／帶罐提醒 |
| **Inventory / Reward / Payment** | 無 |

### 3.2 變體路徑（必須同樣凍結）

| 變體 | 規則 |
|------|------|
| 只預約美容、不換罐 | 無 RefillOrder、無換罐 Payment、無 Reservation |
| 預約時選換罐但未付款 | 不可履約換罐；Appointment 美容仍可進行（OPEN：是否允許到店補付 — 預設**僅線上預付**） |
| 店家拒絕預約 | 釋放 Reservation；已付款則走退款流程 |
| No-show | Appointment=`NoShow`；Reservation 釋放策略見 §6；已付換罐是否自動退 — **OPEN** |
| 爽約／改期 | 僅 MerchantUser 或規格允許的 Customer 自助；一律發 Notification |

---

## 4. Merchant Journey

```text
Merchant Login
  → Manage Schedule
  → Confirm Appointment
  → Verify Returned Jar Serial
  → Input New Jar Serial
  → Deliver Product / Complete Service
  → Settlement
```

### 4.1 Step-by-step

#### M1 — Merchant Login

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 帳密（綁定 Merchant／Branch） |
| **Output** | POS Session；資料範圍僅自己的 Merchant/Branch |
| **規則** | 看不到 HQ、看不到他店；CURRENT 尚無 MerchantUser（TARGET） |

#### M2 — Manage Schedule

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 技師、可預約時段、公休、服務時長 |
| **Output** | 可被 Booking 前台查詢的 Slot |
| **Notification** | 無（除非班表異動影響已確認預約 → 必須通知） |

#### M3 — Confirm Appointment

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 待確認清單 |
| **Output** | Confirmed / 請改期 / Rejected |
| **規則** | 技師臨時無法出席時，**店家必須主動處理**；系統提供「需聯絡客人」工作項 + Notification（見既有 POS 計畫） |

#### M4 — Verify Returned Jar Serial

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 舊序號 |
| **允許結果** | 通過 / 拒絕（附原因碼） |
| **禁止** | 手動覆寫「當作通過」（No manual override） |
| **忘帶罐** | 僅 A：產生 NT$30 付款連結；或 B：保留本次換罐履約（Keep refill reserved）。見 §5.4 |

#### M5 — Input New Jar Serial

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 新序號 |
| **規則** | 必須 unique；必須屬於可配發給該 Branch 的 Asset／庫存；配發後不可重複使用 |
| **Output** | 換罐完成；觸發 Reward |

#### M6 — Deliver Product / Complete Service

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 美容完成、新品交付確認 |
| **Output** | Appointment Completed；Refill Completed |
| **金流** | 美容費由店家向客人收取（店外／店內），**不經** Furmosa 換罐收款 |

#### M7 — Settlement

| 欄位 | 內容 |
|------|------|
| **Actor** | HQ Staff + System；MerchantUser 唯讀對帳 |
| **Input** | 期間內寄賣銷售、換罐補貼、獎勵成本等 |
| **Output** | Settlement Closed / Payout |
| **規則** | Merchant **從不**代收換罐款；換罐款在 ECPay → Furmosa；結算處理的是分潤／補貼／贈品成本，不是代收款轉付 |

---

## 5. Jar Exchange Rules（最重要）

> 本節為**業務憲法**。實作不得違反。若要改價格或流程，必須升版本 Spec。

### 5.1 價格與交換不變量（TARGET）

| 規則 ID | 規則 |
|---------|------|
| JE-01 | **首罐** = NT$129 |
| JE-02 | **換罐** = NT$99 |
| JE-03 | **一舊換一新**（1 returned serial ↔ 1 new serial） |
| JE-04 | 客人**線上預付**換罐費（ECPay）；**Merchant 永不代收**換罐款 |
| JE-05 | **美容費**由客人直接付給 Merchant；Furmosa **不經手**美容費（本階段） |
| JE-06 | Merchant 在換罐流程中**只做兩件事**：驗證舊序號、輸入新序號 |
| JE-07 | 客人只能兌換／履約**其預約 Branch** 的庫存（不可跨店拿貨） |
| JE-08 | 每一新罐有**唯一序號**；每一歸還罐有**唯一序號** |
| JE-09 | 歸還序號必須：(a) 屬於該 Customer (b) 狀態仍可換（尚未作廢／未重複歸還） |
| JE-10 | **禁止**人工覆寫驗證結果（No manual override） |

### 5.2 CURRENT 對照（避免混淆）

| 項目 | CURRENT（今日系統） | TARGET（本 Spec） |
|------|---------------------|-------------------|
| 價格 129 / 99 | **未實作** | 必須 |
| 忘帶罐 30 | **未實作** | NT$30 **付款連結**（不是 30 點） |
| 序號 | `JarCode` 8 碼；客人 LINE 自行兑點 | 店家 POS 驗舊／輸新；Asset 語意 |
| 點數 | 預設兑碼 +1；帳本 append-only | 新罐配發後 `RewardEarned`（預設 +1） |
| 庫存保留 | **無** Reservation | 預約換罐即 Reserve |
| ECPay | **無** | 換罐預付必備 |
| 美容預約 | **無**（僅有美容券兑點） | Booking Context |

### 5.3 序號驗證演算法（語意）

```text
verifyReturnedSerial(customerId, serial, refillOrderId):
  1. serial 必須存在於 Asset 登記
  2. Asset.currentOwner == Customer(customerId)
  3. Asset 必須 exchangeable == true（未 retired、未已在另一筆未完成 Refill 中）
  4. RefillOrder.branch 必須是履約店
  5. 通過 → emit ReturnedJarVerified
     失敗 → emit ReturnedJarRejected(reasonCode)
  6. 任何失敗都不可被 MerchantUser「強制通過」
```

### 5.4 客人忘帶罐（僅兩動作）

| 選項 | 行為 | 結果 |
|------|------|------|
| **A. Generate NT$30 payment link** | 建立 Payment(NT$30, reason=`forgot_jar_fee`) | 付完後允許**不驗舊罐**完成本次新罐配發的條件（仍須輸新序號）；舊 Asset 不轉移 |
| **B. Keep refill reserved** | 不完成換罐；Appointment 美容可繼續 | Reservation 維持至規則逾時或下次到店；RefillOrder = `WaitingForJar` |

**禁止第三條路：** 口頭答應、手動改庫存、手動加點、略過序號。

### 5.5 首罐 vs 換罐判定（TARGET）

```text
if Customer 名下沒有任何可追蹤的 Jar Asset（或歷史從未成功持有）:
  price = 129  // First jar
else:
  price = 99   // Exchange
```

**OPEN：** 「首罐」是否以「曾完成過一次 NewJarAssigned」為準，或「名下目前持有 ≥1」為準 — 定案前不得實作收費。  
**建議預設：** 以「歷史是否曾 `NewJarAssigned` 成功」判定首罐；之後一律 99（忘帶罐費另計）。

### 5.6 庫存與跨店

- Reservation 綁定 **Branch + Product(換罐品項) + qty=1 + refillOrderId**
- Consume 僅能在同一 Branch
- 他店庫存不可見、不可扣（客人端與店家端皆然）

### 5.7 Merchant 與金流邊界（重申）

```text
Customer ──ECPay──▶ Furmosa   （換罐 129/99/30）
Customer ──現金/店內──▶ Merchant （美容費）
Furmosa ──Settlement──▶ Merchant （寄賣分潤／補貼等，非代收換罐）
```

---

## 6. State Machines

> 狀態是**投影**；轉移必須對應業務事件。  
> 本階段定義轉移表即可，不實作 Event Store。

### 6.1 Appointment

```text
[*] → Requested → Confirmed → CheckedIn → Completed
                 ↘ Rejected
                 ↘ Cancelled
        Confirmed → Cancelled
        Confirmed → NoShow
        CheckedIn → Completed
        Confirmed → RescheduleRequested → Confirmed（新時段）
```

| From | To | Trigger | Actor | 副作用 |
|------|-----|---------|-------|--------|
| — | Requested | 建立預約 | Customer | 可建 RefillDraft；Reserve 庫存 |
| Requested | Confirmed | 店家確認 | MerchantUser | 可觸發付款 |
| Requested | Rejected | 店家拒絕 | MerchantUser | Release 庫存；通知 |
| Requested/Confirmed | Cancelled | 取消 | Customer/MerchantUser/System | Release；退款策略 |
| Confirmed | CheckedIn | 報到 | MerchantUser | — |
| CheckedIn | Completed | 服務完成 | MerchantUser | — |
| Confirmed | NoShow | 逾時未到 | System/MerchantUser | Release 策略 |
| Confirmed | RescheduleRequested | 改期請求 | 任一方 | 通知；Slot 交換規則 |

### 6.2 RefillOrder

```text
[*] → Draft → PendingPayment → Paid → InFulfillment → Completed
                              ↘ PaymentFailed → PendingPayment（重試）
         Paid → WaitingForJar（忘帶罐選 B）
         WaitingForJar → InFulfillment
         InFulfillment → Completed
         * → Cancelled（未履約前）
```

| From | To | Trigger | 副作用 |
|------|-----|---------|--------|
| Draft | PendingPayment | 需預付 | 建立 Payment |
| PendingPayment | Paid | ECPay 成功 | Ready |
| Paid | InFulfillment | Check-in + 開始驗罐 | — |
| InFulfillment | Completed | 新序號寫入成功 | Consume 庫存；RewardEarned |
| Paid/InFulfillment | WaitingForJar | 忘帶罐選 B | 保留 Reservation |
| * | Cancelled | 取消預約／拒絕 | Release；退款若已付 |

### 6.3 Payment

```text
[*] → Initiated → Completed
                ↘ Failed → Initiated（重試）
       Completed → Refunded（全額或部分）
```

| 用途 | amount 來源 |
|------|-------------|
| `refill_first` | 129 |
| `refill_exchange` | 99 |
| `forgot_jar_fee` | 30 |
| （未來）其他 | 禁止與美容費混單 |

### 6.4 Inventory Reservation

```text
[*] → Reserved → Consumed
               ↘ Released
```

| From | To | Trigger |
|------|-----|---------|
| — | Reserved | 預約含換罐且建立成功 |
| Reserved | Consumed | NewJarAssigned |
| Reserved | Released | 取消／拒絕／NoShow 策略／逾時 |

**OPEN：** NoShow 後 Reservation 保留多久；WaitingForJar 最長保留多久。

### 6.5 Reward（帳本語意，非餘額狀態機）

點數**沒有** ACTIVE/USED 狀態機；只有帳本分錄：

| 事件 | pointsChange |
|------|--------------|
| RewardEarned | +N（預設 +1） |
| RewardRedeemed | −N |
| ManualAdjustment | ±N（僅 HQ，需稽核） |
| Expiry（若啟用） | −N |

Coupon（美容券等）另有：

```text
Issued → Redeemed
       ↘ Expired
       ↘ Cancelled
```

### 6.6 Notification

```text
[*] → Requested → Sending → Delivered
                          ↘ Failed → Sending（重試至上限）
                          ↘ DeadLetter
```

| 欄位語意 | 說明 |
|----------|------|
| Intent | 業務為什麼通知（templateKey + payload） |
| Channel | LINE / Push / Email / WhatsApp…（Adapter） |
| Attempt | 每次投遞嘗試 |

---

## 7. Event List（業務事件目錄）

> **只定義、不實作 Event Sourcing。**  
> 命名：過去式、業務語言、無 UI 動詞。

### 7.1 Core Identity

- `CustomerRegistered`
- `CustomerProfileUpdated`
- `CustomerLineLinked`
- `PetRegistered`
- `PetProfileUpdated`

### 7.2 Booking

- `AppointmentCreated`
- `AppointmentConfirmed`
- `AppointmentRejected`
- `AppointmentCancelled`
- `AppointmentRescheduleRequested`
- `AppointmentRescheduled`
- `AppointmentCheckedIn`
- `AppointmentCompleted`
- `AppointmentNoShow`
- `TechnicianAssigned`
- `TechnicianChanged`
- `CustomerRatedByMerchant`

### 7.3 Refill / Asset

- `RefillRequested`
- `RefillCancelled`
- `ReturnedJarVerified`
- `ReturnedJarRejected`
- `ForgotJarFeeLinkGenerated`
- `ForgotJarKeepReserved`
- `NewJarAssigned`
- `RefillCompleted`
- `AssetIssued`
- `AssetTransferred`
- `AssetRetired`

### 7.4 Payment

- `PaymentInitiated`
- `PaymentCompleted`
- `PaymentFailed`
- `PaymentRefunded`

### 7.5 Inventory

- `StockReserved`
- `StockReleased`
- `StockConsumed`
- `RestockRequested`
- `RestockApproved`
- `RestockRejected`
- `RestockReceived`
- `MerchantStockAdjusted`

### 7.6 Rewards

- `RewardEarned`
- `RewardRedeemed`
- `CouponIssued`
- `CouponRedeemed`
- `CouponExpired`
- `CouponCancelled`

### 7.7 Settlement

- `SettlementOpened`
- `SettlementLineAdded`
- `SettlementClosed`
- `PayoutRecorded`

### 7.8 Notification

- `NotificationRequested`
- `NotificationDelivered`
- `NotificationFailed`
- `NotificationDeadLettered`

### 7.9 第一版必須覆蓋的通知場景（Notification Context）

| templateKey | 觸發事件／時機 | 預設 Channel |
|-------------|----------------|--------------|
| `booking.requested` | AppointmentCreated | LINE |
| `booking.confirmed` | AppointmentConfirmed | LINE |
| `booking.reminder` | 到店前 T−N | LINE |
| `booking.bring_jar` | 含換罐的 Confirmed／Paid | LINE |
| `booking.cancelled` | Cancelled | LINE |
| `booking.technician_changed` | TechnicianChanged | LINE |
| `payment.reminder` | PendingPayment 逾時前 | LINE |
| `payment.completed` | PaymentCompleted | LINE |
| `refill.completed` | RefillCompleted | LINE |
| `reward.earned` | RewardEarned | LINE |
| `reward.coupon_expiring` | Coupon 到期前 | LINE |
| `restock.approved` | RestockApproved | LINE 或 POS Push |
| `subscription.reminder` | （既有訂閱模組，未來） | LINE |

**架構原則：** LINE / Email / WhatsApp / Web Push = **Adapter**。  
業務只發 `NotificationRequested`；禁止各模組直接散落呼叫 LINE SDK（既有程式應逐步收斂）。

---

## 8. Prisma Impact Analysis（僅分析，不實作）

> 業務規則凍結後才進入本節執行。此處先列**影響地圖**，方便評估，**不是** migration 指令。

### 8.1 CURRENT schema 能力摘要

| 已有 | 缺口（相對本 Spec） |
|------|---------------------|
| Customer（含 Pet 欄位扁平化） | Pet 獨立實體 |
| Merchant、Store（平行） | Branch／MerchantUser 清晰模型 |
| JarCode + status unused/used | Asset + Owner Transfer 語意 |
| MemberPointsLedger | 與 RefillCompleted 事件銜接 |
| Product / Order / Shipment / Stock | InventoryReservation |
| 無 Appointment | Booking 全套 |
| 無 Payment entity | Payment + ECPay |
| 無 NotificationIntent | Notification Context |
| GroomingCoupon（兑點券） | 與「預約美容服務」分離清楚 |

### 8.2 Required schema（概念層，非 Prisma）

需要新增的**概念**（名稱可調，語意不可調）：

- Pet  
- Branch（對齊／取代 Store 概念）  
- MerchantUser  
- Technician, ScheduleSlot  
- Appointment  
- RefillOrder  
- Payment  
- InventoryReservation  
- Asset（可從 JarCode 演化）  
- NotificationIntent, NotificationDelivery  
- （可選）DomainEventOutbox — **非本階段必做**

### 8.3 Migration strategy（建議原則）

| 策略 | 說明 |
|------|------|
| **Expand–Migrate–Contract** | 先加新表／新欄，雙寫或讀時相容，再切流量，最後刪舊欄 |
| **JarCode → Asset** | 先把 JarCode 視為 Asset 的一種 type；status 與 Owner 並行一段時間 |
| **Pet 拆表** | 從 Customer.pet_* 搬到 Pet；一客多寵預留 |
| **Store → Branch** | 以 slug／merchant 對應遷移；核銷 API 維持相容期間 |
| **不一次 Event Sourcing** | 先狀態機 + 明確事件目錄；Outbox 可選 |

### 8.4 Compatibility

| 必須保持可用 | 說明 |
|--------------|------|
| HQ 訂單／寄賣／結算 | 不因 Booking 上線而中斷 |
| LINE 兑罐碼入點 | 過渡期可與 POS 驗罐並存，但規則要標清「哪條是主路徑」 |
| 既有 GroomingCoupon | 繼續是 Rewards 兑券；與 Appointment 服務是不同產品 |

### 8.5 Breaking changes（若直接做會痛的）

| 變更 | 風險 |
|------|------|
| 刪 JarCode.status 改純 Owner | 既有兑碼流程、報表 |
| 強制 Pet 必填獨立表 | LINE 註冊流程 |
| Merchant 直接當 Branch | 多據點品牌（豬窩多店）會歪 |
| 各處直接打 LINE API | 無法做通知稽核與多通道 |

### 8.6 實作順序建議（Spec 定案後）

1. **Product Spec 已完成（本文件）→ 產品確認 OPEN 項**  
2. Schema 最小增量：MerchantUser → Appointment → Payment → RefillOrder → Reservation  
3. Asset 演化（Jar）與 POS 驗罐  
4. Notification 收斂  
5. 最後才考慮 Event Store / 全面投影

---

## 9. OPEN Decisions（定案前不可寫死實作）

| ID | 問題 | 建議預設 |
|----|------|----------|
| O-01 | 首罐判定：歷史曾持有 vs 目前持有 | 歷史曾 `NewJarAssigned` |
| O-02 | NoShow 是否自動退換罐款 | 人工／規則退款，需 SLA |
| O-03 | WaitingForJar 保留天數 | 7 天（暫定） |
| O-04 | 客人可否自助取消／改期 | Phase 1 僅店家操作 |
| O-05 | 店評客是否跨店可見 | 跨店可見（防呆） |
| O-06 | 技師班表：固定時段 vs 完整排班 | 先固定時段 |
| O-07 | 忘帶罐付 30 後，舊罐 Asset 如何處理 | 保持在 Customer；不自動作廢 |
| O-08 | 換罐 Product SKU 是否一店一品 | 沿用現有換罐產品目錄 |

---

## 10. 定義完成的檢查清單（Definition of Ready for Implementation）

本 Spec 被視為「可開工」當且僅當：

- [ ] §5 Jar Exchange Rules 經產品簽署（含價格與忘帶罐）
- [ ] §9 OPEN 項全部勾選或明確延期
- [ ] Customer / Merchant Journey 無未標記的歧義步驟
- [ ] Notification 場景表確認（至少上線必備子集）
- [ ] 與 `PLAN-pos-booking-system.md` 的 Phase 對齊文字已更新
- [ ] **明確禁止**在未定案前重畫全庫或上 Event Sourcing

---

## 11. 文件治理

| 項目 | 規則 |
|------|------|
| 文件名稱 | **Furmosa OS Domain Specification**（不用 HQ / POS Booking 當憲法名） |
| 版本 | 語意化：v1、v1.1（規則微調）、v2（邊界重劃） |
| 變更 | 任何 JE-* 規則變更必須升版並記錄 diff |
| 與程式 | 程式註解可引用規則 ID（如 `JE-04`）；程式不得成為規則來源 |

---

## Appendix A — 一句話給所有 Agent / 工程師

> Design this system as a long-term Pet Commerce Platform instead of a snack management system. Every feature (Booking, Refill, Inventory, Payment, Reward, Membership) must be implemented as independent bounded modules sharing the same core entities: Customer, Pet, Merchant, Product, Asset, Payment and Event. Avoid feature-specific schemas whenever a generic model can represent the same business logic.  
> **However: freeze this Domain Spec before any schema redesign. Ship Grooming Booking + Jar Refill against these rules first — do not rewrite the world.**

## Appendix B — 與「DB v2 / Event Sourcing」建議的關係

| 做法 | 本階段 |
|------|--------|
| 重畫整庫 Prisma | ❌ 不做 |
| 全面 Event Sourcing | ❌ 不做 |
| 定義 Event 目錄與狀態機 | ✅ 做（本文件 §6–§7） |
| Notification 當 Domain | ✅ 做（本文件） |
| 先跑通預約＋換罐 | ✅ 下一產品里程碑 |

---

**End of Furmosa OS Domain Specification v1.0-draft**
