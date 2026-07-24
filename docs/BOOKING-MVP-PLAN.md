# Furmosa OS — Booking MVP Plan

> **地位：** Booking Epic 規劃（凍結後才實作）  
> **版本：** v1.0-draft  
> **日期：** 2026-07-24  
> **原則：** 延伸現有平台，不平行重建  
> **本文件禁止實作前完成：** 產品簽署三決策 + 本 Plan 標 `v1.0-frozen`  
> **明確不做（MVP）：** 付款、換罐、空罐、點數、CRM、AI、美容師個別班表、顧客端超約

---

## 0. 為什麼現在可以開始（但仍是 Plan，不是 Code）

已完成且**不得重做**：

| 資產 | 用途 |
|------|------|
| Domain Bible | Customer／Merchant／Product／Payment 邊界 |
| Experience Bible | 顧客／店員旅程與 Reality 欄位 |
| Merchant POS Flow | 今天／叫貨／紀錄 |
| Merchant Auth | POS 登入與資料隔離 |
| RestockRequest／MerchantSettings／ProductCategory | 叫貨與設定 |
| MerchantStock／Txn／Settlement | 寄賣與結算（Booking 不碰） |

**目標一句話：** 飼主 60 秒內送出美容預約；店家收到待確認單；LINE 通知結果。  
**Nothing more。**

### 0.1 Roadmap（更新）

```text
Reality Gate 機制 ✅（Merchant 叫貨可測）
        ↓
Booking MVP（本文件）← 現在
        ↓
Reality（Customer 預約行為）
        ↓
Jar Exchange（完整鏈）
        ↓
Reality（完整流程）
```

不再無限 Reality → Reality。Merchant 已有閘門；下一模組是 Booking MVP。

---

## 1. 三個產品決策（MVP 凍結建議＝採用）

| # | 問題 | **MVP 決策** | 理由 |
|---|------|--------------|------|
| **D1** | 美容師個別班表？ | **否。店家共用班表** | UI／衝突邏輯簡單；符合目前合作店規模；約省 40–50% 複雜度 |
| **D2** | 立即成立 vs 店家確認？ | **必須店家確認後才成立（Confirmed）** | 需核對犬種／體型／特殊需求；對齊 Domain 主路徑 |
| **D3** | 超約？ | **顧客端永不看到已滿時段；店家／HQ 可手動新增超約** | 現場彈性保留；前台誠實 |

> 若產品改口，只改本節與狀態機，不要先改 Schema 幻想。

**狀態標籤：** `Hypothesis · Booking MVP decisions` — Reality（Customer）後可調整，但實作前視為 frozen。

---

## 2. Booking Domain（延伸，不平行）

### 2.1 實體（MVP 最小）

| 概念 | 一句話 | 不是什麼 |
|------|--------|----------|
| **Appointment** | 某店、某時段、某服務（可含寵物／備註）的預約契約 | Payment、Refill、點數 |
| **MerchantSchedule** | 該店「可被預約」的共用班表規則 | 美容師個人曆 |
| **Slot（衍生）** | 由班表 − 已佔用 Confirmed／Pending 計算出的可選時段 | 獨立庫存商品 |
| **Service（Product）** | `productCategory = SERVICE` 的美容服務 | JAR_EXCHANGE／零食 |

沿用既有：**Customer、Pet（可選簡化）、Merchant、MerchantUser、Notification（LINE）**。

### 2.2 明確不引入（本 MVP）

- Technician 個別排班  
- ECPay／Payment Intent  
- RefillOrder／空罐／序號  
- Loyalty／點數  
- Inventory Reservation（無換罐則不需要）  
- CRM 標籤／AI 推薦  

### 2.3 與 Domain Spec 的關係

Domain 完整路徑含換罐＋付款；**Booking MVP 只實作「只預約美容」變體**（Domain §3.2 已允許）。  
換罐／付款留在下一 Epic（Jar Exchange），避免平行邏輯。

---

## 3. Booking Journey — Customer（≤ 60 秒目標）

```text
LINE「預約」
  → 選店
  → 選日期
  → 選可預約時段（僅未滿）
  → 選服務
  → 填備註（選填）
  → 送出
  → 「已送出，等待店家確認」
  →（之後）LINE：已確認／請改期
```

