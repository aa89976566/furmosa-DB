# Furmosa Document Bibles

**現在：** Booking MVP **規劃**（`BOOKING-MVP-PLAN.md`）。未 frozen 前不寫 Booking 程式。

## Stages

| Stage | 內容 | 狀態 |
|-------|------|------|
| **1** | Vision · Domain · Database · Merchant Flow · Experience；Phase 1+2 | ✅ |
| **2** | Reality Gate（機制）· Merchant 可測叫貨 | ✅ 機制完成 |
| **3** | **Booking MVP Plan → frozen → 實作** | ⭐ 現在（先 Plan） |
| **4** | Customer Reality → Jar Exchange | ⏳ |
| **5** | 完整流程 Reality | ⏳ |

## Booking MVP 三決策（建議已採納）

1. **共用班表**（不做美容師個別班）  
2. **店家確認後才成立**  
3. **店家／HQ 可手動超約；顧客看不到已滿時段**

詳見：`docs/BOOKING-MVP-PLAN.md`

## 循環

```text
Experience / Domain（已有）
  → Booking MVP Plan（本輪）
  → frozen
  → 實作 B1–B5
  → Customer Reality
  → 回寫 Decision
  → Jar Exchange Epic
```

**禁止：** 再開 UI／Reality Bible；禁止 Booking 與 Jar 一次做完。
