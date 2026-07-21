# Furmosa OS Domain Specification v1

> **地位：** 整份 Furmosa 未來五年的憲法（Single Source of Truth）  
> **版本：** v1.1-draft  
> **制定日期：** 2026-07-21  
> **修訂：** 2026-07-21 — 凍結換罐四點衝突修正（庫存保留時機、99 資格、店家只驗舊罐、顧客 LINE 登新罐才加點）  
> **範圍：** 定義業務規則與領域邊界；**不含** Prisma schema、migration、實作程式碼  
> **下一里程碑：** Phase 1 = MerchantUser 最小帳號（見 `docs/PHASE-1-MERCHANT-USER-DRAFT.md`）；預約／換罐實作須本 Spec 簽署後才開工

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

### 0.4 CURRENT / PHASE TARGET / FUTURE OPTION

| 標記 | 意義 |
|------|------|
| **CURRENT** | 今日程式／資料庫已存在的行為 |
| **PHASE TARGET** | 美容預約＋換罐 MVP 必須遵守；可用現有 status／ledger 實作，不必 Event Store |
| **FUTURE OPTION** | 五年方向可保留（完整 Asset Ownership、Event Sourcing、多通道 Notification 平台）；**不是**本 MVP 必要條件 |
| **OPEN** | 仍需產品決策才能凍結 |

> **原則：** Domain Event 名稱僅作 audit／integration 語意與文件對齊；production operational model 仍是 status 欄位 + ledger。
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
| **Refill** | RefillOrder, 舊序號回收紀錄, 待登新罐資格 | Customer, JarCode／Serial, Branch, Inventory Reservation, Payment | `RefillRequested`, `ReturnedJarVerified`, `RefillDelivered`, `NewJarSerialRegisteredByCustomer`, `ForgotJarOptionChosen` |
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

### 3.0 旅程總覽（PHASE TARGET — 已凍結）

```text
Book Grooming（可選換罐：首罐129 / 換罐99 × 數量）
  → Merchant Confirm
  → LINE 發送 ECPay 付款連結（僅換罐預付；美容費除外）
  → ECPay webhook 付款成功 → 才 Reserve 該店庫存
  → Arrival / Check-in
  → 店家只輸入舊罐序號 → 按「確認收到空罐」→ 商品交付（delivered）
  → 顧客 LINE／LIFF 輸入新罐瓶底序號 → 該店 +1 點
  → Next Booking（循環）
```

> **極簡現場：** 店家整個換罐只有「一個序號輸入框 + 一個確認按鈕」。  
> **禁止：** 店家輸入新罐序號、手動 Asset Transfer、手動加點、手動扣庫存、手動標記付款。

### 3.1 Step-by-step

#### Step 1 — Book Grooming（建立預約）

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer |
| **Input** | Merchant／Branch、美容服務、Pet、時段、技師（可選）；換罐：`purchaseMode`=`first`\|`exchange`、商品、數量（**不**在預約時選要歸還哪支序號） |
| **Output** | Appointment = `Requested`；若含換罐 → RefillOrder = `Draft`／未付款 |
| **Database Change（語意）** | 新增 Appointment + 可選 RefillOrder；**只檢查**該店庫存是否 ≥ 可選數量（availability check），**不**建立 Reservation |
| **LINE Notification** | 「預約已送出，等待店家確認」 |
| **Inventory Change** | **無保留**；僅讀取可售量供 UI 顯示／阻擋超量選擇 |
| **Reward Change** | 無 |
| **Payment Change** | 尚未建立付款（等店家確認後才發連結） |

#### Step 2 — Merchant Confirm

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 確認／拒絕／請客人改期；技師最終指派 |
| **Output** | Appointment = `Confirmed` 或 `Rejected`／`Cancelled` |
| **Database Change** | Appointment 狀態轉移；若含換罐且確認 → RefillOrder → `PendingPayment`，建立 ECPay Payment Intent |
| **LINE Notification** | 美容時間已確認；**若有 RefillOrder** 附 ECPay 付款連結 |
| **Inventory Change** | **仍不保留**（未付款不得占庫存） |
| **Reward Change** | 無 |
| **Payment Change** | 建立 `Initiated` Payment（金額依 purchaseMode／數量）；美容費不經 Furmosa |