| Step | Goal | Emotion | Primary CTA | Failure（人話） |
|------|------|---------|-------------|-----------------|
| 選店 | 鎖定店 | 熟悉 | 選擇此店 | 店名難懂 → 人話＋行政區 |
| 選日期 | 有空的一天 | 清晰 | 點日期 | 滿檔不可點 |
| 選時段 | 鎖定時間 | 確定 | 點時段 | 只顯示可約；已滿不出現 |
| 選服務 | 今天做什麼 | 不慌 | 下一步 | 第一版服務少而清楚 |
| 備註 | 特殊需求 | 被聽見 | 送出預約 | 可空白 |
| 送出 | 進入待確認 | 可放著 | （鎖定） | 「送出失敗，請再試一次」 |

**成功標準：** 首次使用者 ≤ 60 秒走到送出；不需店員代點。

**Reality 假設：** 飼主願意用 LINE 按鈕走完，不靠打字指令。  
**Validation：** 上線後完成率、耗時中位數、放棄步驟熱點。

---

## 4. Merchant Journey — 確認預約

對齊 POS：**今天** 出現「待確認預約」（有數量才顯示）。

```text
登入 → 今天 → 待確認（N）
  → 打開一筆
  →「確認」或「建議其他時間」
  → 回今天／下一位
```

| 動作 | Goal | Emotion | Primary CTA |
|------|------|---------|-------------|
| 看待確認 | 知道誰在等 | 掌控 | 第一筆 |
| 確認 | 預約成立 | 決斷 | **確認** |
| 建議改期 | 時段不合仍留住客 | 幫忙 | **建議其他時間**（選一時段或短文字） |
| （可選）手動新增 | 電話客／超約 | 彈性 | 新增預約 |

**不做：** 開始美容按鈕（仍為 Delete Candidate，等 Reality）。  
**不做：** 收罐／交貨（Jar Epic）。

---

## 5. LINE Journey

| 觸發 | 對象 | 訊息意圖（人話） |
|------|------|------------------|
| 送出成功 | Customer | 已送出，等店家確認 |
| 店家確認 | Customer | 已確認：店／日期／時間／服務 |
| 店家建議改期 | Customer | 店家希望改到…；一鍵同意或再選 |
| 店家拒絕／取消 | Customer | 這次無法服務；可再預約 |
| 新待確認 | Merchant（若已有 LINE 綁定；否則只靠 POS） | MVP 可僅 POS；Merchant LINE 為加分 |

**MVP：** 顧客 LINE 必做；店員通知以 POS「今天」為準，Merchant LINE 可延後。

---

## 6. State Machine

```text
                    ┌──────────────┐
         送出        │   requested  │  待店家確認
      ─────────────▶│  （待確認）   │
                    └──────┬───────┘
           確認            │         建議改期
      ┌────────────────────┼────────────────────┐
      ▼                    │                    ▼
┌───────────┐              │            ┌───────────────┐
│ confirmed │              │            │ reschedule_   │
│ （已確認） │              │            │ proposed      │
└─────┬─────┘              │            └───────┬───────┘
      │                    │     顧客同意新時段   │
      │                    │    ◀───────────────┘
      │  拒絕／取消         │
      │◀───────────────────┘
      ▼
┌───────────┐     到期未到店（後續）    ┌─────────┐
│ cancelled │                      … │ no_show │（非 MVP 必做 UI）
└───────────┘                        └─────────┘
```

| 狀態（內部） | 店員／顧客文案 |
|--------------|----------------|
| `requested` | 公司／店家確認中 → **待店家確認** |
| `confirmed` | **已確認** |
| `reschedule_proposed` | **店家建議改時間** |
| `cancelled` | **已取消** |
| `completed` / `no_show` | MVP 可不強做按鈕；資料預留 |

**佔用 Slot 規則：**

- `requested` + `confirmed` + `reschedule_proposed`（舊時段）→ **對顧客隱藏該時段**（防超約被客人點到）  
- 店家手動新增可寫入已滿時段（D3）  
- `cancelled` 釋放時段  

---

## 7. Failure Cases

| 情境 | 人話 | Recovery |
|------|------|----------|
| 送出時時段剛被佔 | 「這個時間剛約滿，請另選」 | 回到選時段 |
| 重複連點送出 | 不產生第二張 | 按鈕鎖定＋冪等 |
| 店家未登入漏看 | 待確認累積 | 「今天」紅點／數量；可後補 Merchant 通知 |
| 建議改期後顧客不理 | 逾時（如 24h）→ 可取消或保持 proposed | 產品定一預設 |
| 顧客未綁 LINE | 無法收確認訊 | 送出前要求綁定／開戶（沿用既有 LINE 開戶） |
| 店家確認已取消單 | 「這張已取消」 | 不可再確認 |
| 手動超約撞車 | 允許；列表並排顯示 | 店員人腦協調 |

