# 換罐 NT$99 資格視窗 — Phase 1

> **狀態：Preview／尚未 live enforcement**  
> 本階段只建資料模型、純決策、加入前文案與 Preview builders。  
> **沒有**在店家確認空瓶時建立資格、**沒有**後端核銷阻擋、**沒有**真實提醒。

Base：`main` @ `8b291fc`  
Branch：`cursor/refill-exchange-window-b63a`

## HQ 可視化驗收入口（本輪補齊）

精確路徑（需 HQ 登入，與 `/admin/store-report` 相同 session）：

| 狀態 | URL path |
|------|----------|
| 加入前規則 | `/admin/line-message-preview/refill-exchange-window?state=join-before` |
| 資格啟用 | `/admin/line-message-preview/refill-exchange-window?state=activated` |
| 錯店 | `/admin/line-message-preview/refill-exchange-window?state=wrong-store` |
| 即將到期 | `/admin/line-message-preview/refill-exchange-window?state=expiring-soon` |
| 已過期 | `/admin/line-message-preview/refill-exchange-window?state=expired` |

側欄：**換罐會員 → 換購期限預覽**

此頁重用／對齊雞霸 PR 的 LINE Preview 桌機模擬器概念（`components/line-preview`），但**不**引入雞霸流程、**不**接 live DB／push／cron。

### 驗收限制（如實）

1. **Vercel Deployment Protection**：Preview URL 可能先要求 Vercel 帳號權限，agent／外部無法直接開頁。
2. **HQ 登入**：通過 Vercel 後仍需 HQ session（與 `/admin/store-report` 相同）；未登入導向 `/login`。
3. **人工目視**：真實瀏覽器截圖需 Owner 登入後自行確認；本輪以契約測試＋靜態 QA HTML（420／320）完成結構化驗收，**不宣稱已有 Production Preview 真人截圖**。

### 靜態 QA 腳本（可選）

`scripts/render-refill-exchange-preview-qa.ts`：**非 Production runtime、非部署必要**。僅手動重產靜態 HTML 對照 Flex；不進 app import graph。

**已完成（Phase 1）**

1. **資料模型** `RefillExchangeEntitlement` → 表 `refill_exchange_entitlements`
   - 一空瓶（`returnedJarCodeId` unique）→ 一筆資格
   - `merchantId`＝原店快照（預期取 `JarCode.issuedMerchantId`）
   - `activatedAt` / `expiresAt` / `redeemedAt?` / `reminderSentAt?`
   - **不存 stored status**（由時間＋`redeemedAt` 派生）
2. **Additive migration** `20260811043000_refill_exchange_entitlement`
   - 只 `CREATE` 新表／index／FK
   - **不** `ALTER refill_orders`、不改 `oldContainerReturnedAt` 語意、不 backfill
3. **SSOT**
   - `REFILL_EXCHANGE_WINDOW_DAYS = 30`
   - `REFILL_EXPIRY_REMINDER_DAYS = 7`
4. **純函式**（`lib/refill/exchange-window.ts`）
   - `computeExchangeExpiresAt`：Asia/Taipei 日曆天 + 保留牆鐘
   - `deriveExchangeEntitlementLifecycle`：active／expiring-soon／redeemed／expired
   - 到期瞬間（`now >= expiresAt`）即不可用
5. **加入前 LINE Flex** 醒目區塊（暖底＋「30 天內」獨立加大加粗）
   - 主卡已精簡為決策卡：標題／副標／核心四項／30 天醒目／三 CTA
   - 四步驟、七口味清單、合作店按鈕、雙價格格已移出主卡（完整規則／口味回覆仍在）
6. **Preview 文案 builders**（啟用／錯店／即將到期／已過期）— `mode: preview-only`
7. **顧客文案語氣統一**（見 `lib/jar-exchange/refill-customer-copy-tone.ts`）
   - 加入前主卡、五態 Preview、FAQ 皆套用台灣飼主自然口語＋Bark 感；不暗示 Preview 已上線

### onDelete 說明（保守）

| FK | onDelete | 理由 |
|----|----------|------|
| customerId | Restrict | 有資格時不可靜默刪會員 |
| returnedJarCodeId | Restrict | 空瓶序號是資格主鍵依據，不可刪除後孤兒／重用混淆 |
| merchantId | Restrict | 原店快照需可稽核 |

## 尚未啟用（全部留 Phase 2）

- [ ] 店家 `verifyOldContainer` 確認空瓶時 **建立** entitlement
- [ ] 後端原店核銷（比對 `entitlement.merchantId`）與過期阻擋
- [ ] NT$99 eligibility 改讀 entitlement（不再只靠 `issued` 罐）
- [ ] 真實到期前 7 天提醒／cron／outbox／LINE push
- [ ] 舊資料 backfill
- [ ] 與 #89／#90 的 merchant／付款路徑整合

**驗收注意：** Flex 上的「Preview・規則預告（尚未正式啟用）」不可解讀為已強制執行。

## 禁止事項（本 PR）

- 不 merge、不 Production deploy
- 不 `migrate deploy`／`db push`／seed／backfill（僅產生 SQL＋`prisma validate`／`generate`）
- 不修改 `lib/refill/merchant.ts`、ECPay、預約綁定、#89/#90/#91、morning 系列