#### Step 3 — ECPay Webhook Payment Success（換罐預付）

| 欄位 | 內容 |
|------|------|
| **Actor** | Payment Gateway（ECPay webhook）— **唯一真相**；禁止前端跳轉頁自行判定成功 |
| **Input** | Webhook 驗簽成功 payload |
| **Output** | Payment = `Completed`；RefillOrder = `Paid`／待交付；店家後台顯示「已付款／待交付」 |
| **Database Change** | Payment 完成；**此時才**建立 Inventory Reservation（同 Appointment 的 Merchant／Branch） |
| **LINE Notification** | 「已替你保留本次預約店家的換罐商品」；exchange 另附帶罐提醒語意 |
| **Inventory Change** | `StockReserved`（該店、該品、該數量）；若付款瞬間庫存不足 → **不得超賣**；Payment 進需處理狀態；**僅 HQ** 決定補貨／改品／退款；店家不可自行處理金流 |
| **Reward Change** | **不加點** |
| **Payment Change** | `Initiated` → `Completed`（失敗 → `Failed`，可重發連結） |

#### Step 4 — Arrival（到店／Check-in）

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser（為主） |
| **Input** | Appointment 識別 |
| **Output** | Appointment = `CheckedIn` |
| **Database Change** | Check-in 時間 |
| **LINE Notification** | 可選 |
| **Inventory / Reward / Payment** | 無必然變更 |

#### Step 5 — 店家驗舊罐並確認交付（唯一主要動作）

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 舊罐序號 × `requiredReturnQty`（僅 `purchaseMode=exchange`）；或忘帶罐選 A／B（§5.4） |
| **Output** | 驗證全過後點「確認收到空罐」→ RefillOrder = `delivered`；建立「顧客可登錄新罐」資格 |
| **Database Change（同一 DB transaction）** | ① 舊序號標記已回收／不可再換 ② 關聯 RefillOrder、Merchant、回收時間 ③ RefillOrder=`delivered` ④ reserved → 正式扣除 ⑤ 寫入換罐類型 `MerchantStockTxn`（非寄賣 sale） ⑥ 建立待登錄新罐資格 ⑦ 觸發 LINE |
| **LINE Notification** | 「換罐已完成，請輸入新罐瓶底序號累點」 |
| **Inventory Change** | Reservation → Consumed／delivery txn |
| **Reward Change** | **仍不加點** |
| **Payment Change** | 無（已付）；店家不可標記付款 |
| **禁止店家做的事** | 輸入新罐序號、選 Asset Owner、手動加點、手動改庫存、手動覆寫驗證、收現金換罐款 |

#### Step 6 — 顧客 LINE 輸入新罐序號並加點

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer（LINE／LIFF） |
| **Input** | 新罐瓶底序號 |
| **驗證** | 序號存在且格式正確；尚未綁定其他 Customer；尚未發過點數；Customer 有一筆尚未登錄新罐的 `delivered` RefillOrder；點數歸屬該 RefillOrder 的 Merchant |
| **Output** | 新序號綁定 Customer（成為未來可換的有效序號）；`MemberPointsLedger` +1（綁定該 Merchant）；標記序號已發點 |
| **LINE Notification** | 回覆**該店**目前累積點數；同店滿 10 點 → 產生該 Merchant 的 NT$200 美容折抵（跨店不可合併） |
| **Inventory / Payment** | 無 |
| **Reward Change** | **唯有此步**產生 +1；付款成功／預約確認／舊罐驗證／店家交付按鈕皆**不**加點 |

#### Step 7 — Next Booking

| 欄位 | 內容 |
|------|------|
| **Actor** | Customer / 排程提醒 |
| **Input** | 回訪建議、該店點數 |
| **LINE Notification** | 依 §7.9；帶空罐提醒只看「本次 exchange + paid + 尚未 delivered」 |

### 3.2 變體路徑（必須同樣凍結）

