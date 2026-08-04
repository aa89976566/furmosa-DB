# Security Audit（靜態分析）

**範圍：** 程式碼與設定；未做滲透測試。  
**原則：** 只報告、不修改。不列出任何 secret 值。

---

## Critical

### C1. AUTH_SECRET 硬編碼後備字串
- **問題：** 未設定 `AUTH_SECRET` 時使用固定 fallback，production 若漏設則 JWT 可被偽造。  
- **證據：** `lib/auth.ts` L7–9；`lib/auth-edge.ts`（同樣 pattern）；merchant session 共用 secret（`lib/merchant-auth/session.ts` 待對照）。  
- **情境：** 部署漏 env → 攻擊者自簽 HQ／POS session。  
- **建議：** 無 env 時拒絕啟動／登入；production 強制檢查。  
- **影響：** 需調整 boot／auth 錯誤處理。

### C2. HQ 無 Role-Based 授權閘道
- **問題：** `User.role` 存在但多數 HQ Server Actions 只靠「有 session」。  
- **證據：** `prisma/schema.prisma` User.role；`getCurrentUser` 使用處遠少於 actions 數量；restock-requests 為少數顯式 `requireHqUser`。  
- **情境：** 任意員工帳號可改庫存／建單／看個資。  
- **建議：** 依模組強制 role；財務／倉管分離。  
- **影響：** 產品需定義角色矩陣。

---

## High

### H1. 公開 Coupons API 無 Rate Limit／無共享密鑰
- **問題：** `POST /api/coupons` middleware 放行；僅驗證 partner `storeId`。  
- **證據：** `middleware.ts` L19–20；`app/api/coupons/route.ts`。  
- **情境：** 暴力猜測券碼；或濫用 verify 探測。  
- **建議：** rate limit、store secret、CAPTCHA／短時 token。  
- **影響：** 合作店核銷 UX。

### H2. CSRF 防護未見
- **問題：** Server Actions／cookie session 未見 CSRF token 或嚴格 Origin 檢查。  
- **證據：** codebase 搜尋無 CSRF 實作；cookies `sameSite: 'lax'`（`lib/auth.ts`）。  
- **情境：** 惡意站點誘發已登入 HQ 瀏覽器送出 action（lax 可緩解部分，非完整）。  
- **建議：** 關鍵 mutation 加 Origin 檢查或 CSRF token。  
- **影響：** 表單基礎設施。

### H3. Cron 在 development 可無 secret
- **問題：** `CRON_SECRET` 未設時 `NODE_ENV===development` 放行。  
- **證據：** `app/api/cron/expire-coupons/route.ts`, `maintain-shipments/route.ts`。  
- **情境：** 誤用 development 設定上預覽／錯配 env。  
- **建議：** Preview／Production 一律要求 secret。  
- **影響：** 本地 DX。

### H4. 錯誤訊息可能洩漏內部細節
- **問題：** API catch 回傳 `e.message`。  
- **證據：** 例如 `app/api/coupons/route.ts` L29–31。  
- **情境：** Prisma／路徑錯誤暴露給客戶端。  
- **建議：** 對外通用錯誤；細節只打 log。  
- **影響：** 除錯變難，需 log 系統。

### H5. DEPLOY.md 記載預設種子帳號
- **問題：** 部署文件含預設登入提示；若 production 未輪替則風險高。  
- **證據：** `DEPLOY.md` Step 2（種子帳號說明）。  
- **建議：** production checklist 強制改密；監控異常登入。  
- **影響：** 營運流程。（本文件不重述密碼字串。）

---

## Medium

### M1. Jar PDF 大量匯出
- **問題：** `all=1` 可一次取整批序號 PDF；僅 middleware HQ。  
- **證據：** `app/api/jar-exchange/codes/pdf/route.ts`。  
- **情境：** 內部帳號外洩 → 大量未用序號外流。  
- **建議：** 角色限制、稽核 log、分批。  

### M2. 公開預約 done 頁
- **問題：** 需防止用猜測 id 讀他店預約。  
- **證據：** `app/book/[merchantKey]/done/page.tsx` 以 merchant + id 過濾（已有）。  
- **情境：** 若回歸移除 merchant 過濾 → IDOR。  
- **建議：** 保留雙條件；加測試。  

### M3. LINE Push 目標可設定
- **問題：** `bookingNotifyLineUserId` 由店家表單填入；錯誤 ID 導致通知錯人（可用性／隱私）。  
- **證據：** `app/pos/appointments/schedule/schedule-form.tsx`, schema。  
- **建議：** 綁定流程驗證歸屬。  

### M4. Raw SQL 使用面
- **問題：** 多處 `$queryRaw`／`$executeRaw`；若未來拼接字串會有 SQLi。  
- **證據：** `lib/merchant-report.ts`, `lib/stores/ensure-qimu-delivery.ts`, merchants actions 等。  
- **現況：** 多為 Prisma tagged template（參數化）。  
- **建議：** code review 禁止字串拼接 SQL。  

### M5. Store.secretToken
- **問題：** 欄位存在；coupons API 目前用 slug 而非 secret（待確認是否廢棄）。  
- **證據：** schema `Store`；`app/api/coupons/route.ts` 用 `isValidPartnerStoreSlug`。  

---

## Low

### L1. VAPID public key 端點
- **問題：** 公鑰本質可公開；但仍掛在 HQ middleware 後。  
- **證據：** `app/api/notifications/vapid-public-key/route.ts`。  

### L2. XSS
- **問題：** 未發現 `dangerouslySetInnerHTML`。  
- **建議：** 持續避免；富文字需消毒。  

### L3. File upload
- **問題：** 未發現通用檔案上傳端點（待確認 CSV import 僅 scripts）。  
- **證據：** `prisma/import.ts` 為腳本路徑。  

### L4. Dependency risk
- **問題：** `npm audit` 曾報告高嚴重性（環境快照）；需定期更新。  
- **建議：** 獨立安全更新 PR，勿與功能混做。  

---

## 正向控制（保留）

- LINE webhook HMAC + `timingSafeEqual`：`lib/line/verify-signature.ts`  
- HQ／POS cookie 分離：`middleware.ts`  
- Merchant scope helpers + 測試：`lib/merchant-auth/*`  
- Cookie httpOnly + sameSite lax + production secure：`lib/auth.ts`  
- LIFF idToken 走 LINE verify endpoint：`lib/line/verify-id-token.ts`  

---

## 修正優先建議（給 Claude）

1. 強制 `AUTH_SECRET`（C1）  
2. HQ RBAC 最小集合（C2）— 需產品定義  
3. Coupons rate limit／secret（H1）  
4. Cron secret 強制（H3）  
5. API 錯誤外洩收斂（H4）  
