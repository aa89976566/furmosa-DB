# Entity Search Insight v1 — 搜尋即決策

> **地位：** HQ 營運搜尋體驗規格（非 Bible）  
> **版本：** v1.1  
> **日期：** 2026-07-25  
> **對齊：** Experience「HQ 打開就知道今天寄什麼／審叫貨快」；`docs/JAR-EXCHANGE-SYSTEM-v1.md`；現況 `DashboardSearch` + 店家／客戶詳情頁

---

## 1. 頂級系統怎麼做（模式）

| 系統 | 模式 | 對 Furmosa 的啟發 |
|------|------|-------------------|
| **Shopify Admin** | 全域搜尋 → 分類型結果；點進實體後是 **Profile + 側欄洞察**（訂單、RFM、備註） | 搜尋結果先給「一眼摘要」，再進詳情 |
| **Stripe Dashboard** | Customer／Payment 搜尋 → 列表列上就有狀態／金額／最近活動 | 結果列 = 識別 + 2～3 個決策 KPI |
| **Linear / Notion** | Command palette：實體 + **次要動作**（跳轉子頁） | 店家結果直接連「庫存／叫貨歷史」 |
| **Salesforce / HubSpot** | 360° 客戶卡：訂單、偏好、風險同屏 | 客人結果顯示常買 SKU，不是只顯示電話 |

共通原則：

1. **搜尋找實體，不是找報表。**  
2. **結果列帶決策摘要**（庫存是否夠、最近叫貨、常買什麼）。  
3. **快捷深鏈**到子工作流（庫存、叫貨、訂單），減少點擊。  
4. **詳情頁才是完整 360°**；搜尋面板不塞滿表。

---

## 2. 現況缺口

- `searchDashboard` 只回傳識別欄位（店名／電話／訂單號）。  
- 庫存、叫貨流水、客戶商品偏好都在詳情頁，搜尋列看不到。  
- Topbar `GlobalSearch` 只是 `?q=` 列表篩選，沒有洞察。

---

## 3. v1 範圍（已落地）

### 店家結果摘要
- 在庫件數、缺貨／偏低 SKU 數  
- 最近叫貨日、90 天叫貨次數  
- **換罐**在庫／偏低／缺貨（`JAR_EXCHANGE`）  
- 快捷：`庫存` · `叫貨歷史` · `叫貨` · `換罐營運` · `訂單`

### 客人結果摘要
- 有效訂單數、最近下單日  
- 近 180 天常買 Top 3（數量）  
- **換罐**點數餘額、已兌序號數、最近兌點日  
- 快捷：`總覽` · `訂單` · `換罐會員`

### 不做（v1）
- 全站 Command-K palette  
- 搜尋面板內嵌完整庫存表  
- AI 推薦補貨  
- GlobalSearch 即時洞察（下一階段再對齊 DashboardSearch）  
- Booking／Refill 狀態（屬 Stage 3）

---

## 4. 實作位置

| 層 | 路徑 |
|----|------|
| 洞察查詢 | `lib/search/entity-insights.ts` |
| Server action | `app/(main)/dashboard/actions.ts` → `searchDashboard` |
| UI | `components/dashboard/dashboard-search.tsx` |

---

## 5. 下一階段（可選）

1. Topbar `GlobalSearch` 改用同一套洞察結果面板。  
2. 鍵盤選取結果（↑↓ Enter）。  
3. 客人詳情頁加「常買商品」區塊（與搜尋同一 helper）。  
4. 店家結果加「待審叫貨」紅點（RestockRequest）。  
5. 僅對 `jar_exchange` 類型店家才顯示換罐列（減少噪音）。