| 變體 | 規則 |
|------|------|
| 只預約美容、不換罐 | 無 RefillOrder、無換罐 Payment、無 Reservation |
| `purchaseMode=first`（129） | 店家**不**驗舊罐；已付款＋確認交付即可 delivered；顧客仍須 LINE 登新罐才 +1 |
| 預約時選換罐但未付款 | 不可交付換罐；美容可進行；**僅線上預付** |
| 店家拒絕預約 | 無 Reservation 可釋放；若已付款（不應發生於確認前）→ 退款流程 |
| 付款成功但庫存不足 | 不超賣；Payment 需 HQ 處理；店家不碰金流 |
| No-show | Appointment=`NoShow`；若已 Reserved → Release 策略見 §6；退款 — **OPEN** |
| 爽約／改期 | Phase 1 僅店家操作；一律通知 |
---

## 4. Merchant Journey

```text
Merchant Login
  → Manage Schedule（後續 Phase）
  → Confirm Appointment
  → （顧客已 ECPay 付款 → 庫存已保留 → 後台「已付款／待交付」）
  → 輸入舊罐序號 →「確認收到空罐」→ 商品交付
  → （顧客自行 LINE 登新罐累點 — 店家不參與）
  → Settlement（HQ）
```

### 4.1 Step-by-step

#### M1 — Merchant Login

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 帳密（綁定 Merchant；UI 一店一號） |
| **Output** | POS Session；查詢一律以 session `merchantId` 為準，**不信任** client 傳入的 merchantId |
| **規則** | 看不到 HQ、看不到他店；CURRENT 尚無 MerchantUser（PHASE TARGET：Phase 1） |

#### M2 — Manage Schedule

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 技師、可預約時段、公休、服務時長 |
| **Output** | 可被 Booking 前台查詢的 Slot |
| **Notification** | 班表異動影響已確認預約 → 必須通知 |
| **Phase** | 非 Phase 1；Phase 1 僅 placeholder |

#### M3 — Confirm Appointment

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 待確認清單 |
| **Output** | Confirmed / 請改期 / Rejected |
| **副作用** | 確認且含換罐 → 系統發 ECPay 連結（店家不碰金流） |
| **規則** | 技師臨時無法出席時店家必須主動處理 |

#### M4 — 換罐交付（極簡 POS）

螢幕顯示（日常語言，無 domain 名詞）：

- 顧客姓名、寵物姓名、預約時間  
- 換罐商品與數量、**已付款**  
- 需要歸還幾個空罐（`requiredReturnQty`）

操作（每個畫面只有一個主要動作）：

1. **一個**「輸入空罐序號」欄位  
2. **一個**「確認收到空罐」按鈕  
3. 忘帶空罐：僅「補 NT$30」或「保留下次領取」

系統驗證（店家不可覆寫）：

- 序號存在；屬於本次 Appointment 的 Customer  
- 目前有效且尚未回收；未被另一筆交換占用  
- 已輸入數量 = `requiredReturnQty`  
- 訂單已由 ECPay webhook 確認付款  
- 本單庫存已在相同 Merchant／Branch 預留  

「確認收到空罐」= 完成本次商品交付的**唯一主要動作**（transaction 見 §12）。

**店家不需要：** 掃描進階流程、選 Owner、輸入新罐序號、理解 Asset Transfer、手動點數／庫存／付款。

#### M5 — Complete Grooming Service

| 欄位 | 內容 |
|------|------|
| **Actor** | MerchantUser |
| **Input** | 美容完成 |
| **Output** | Appointment Completed（可與換罐 delivered 分離時間點） |
| **金流** | 美容費由店家向客人收取；**不經** Furmosa |

#### M6 — Settlement

| 欄位 | 內容 |
|------|------|
| **Actor** | HQ Staff + System；MerchantUser 唯讀 |
| **規則** | 換罐交付 **不得**當一般寄賣銷售、**不得**套一般寄賣分潤；MerchantStockTxn 必須可辨識 `refill_*` 來源（§5.8） |

---

## 5. Jar Exchange Rules（最重要 — PHASE TARGET 已凍結）

> 本節為**業務憲法**。實作不得違反。若要改價格或流程，必須升版本 Spec。

### 5.1 價格與交換不變量

