# POS「今天」Dashboard — F-03 對齊

**分支：** `cursor/pos-today-dashboard-24aa`  
**依據：** `docs/MERCHANT-POS-FLOW.md` F-03／F-04／F-10  
**驗收主店：** **淡水妞妞／妞妞美容**（真實 Merchant，不造假店）

## 驗收登入（對帳用）

| 入口 | 帳號 | 密碼 | 綁定 |
|------|------|------|------|
| `/pos/login` | `niuniu` | `furmosa2026` | DB 名稱含「妞妞」的 active 店（優先「淡水妞妞」） |
| `/pos/login` | `admin` | `furmosa2026` | 僅 Preview 沙盒 `MER-DEMO`（空店，勿拿來對帳） |
| `/login` HQ | `admin@furmosa.com` | `furmosa2026` | 總部 |

部署後 `scripts/ensure-demo-admin.ts` 會在 Vercel Preview／Production **自動建立／重設** `niuniu` 綁妞妞店。  
若 build log 出現 `niuniu.status=skipped` 且找不到 Merchant → 先到 HQ 確認店名是否含「妞妞」。

## 本輪做了什麼

- 固定順序任務列（只顯示有內容）：待確認預約 → 下一位客人 → 缺貨提醒 → 補貨進度
- 空狀態：「今天都處理好了。」＋「需要補貨嗎？」→ 叫貨
- 缺貨：僅當本店有 `MerchantStock` 列且 `quantity <= reorderPoint`
- **待換罐：不顯示**（無 Refill POS 交付後端）

## 明確不做

- HQ／主系統 Dashboard 視覺重做（另 PR）
- 待換罐收罐流程、Phase 3 Schema
- 為對帳捏造預約／庫存假資料

## 主系統（HQ）下一步建議

POS 用妞妞對完帳後，另開 HQ「今天營運」：待審 Restock、待出貨、預約待處理。
