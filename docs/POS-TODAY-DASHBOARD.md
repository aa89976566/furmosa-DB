# POS「今天」Dashboard — F-03 對齊

**分支：** `cursor/pos-today-dashboard-24aa`  
**依據：** `docs/MERCHANT-POS-FLOW.md` F-03／F-04／F-10

## 本輪做了什麼

- 固定順序任務列（只顯示有內容）：待確認預約 → 下一位客人 → 缺貨提醒 → 補貨進度
- 空狀態：「今天都處理好了。」＋「需要補貨嗎？」→ 叫貨
- 缺貨：僅當本店有 `MerchantStock` 列（視為庫存可靠）且 `quantity <= reorderPoint`
- **待換罐：不顯示**（無 Refill POS 交付後端，不假裝）

## 明確不做（避免混 PR）

- HQ／主系統 Dashboard 視覺重做
- 待換罐收罐流程、Phase 3 Schema
- 今天的紀錄 timeline 擴充（美容／換罐）

## 主系統（HQ）下一步建議

本 PR **不動** HQ 儀表。建議在 POS「今天」合併並店測後，另開：

1. HQ Dashboard 任務優先：待審 Restock、待出貨、Booking 待處理（對齊營運一天）
2. 或沿用 draft `cursor/linear-mixpanel-polaris-ui-ba1b` 做視覺，但**不要**與 POS 任務流同一 PR