| 規則 ID | 規則 |
|---------|------|
| JE-01 | **首罐** = NT$129（`purchaseMode=first`） |
| JE-02 | **換罐** = NT$99（`purchaseMode=exchange`） |
| JE-03 | **一罐換一罐**；數量 N 需 N 個有效舊序號（預約時不預選序號，到店再輸入） |
| JE-04 | 客人**線上預付**換罐費（ECPay webhook 為準）；**Merchant 永不代收**換罐款、不可自行標記付款成功 |
| JE-05 | **美容費**由客人直接付給 Merchant；Furmosa 本階段不經手 |
| JE-06 | Merchant 換罐現場**只做**：輸入舊序號 +「確認收到空罐」（或忘帶罐 A／B）。**不**輸入新罐序號 |
| JE-07 | 客人只能領取 **Appointment 所屬 Merchant／Branch** 庫存；禁止跨店領貨或付款後自行換店 |
| JE-08 | 每一瓶底序號唯一；每個新序號最多加點一次 |
| JE-09 | 歸還序號必須：存在、屬該 Customer、仍有效未回收、未被其他交換占用 |
| JE-10 | **禁止**人工覆寫驗證／付款／點數／庫存 |
| JE-11 | **庫存保留時機**：僅 ECPay webhook 付款成功後；預約送出與店家確認時**不** Reserve |
| JE-12 | **99 資格**：Customer **目前**至少擁有一個「已發出、尚未回收、未作為其他已完成／進行中交換、仍有效」的瓶底序號；否則只能選 129。資格由序號狀態推算，**禁止** Customer 上手動維護計數、**禁止**只看歷史是否曾購買 |
| JE-13 | **加點時機**：僅顧客 LINE 成功登錄新罐瓶底序號之後；付款／確認／驗舊／交付皆不加點 |
| JE-14 | 點數**按 Merchant 分開累積**；同店滿 10 點 → 該店 NT$200 美容折抵；跨店不可合併；與一般寄賣分潤完全分開 |

### 5.2 CURRENT / PHASE TARGET / FUTURE OPTION 對照

| 項目 | CURRENT | PHASE TARGET | FUTURE OPTION |
|------|---------|--------------|---------------|
| 價格 129／99 | 未實作 | 必須 | — |
| 忘帶罐 30 | 未實作 | ECPay 連結補差 | — |
| 序號 | `JarCode`；客人 LINE 兑碼入點 | 店家驗舊交付；客人 LINE 登新罐入點 | 完整 Asset Owner 圖 |
| 點數 | ledger append-only；來源偏兑碼 | ledger + 綁 Merchant；delivered 後登新罐才 +1 | — |
| 庫存保留 | 無 | webhook 成功後 Reserve | — |
| ECPay | 無 | 必備；webhook 為準 | — |
| 美容預約 | 無（僅兑券） | Booking + Refill | — |
| Asset／Event Store | 無 | **不需要**完整 Ownership／ES | 可演進 |

### 5.3 舊序號驗證（店家輸入時）

```text
verifyReturnedSerial(customerId, serial, refillOrderId):
  1. 序號存在且格式正確（瓶底 8 碼等）
  2. 序號屬於本次 Appointment／RefillOrder 的 Customer
  3. 序號目前有效、尚未回收
  4. 序號未被另一筆進行中／已完成交換占用
  5. ECPay 已確認本單付款；同店 Reservation 存在
  6. 累計已驗證數 ≤ requiredReturnQty
  失敗 → 顯示日常語言錯誤（§13）；不可強制通過
```

### 5.4 客人忘帶罐（僅兩動作）

| 選項 | 行為 | 結果 |
|------|------|------|
| **A. 補 NT$30** | 建立 ECPay NT$30 連結 → LINE 給 Customer；店家不收現金、不可自標已付 | webhook 成功後本單視為實付 NT$129 路徑；**原有效舊序號保持有效**；店家可交付；顧客仍可之後登新罐累點 |
| **B. 保留下次領取** | RefillOrder → `waiting_for_jar` | 庫存維持 reserved；美容 Appointment 可完成；下次帶罐再輸入序號交付；**禁止通融跳過** |

