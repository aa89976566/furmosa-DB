# Furmosa OS — Booking MVP Plan

> **地位：** Booking Epic — **v1.0-frozen（Approved 2026-07-25）**  
> **原則：** 延伸現有平台，不平行重建  
> **明確不做（整段 MVP）：** 美容師個別班表、顧客端超約、付款、換罐、空罐、點數、CRM、AI  
> **Round 1：** Merchant + Availability + Appointment（**不含 LINE**）✅ merged  
> **Round 2（本輪 Code）：** LINE 確認／提醒  
> **Round 3：** Refill／Payment／Jar  

---

## Constitution（必讀）

```text
The booking system does not optimise schedules.
The booking system only exposes available time and records customer intent.
The merchant remains the final authority on accepting appointments.
```

**中文：**

- Booking **不負責**最佳化排程。  
- 只負責：**顯示目前可預約時段**，以及**紀錄 Customer 預約意圖**。  
- **能不能接，永遠由 Merchant 決定。**

```text
Customer never books staff.
Customer books the merchant.
The merchant assigns staff internally.
```

**中文：**

- 顧客永遠不是預約 Amy／Tony，而是預約**店（Merchant）**。  
- 店家內部自己分配人力。  
- 因此 MVP **沒有 Technician／Resource／Chair／Room**。

---

## Frozen Decisions（Approved）

| # | 決策 |
|---|------|
| **D1** | **共用班表** — 系統只答「這店這時間有沒有空」 |
| **D2** | **店家確認後成立** — `requested` → Merchant 確認 → `confirmed` |
| **D3** | **Customer Schedule ≠ Merchant Schedule** — 顧客只見未滿時段；店家／HQ 可手動超約新增 |

### 四個概念實體（MVP）

`Appointment` · `Availability`（由班表規則衍生）· `Merchant` · `Customer`  

沒有 Technician／Resource／Chair／Room。

---

## Implementation Rounds

| Round | 範圍 | 狀態 |
|-------|------|------|
| **1** | Availability 規則、Slot 計算、Appointment CRUD、顧客送出、POS 確認／改期／手動超約 | ✅ |
| **2** | LINE 確認／改期通知／提醒（T−1d／T−2h） | ⭐ Code |
| **3** | Refill／Payment／Jar Exchange | ⏳ |

---

## Round 2 完成定義

通知鏈（不改狀態機）：

```text
顧客送出 → 顧客「已收到申請」→ 店家「有新預約」
→ 店家確認 → 顧客「預約已確認」
→ 預約前一天提醒 → 預約前兩小時提醒
```

實作要點：

- `lib/line/push.ts` Push API；失敗不回滾 Appointment  
- 冪等欄位：`lineNotify*At`／`lineReminder*At`  
- 顧客收件：`Customer.lineUserId`（公開頁可選 LIFF 綁定，或電話已是會員）  
- 店家收件：`MerchantSettings.bookingNotifyLineUserId`  
- 提醒掛在 hourly `/api/cron/maintain-shipments`（Hobby 兩條 cron 上限）  
- **不做** Round 3（付款／換罐／帶空罐提醒條件）

---

## Round 1 完成定義

1. 店家可設定營業時段／每格分鐘／每格容量（共用班表）。  
2. 顧客公開頁可選日期／未滿時段／服務／備註並送出 → `requested`。  
3. POS「今天」顯示待確認；可確認、建議／套用改期、取消。  
4. 店家可手動新增預約（允許超約）；顧客端仍看不到已滿時段。  
5. **無 LINE、無付款、無換罐。**

---

## Domain / Journey / State（摘要）

狀態：`requested` → `confirmed`｜`reschedule_proposed` → `confirmed`｜`cancelled`  

顧客佔位：`requested` + `confirmed` + `reschedule_proposed`（原 startsAt）計入容量。  

詳見下文歷史章節（旅程、失敗、Prisma、UI）。實作以 Round 1 為準。

---

## 0. 為什麼現在做

已完成且**不得重做**：Domain／Experience／POS Flow／Merchant Auth／Restock／Settings／Stock／Settlement。

**目標：** 飼主可送出美容預約意圖；店家在 POS 確認。Round 1 不通知 LINE。

### Roadmap

```text
Merchant Auth ✅ → Restock ✅ → Merchant Flow ✅
  → Booking Round 1 ⭐
  → LINE（Round 2）
  → Refill / Payment / Jar（Round 3）
```

---

## 1–11. 規劃細節（凍結內容）

### Customer（Round 1 UI，無 LINE）

選店（URL）→ 選日期 → 選未滿時段 → 選服務 → 備註 → 送出 →「已送出，等待店家確認」

### Merchant POS

今天 → 待確認 → 確認｜建議改期／套用新時間｜取消；手動新增（可超約）

### Slot 規則

- Availability = MerchantSettings 班表規則 − 佔用中 Appointment  
- `forCustomer=true`：滿檔不列出  
- `forMerchant`／手動新增：可寫入已滿時段  

### Prisma（Round 1）

- `Appointment` 表  
- `MerchantSettings` 增加 booking 班表欄位  
- 不建 Technician  

### Failure（人話）

時段剛滿、重複送出、確認已取消單 — 見實作錯誤字串。