---

## 8. Reality Assumptions（必標）

| ID | Hypothesis | Validation Method | Validated? |
|----|------------|-------------------|------------|
| B-R1 | 飼主可在 60 秒內完成預約 | 上線後計時／漏斗 | No |
| B-R2 | 店家會打開 POS「待確認」並處理 | 待確認→確認延遲分佈 | No |
| B-R3 | 共用班表夠用（不需 Amy／Tony 分曆） | 訪談＋兩週抱怨數 | No |
| B-R4 | 「建議改期」比「拒絕」更能留客 | 改期同意率 | No |
| B-R5 | 顧客端不需看到美容師名字 | 訪談 | No |

全部 `Hypothesis`。Customer Reality 在 Booking MVP 上線後跑，不是再寫一本 Bible。

---

## 9. Prisma Impact（最小、additive）

> 僅規劃；**frozen 前不寫 migration。**

### 9.1 可能新增

| Model／欄位 | 說明 |
|-------------|------|
| `Appointment` | id, merchantId, customerId, petId?, serviceProductId, startsAt, endsAt?, status, customerNote, merchantNote?, proposedStartsAt?, createdBy（customer／merchant／hq）, createdAt, updatedAt |
| `MerchantSchedule` 或簡化設定 | 營業日、每段時長、可約起迄；可先放 `MerchantSettings` JSON／欄位以減少表 |
| 索引 | `(merchantId, startsAt)`, `(merchantId, status)`, `(customerId, createdAt)` |

### 9.2 沿用、不改語意

- `Merchant` / `MerchantUser` / `Customer` / `Product.productCategory`  
- `MerchantSettings`（可加 booking 相關預設，不開設定大頁）  

### 9.3 禁止借殼

- 不把 Appointment 塞進 `Order`  
- 不用 RestockRequest 假裝預約  
- 不為 MVP 建 Event Store  

---

## 10. Minimal UI Flow

### Customer（LINE／LIFF 或簡易 Web）

```text
[選店] → [選日期] → [選時段] → [選服務] → [備註] → [送出]
                              ↓
                    [等待確認] 靜態頁／泡泡
```

一屏一主 CTA；主按鈕 ≥ 44px。

### Merchant（POS）

```text
今天
  └ 待確認預約  N  →
        列表 → 詳情
          [確認]  [建議其他時間]
```

手動新增：詳情旁次要入口「幫客人預約」（可超約選時段）。

### HQ（可延後）

MVP 可不做 HQ 預約台；必要時沿用商家詳情只讀列表。

---

## 11. Implementation Phases（frozen 後才開）

| Phase | 內容 | 完成定義 |
|-------|------|----------|
| **B0** | 本 Plan `v1.0-frozen`；三決策簽署 | 文件標 frozen |
| **B1** | Schema＋Appointment CRUD＋Slot 計算（共用班表） | 單測：滿檔不可約、確認佔位 |
| **B2** | Customer 預約 UI（60 秒路徑） | 預覽可走完送出 |
| **B3** | Merchant POS 待確認／確認／建議改期 | 店員一人可處理 |
| **B4** | LINE 通知（送出／確認／改期） | 真機收到泡泡 |
| **B5** | 手動新增＋超約（店家） | 顧客仍看不到滿档 |
| **B6** | Customer Reality 一輪 → 回寫 Experience Decision | 決定是否進 Jar Epic |

**仍不做：** Phase 3 盤點、Jar、付款、點數。

---

## 12. 成功／失敗閘門（Booking MVP）

| 通過 | 失敗訊號 |
|------|----------|
| 飼主不需教學完成預約 | 店員代客操作才過得了 |
| 店家在 POS 看懂待確認 | 靠 LINE 群傳截圖 |
| 確認後雙方狀態一致 | 顧客「已確認」店員「沒看到」 |
| 無付款／換罐仍覺得有用 | 覺得「沒換罐就不能約」 |

---

## 13. 一句話

> **Booking MVP = 選店選時送出 → 店家確認 → LINE 通知。**  
> 共用班表、必確認、顧客不超約。  
> 付款與換罐留給下一個 Epic。