**保留期限：** 產品設定值（建議預設 **14 天**），**禁止**硬編碼在 domain 邏輯常數中；逾時策略由設定＋HQ 流程處理。

**禁止第三條路：** 口頭答應、手動改庫存、手動加點、略過序號。

### 5.5 首罐 vs 換罐資格（已定案）

```text
eligibleForExchange99(customerId):
  EXISTS serial WHERE
    issued_to = customerId
    AND not_returned
    AND not_consumed_by_another_exchange
    AND still_valid
→ UI 才顯示「換罐 NT$99」
ELSE → 只能「首罐 NT$129」
```

- 預約時顧客只選：首罐 129／換罐 99／數量 — **不**選要還哪支序號。  
- **作廢規則：** 「曾經拿過罐以後一律 99」→ **錯誤，已刪除**。

### 5.6 庫存與跨店

- Availability check：預約／選品時可讀庫存，不占量。  
- Reservation：僅 webhook 付款成功後，綁定 **同一 Merchant／Branch + Product + qty + refillOrderId**。  
- Consume：僅「確認收到空罐／first 模式確認交付」時。  
- 禁止跨店領貨。

### 5.7 Merchant 與金流邊界

```text
Customer ──ECPay webhook──▶ Furmosa   （換罐 129/99/30）
Customer ──現金/店內──▶ Merchant （美容費）
Furmosa ──Settlement──▶ Merchant （寄賣分潤／補貼等；換罐交付≠寄賣銷售）
```

### 5.8 庫存與寄賣分離（MerchantStockTxn 來源）

一般寄賣維持 CURRENT：`Order`／`Shipment`／`MerchantStock`／`MerchantStockTxn`／`Settlement`／分潤／月結。

換罐可共用 `MerchantStock`，但 txn **必須可辨識**（PHASE TARGET 擴充 type 或等效欄位）：

- `consignment_sale`  
- `refill_reservation`  
- `refill_delivery`  
- `refill_release`  
- `restock`  
- `adjustment`  

換罐交付不得當一般寄賣銷售，不得自動套用一般寄賣分潤。

---

## 6. State Machines

> 狀態是 production operational model；事件名稱僅文件／audit 語意。  
> **不**實作 Event Store（FUTURE OPTION）。

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
| — | Requested | 建立預約 | Customer | 可建 RefillOrder Draft；**不** Reserve |
| Requested | Confirmed | 店家確認 | MerchantUser | 若有換罐 → PendingPayment + ECPay 連結 |
| Requested | Rejected | 店家拒絕 | MerchantUser | 通知；無 Reservation |
| Requested/Confirmed | Cancelled | 取消 | Customer/MerchantUser/System | 若已 Reserved → Release；退款策略 |
| Confirmed | CheckedIn | 報到 | MerchantUser | — |
| CheckedIn | Completed | 服務完成 | MerchantUser | — |
| Confirmed | NoShow | 逾時未到 | System/MerchantUser | Release 若已付已留 |
| Confirmed | RescheduleRequested | 改期請求 | 任一方 | 通知 |

### 6.2 RefillOrder

```text
[*] → Draft → PendingPayment → Paid → Delivered → NewSerialRegistered
                              ↘ PaymentFailed → PendingPayment（重試）
         Paid → waiting_for_jar（忘帶罐選 B）
         waiting_for_jar → Paid／交付流程（帶回罐後）
         Paid → PaymentNeedsHQ（付款成功但庫存不足）
         * → Cancelled（未交付前）
```

| From | To | Trigger | 副作用 |
|------|-----|---------|--------|
| Draft | PendingPayment | 店家確認預約 | 建立 Payment Intent |
| PendingPayment | Paid | **ECPay webhook** 成功 | **Reserve** 庫存；後台「已付款／待交付」 |
| PendingPayment | PaymentFailed | webhook／逾時失敗 | 可重發連結 |
| Paid | PaymentNeedsHQ | 付款成功但庫存不足 | 不超賣；HQ 處理 |
| Paid | Delivered | 店家「確認收到空罐」（或 first 模式確認交付） | 回收舊序號；Consume 庫存；建立待登新罐資格；LINE 引導；**不加點** |
| Paid | waiting_for_jar | 忘帶罐選 B | Reservation 維持；美容可完成 |
| waiting_for_jar | Delivered | 下次帶罐驗序後確認 | 同 Delivered |
| Delivered | NewSerialRegistered | 顧客 LINE 登新罐成功 | +1 點綁 Merchant；序號可再換 |

