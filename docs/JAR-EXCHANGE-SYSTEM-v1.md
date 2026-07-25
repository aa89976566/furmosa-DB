# 換罐計畫系統 v1 — 現況／目標／本輪範圍

> **地位：** 營運規格（非 Bible）  
> **版本：** v1.0  
> **日期：** 2026-07-25  
> **對齊：** Experience「忠誠回圈」；`docs/BIBLES.md` Stage 2（真實店實測，不開 Booking）

---

## 1. 一句話答案

**要做「換罐計畫」營運系統，但不是一次做完完整目標態。**  
本輪做的是 HQ **營運台 + 搜尋洞察**；**不做** Booking／RefillOrder／ECPay／店家「驗舊罐」完整鏈。

---

## 2. 三層範圍

| 層 | 內容 | 狀態 |
|----|------|------|
| **CURRENT（已在 `main`）** | 序號 → LINE 兌點 → 點數帳本 → 禮品／美容券 → 店家核銷；會員／合作店／管理頁 | ✅ 可用 |
| **NOW（本輪）** | HQ **換罐營運台**（各店 `JAR_EXCHANGE` 庫存矩陣、週 KPI、一鍵補貨）；Dashboard 搜尋加換罐庫存／點數摘要 | ✅ 本 PR |
| **TARGET（Stage 3+）** | Booking + RefillOrder + ECPay + 店家驗舊罐／交新罐完整現場流程 | ⏳ 通過 Stage 2 閘門後再開 |

---

## 3. 商品辨識規則（凍結）

- 換罐 SKU：**`Product.productCategory = 'JAR_EXCHANGE'`**
- **禁止**再用 `name LIKE '換罐%'` 當執行時判斷（回填 migration 僅歷史用途）
- 合作店：`merchant` types 含 `jar_exchange`

---

## 4. 營運台能力（NOW）

路徑：`/jar-exchange/ops`

| 區塊 | 行為 |
|------|------|
| 狀態列 | 本週序號兌換、本週美容券核銷、本月點數發放、未用序號、低／缺庫存格數、在途補貨 |
| 矩陣 | 合作店 × 換罐商品在店量；`out` / `low` / `ok` |
| 一鍵補貨 | 對低於門檻的 SKU 建立 `merchant_restock` 出貨單（目標量預設 6） |

實作：

| 層 | 路徑 |
|----|------|
| 查詢 | `lib/jar-exchange/ops.ts` |
| 補貨 | `lib/jar-exchange/quick-restock.ts` |
| UI | `components/jar-exchange/ops-console.tsx` |
| Action | `app/(main)/jar-exchange/ops/actions.ts` |

門檻常數：`JAR_OPS_LOW_STOCK_THRESHOLD = 3`、`JAR_OPS_TARGET_STOCK = 6`。

---

## 5. 搜尋洞察（與營運台連動）

店家結果另顯示換罐在庫／偏低／缺貨，並深鏈「換罐營運」。  
客人結果顯示點數餘額、已兌序號數、最近兌點日，並深鏈「換罐會員」。

詳見 `docs/ENTITY-SEARCH-INSIGHT-v1.md`。

---

## 6. 明確不做（本輪）

- Appointment／Booking UI 與狀態機  
- RefillOrder、ECPay、LIFF 新付款流  
- POS「今天待換罐」佇列（仍屬 Stage 3）  
- 以品名前綴推斷換罐商品  

---

## 7. 與 Stage 2 的關係

Stage 2 優先驗證 **寄賣店 POS 叫貨**。  
換罐營運台服務的是 **HQ 補貨調度**，不阻塞、也不取代 POS Reality 測試。  
Booking 完整鏈仍須等 Experience §8 閘門通過後再開。