### 6.3 Payment

```text
[*] → Initiated → Completed
                ↘ Failed → Initiated（重試）
       Completed → NeedsHQReview（庫存不足等）
       Completed → Refunded
```

| 用途 | amount |
|------|--------|
| `refill_first` | 129 × qty |
| `refill_exchange` | 99 × qty |
| `forgot_jar_fee` | 30（補差後本單視為 129 路徑語意） |

**真相來源：** 僅 ECPay webhook。前端 return URL 不得單獨把狀態改為 Completed。

### 6.4 Inventory Reservation

```text
[*] → Reserved → Consumed
               ↘ Released
```

| From | To | Trigger |
|------|-----|---------|
| — | Reserved | **ECPay webhook PaymentCompleted** 且庫存足夠 |
| Reserved | Consumed | 店家確認交付（`refill_delivery`） |
| Reserved | Released | 取消／NoShow／waiting 逾時／HQ 退款釋放（`refill_release`） |

**產品設定：** `waiting_for_jar` 保留天數建議預設 14，設定化、不硬編碼。

### 6.5 Reward

| 時機 | pointsChange | 備註 |
|------|--------------|------|
| 顧客成功登錄新罐序號 | +1 | 綁 RefillOrder.merchantId；每序號最多一次 |
| 兑美容折抵等 | −N | 同店累點規則 |
| HQ 人工調整 | ±N | 稽核；店家不可 |

同 Merchant 累積滿 10 → 發該店 NT$200 美容折抵；跨店不可合併。

Coupon：`Issued → Redeemed | Expired | Cancelled`

### 6.6 Notification（沿用 lib/line/*，不重建平台）

投遞仍走現有 LINE＋throttle。事件名稱可作 audit；**PHASE TARGET 不建**獨立 NotificationIntent 表（FUTURE OPTION）。

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

### 7.3 Refill / Serial（PHASE TARGET 用語；非完整 Asset ES）

- `RefillRequested`
- `RefillCancelled`
- `ReturnedJarVerified`
- `ReturnedJarRejected`
- `ForgotJarFeeLinkGenerated`
- `ForgotJarKeepReserved`
- `RefillDelivered`（店家確認收到空罐／首罐交付）
- `NewJarSerialRegisteredByCustomer`（顧客 LINE 登新罐）
- `RefillCompleted`（可與上者同時或作為彙總語意）

### 7.3b FUTURE OPTION（本 MVP 不實作）

- `AssetIssued` / `AssetTransferred` / `AssetRetired` — 完整 Ownership 圖
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

### 7.9 LINE 提醒規則（PHASE TARGET — 沿用 lib/line/* + throttle）

| 時機 | 內容 | 條件 |
|------|------|------|
| 預約送出 | 等待店家確認 | 一律 |
| 店家確認後 | 美容時間已確認；若有 RefillOrder 附 ECPay 連結 | 一律／有換罐 |
| 付款成功（webhook） | 已替你保留本次預約店家的換罐商品 | PaymentCompleted |
| 預約前一天 | 日期／時間／店家；exchange 提醒帶空罐 | 見下 |
| 預約前兩小時 | 再提醒美容；exchange 再提醒空罐 | 見下 |
| 店家確認交付後 | 引導輸入新罐瓶底序號累點 | RefillDelivered |

**「帶空罐」提醒條件（只看本次訂單）：**

- `RefillOrder.purchaseMode = exchange`
- `Payment = paid`（Completed）
- RefillOrder **尚未** `delivered`

**禁止**用「顧客以前買過罐」當提醒條件。

| templateKey（文件名） | 觸發 |
|----------------------|------|
| `booking.requested` | AppointmentCreated |
| `booking.confirmed` | AppointmentConfirmed（+ 付款連結若有） |
| `payment.completed` | PaymentCompleted（+ 已保留庫存） |
| `booking.reminder_1d` | T−1d |
| `booking.reminder_2h` | T−2h |
| `booking.bring_jar` | 併入上述提醒，條件見上 |
| `refill.delivered` | RefillDelivered → 請登新罐 |
| `reward.earned` | NewJarSerialRegisteredByCustomer |

**架構：** PHASE TARGET 繼續直接用現有 LINE helper＋throttle；完整 Notification Domain／多 Adapter = FUTURE OPTION。

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

1. **Phase 1：** MerchantUser + 分離 session + POS shell／placeholder（見 `PHASE-1-MERCHANT-USER-DRAFT.md`）  
2. **Phase 2+：** Appointment → Payment/ECPay webhook → RefillOrder → Reservation-on-paid → POS 驗舊交付 → LINE 登新罐加點  
3. MerchantStockTxn 來源擴充（refill_*）  
4. 完整 Asset Ownership／Event Store = **FUTURE OPTION**，非 MVP 門檻

---

## 9. Final Decisions（已凍結）與剩餘 OPEN

### 9.1 Final Decisions

| ID | 決策 |
|----|------|
| FD-01 | 庫存：**ECPay webhook 成功後**才 Reserve；預約／確認時不占庫 |
| FD-02 | 99 資格：目前有效未回收序號 ≥1；禁止「曾經拿過一律 99」 |
| FD-03 | 店家只驗舊罐＋確認收到；**不**輸入新罐 |
| FD-04 | 加點：僅顧客 LINE 登新罐成功後；每序號一次；點數綁 Merchant |
| FD-05 | 同店 10 點 → 該店 NT$200 折抵；跨店不可合併 |
| FD-06 | 付款真相：僅 webhook；前端不可自行 Completed |
| FD-07 | 付款成功庫存不足：不超賣；HQ 處理；店家不碰金流 |
| FD-08 | 忘帶罐僅 A=補 30／B=waiting_for_jar；保留天數**設定化**（建議預設 14） |
| FD-09 | 換罐 txn ≠ 寄賣 sale；不套一般分潤 |
| FD-10 | 完整 Asset ES／Notification 平台 = FUTURE OPTION |
| FD-11 | Phase 1 只做 MerchantUser＋POS shell，不做預約／換罐／叫貨實作 |

### 9.2 仍 OPEN（不阻擋 Phase 1）

| ID | 問題 | 建議 |
|----|------|------|
| O-02 | NoShow 是否自動退換罐款 | 人工／規則退款，需 SLA |
| O-04 | 客人可否自助取消／改期 | 預約 Phase 先僅店家 |
| O-05 | 店評客是否跨店可見 | 跨店可見 |
| O-06 | 技師班表精細度 | 先固定時段 |
| O-08 | 換罐 SKU 一店一品否 | 沿用現有目錄 |
| O-09 | waiting_for_jar 逾時後自動 Release 還是 HQ 工單 | 建議設定到期提醒＋HQ |
| O-10 | first（129）店家 POS 按鈕文案（無舊罐時） | 「確認交付商品」 |

---

## 10. Invariants（永不違反）

1. Merchant 永不代收換罐款、不自標付款成功。  
2. 未 webhook 成功不得 Reserve；不得超賣。  
3. 跨店不得領貨／合併點數。  
4. 店家不可覆寫序號驗證、不可手動加點、不可改價。  
5. 點數只在「顧客成功登新罐」產生；每序號最多一次。  
6. 換罐交付流水不可進入一般寄賣分潤。  
7. 查詢範圍以 server session `merchantId` 為準。  
8. Domain Event 名稱≠必須實作 Event Store。

---

## 11. Transaction Boundaries（PHASE TARGET）

### 11.1 「確認收到空罐」單一 transaction

必須原子完成：

1. 舊序號 → 已回收／不可再換  
2. 關聯 RefillOrder、Merchant、回收時間  
3. RefillOrder → `delivered`  
4. reserved 庫存正式扣除  
5. 寫入 `refill_delivery` MerchantStockTxn  
6. 建立顧客可登錄新罐資格  
7. 發出 LINE「請輸入新罐瓶底序號」（可 outbox／同事務標記待送）

任一步失敗 → 整筆 rollback；UI 顯示下一步指引，不顯示技術堆疊。

### 11.2 ECPay webhook transaction

1. 驗簽  
2. Payment → Completed（冪等）  
3. 嘗試 Reserve；成功 → Paid＋已保留；失敗 → NeedsHQReview，**不**假成功扣庫  

### 11.3 顧客登新罐 transaction

1. 驗證序號與 delivered 資格  
2. 綁定 Customer  
3. 標記已發點  
4. MemberPointsLedger +1（merchant-scoped）  
5. 若達 10 點觸發該店折抵券規則  

---

## 12. Failure Cases（日常語言）

| 情況 | 使用者可見訊息（範例） | 系統行為 |
|------|------------------------|----------|
| 序號不存在 | 「找不到這個序號，請再確認瓶底 8 碼。」 | 拒絕 |
| 序號非本客 | 「這個罐子不屬於本次顧客。」 | 拒絕 |
| 已換過／已回收 | 「這個序號已經換過。」 | 拒絕 |
| 未付款 | 「這筆訂單還沒付款，暫時無法交付。」 | 拒絕 |
| 數量不足 | 「需要 2 個空罐，目前只確認 1 個。」 | 拒絕交付 |
| 庫存未保留 | 「系統尚未保留商品，請稍候或聯繫總公司。」 | 拒絕 |
| 付款成功無庫存 | HQ 工作佇列；客人通知另定 | NeedsHQReview |
| 新罐已綁人／已發點 | 「這個序號無法累點，請確認是否輸入正確。」 | 拒絕加點 |
| 無 delivered 資格 | 「目前沒有可累點的換罐紀錄。」 | 拒絕 |

**禁止顯示：** foreign key、invalid state transition、asset owner mismatch、transaction failed。

---

## 13. UI／UX Operational Rules（店家）

1. 每畫面一個主要動作。  
2. 不顯示 Asset Transfer／Event／Reservation 等 domain 名詞。  
3. 用語：已付款、等待空罐、輸入瓶底序號、確認收到、保留下次領。  
4. 店家不可見 Furmosa 金流細節。  
5. 不可編輯商品價格。  
6. 不可手動加點。  
7. 不可覆寫付款或序號驗證。  
8. 觸控按鈕高度 ≥ 44px。  
9. 手機／平板優先。  
10. 成功後自動回今日預約列表。  
11. 錯誤直接告訴下一步。

---

## 14. 定義完成的檢查清單（DoR）

- [x] §5 四點衝突已修正並凍結（FD-01～FD-04）  
- [ ] 產品簽署本 v1.1 Final Decisions  
- [ ] Phase 1 MerchantUser 草案確認（`PHASE-1-MERCHANT-USER-DRAFT.md`）  
- [ ] 與 `PLAN-pos-booking-system.md` Phase 對齊  
- [x] 禁止未定案重畫全庫／Event Sourcing  

---

## 15. 文件治理

| 項目 | 規則 |
|------|------|
| 文件名稱 | **Furmosa OS Domain Specification** |
| 版本 | v1.1 = 換罐規則衝突修正；JE-* 再變更須升版 |
| 與程式 | 可引用 JE-xx／FD-xx；程式不得成為規則來源 |

---

## Appendix A — 一句話

> Pet Commerce Platform，模組共用 Customer／Pet／Merchant／Product／Payment／Serial／Event 語意。  
> **先凍結規則、先跑通預約＋換罐極簡現場（一框一鍵），再增量 schema。不做全世界重寫，不做 Event Sourcing MVP。**

## Appendix B — 與 DB v2／ES 的關係

| 做法 | 本階段 |
|------|--------|
| 重畫整庫 Prisma | ❌ |
| 全面 Event Sourcing | ❌ FUTURE OPTION |
| 事件目錄＋狀態機文件 | ✅ |
| 完整 Notification 平台 | ❌ FUTURE OPTION；先用 lib/line/* |
| 極簡換罐現場 | ✅ 一序號框＋確認收到 |

---

**End of Furmosa OS Domain Specification v1.1-draft**
