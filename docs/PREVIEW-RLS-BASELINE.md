# Preview RLS 安全基線（Phase 1 草案）

狀態：**本地草案 only**。未套用 Preview／Production。不得宣稱 Security Advisor 53→0。

基準分支：`cursor/preview-rls-audit-24aa`（自 `3a67857`）。  
Preview project ref（設定意圖）：`etrcbqtibmkkjwlzdsng`。  
Production：**另開 PR + 人工核准後才可討論**。

---

## 1. 產品已核准方向（摘要）

1. Merchant owner／staff 第一版同權。
2. 商家僅見本店預約；不可見顧客他店紀錄。
3. 預約須登入（**不可匿名**）；現有匿名 `/book` 標為待關閉／改登入後使用。
4. 商家可**唯讀**本店訂單與結算；結算修改僅 HQ。
5. Runtime 改用**非 owner、非 BYPASSRLS** DB role。
6. RLS 僅先 Preview；Prod 另 PR。

---

## 2. Prisma runtime／owner 假設（repo 可證明 vs 不可）

| 項目 | Repo 證據 | 結論 |
|---|---|---|
| 連線方式 | `prisma/schema.prisma`：`env("DATABASE_URL")` + `env("DIRECT_URL")` | Prisma 使用單一 Postgres URL 使用者 |
| Client | `lib/prisma.ts`：`new PrismaClient()`，無 `SET ROLE`／`set_config` | **無法**把 merchant／customer JWT 自動傳入 Postgres session |
| Supabase JS / service_role | 程式碼無 `@supabase/*`、無 `service_role` | App 不走 PostgREST；風險在直連 Postgres 與未來誤曝 key |
| Runtime role 實際名稱 | **無**（僅 connection string 使用者，值禁止讀取） | 使用 placeholder：`REPLACE_ME_FURMOSA_RUNTIME` |
| Schema／table owner | **無法從 repo 證明** | placeholder：`REPLACE_ME_SCHEMA_OWNER`（通常為 migrate／DIRECT_URL 使用者） |
| Supabase 平台角色 | 官方文件固定存在 | 可點名：`anon`、`authenticated`、`service_role`（非猜測） |

---

## 3. 兩階段策略（誠實邊界）

### Phase 1（本草案 SQL + 應用閘門）— **尚未套用**

1. 對 **51 張 Prisma 業務表** `ENABLE ROW LEVEL SECURITY`（不碰 `_prisma_migrations`、`auth.*`、`storage.*` 等系統表）。
2. `REVOKE` PostgREST 角色 `anon`／`authenticated` 對業務表的權限 → 直連 API 預設 deny。
3. 建立受限 runtime role（**無密碼寫入 SQL**；密碼 out-of-band）。
4. 授予 runtime role 必要 DML；以 `TO REPLACE_ME_FURMOSA_RUNTIME` 的 permissive policy 允許 **server path**（承認：**尚未**做 per-merchant／per-customer DB row 過濾）。
5. **不**使用 `FORCE ROW LEVEL SECURITY`（避免 `REPLACE_ME_SCHEMA_OWNER` 跑 `prisma migrate` 時被自己的 RLS 鎖死；owner 仍可能 bypass — 故 **必須**把 Preview `DATABASE_URL` 改為 runtime role 後，RLS 才對 App 生效）。
6. 應用層：顧客預約強制 LINE 身份（見 `lib/booking/auth-gate.ts`）。

### Phase 2（未來；本輪只設計）

在每筆 Prisma 交易開頭設定 transaction-local claim，例如：

```sql
SELECT set_config('app.actor_type', 'merchant', true);
SELECT set_config('app.merchant_id', '<cuid>', true);
SELECT set_config('app.customer_id', '<cuid>', true);
SELECT set_config('app.line_user_id', '<line>', true);
```

然後以 `current_setting('app.merchant_id', true)` 寫真正的 tenant policies，並移除 Phase 1 的 `USING (true)` server blanket。  
輔助函式草案見 migration 內 `app_rls.*`（schema `app_rls`）。

**在 identity 傳遞未落地前，禁止宣稱 DB 層已完成跨店隔離。**

---

## 4. 匿名／book 狀態

| 路徑 | 狀態 |
|---|---|
| `POST` `publicBookAction` 無 `lineIdToken` | **須拒絕**（本輪已加 server 閘門） |
| `submitCustomerBooking` 無 `lineUserId` | **須拒絕** |
| `/book/*` UI | **待關閉匿名流程／改登入後使用**（本輪不重做 UI） |
| POS／HQ 代客預約 `createMerchantAppointment` | 仍允許（操作者已是 merchant／HQ session） |

---

## 5. Webhook／cron／HQ

| Path | Phase 1 DB | 應用層 |
|---|---|---|
| LINE webhook / ECPay / cron | 與 App 共用 runtime role + blanket server policy | 既有 signature／`CRON_SECRET` |
| HQ | 同上 | HQ cookie；結算寫入僅 HQ actions |
| Merchant | 同上 | session `merchantId`；訂單／結算**唯讀**（應用待後續 PR 強化；矩陣已記錄） |

獨立 DB role 給 webhook（最小寫入）列為 Phase 2 選項，避免本輪破壞 LINE／ECPay／cron。

---

## 6. 草案檔位置與 rollback

- 正向：`prisma/rls-drafts/20260805190000_preview_rls_phase1_baseline/migration.sql`
- 回滾：`.../rollback.sql`（`DISABLE ROW LEVEL SECURITY`、drop policies／functions／role grants；**不 DELETE 業務資料**）
- **刻意不放進** `prisma/migrations/`，以免 Vercel `prisma migrate deploy` 自動套用。

晉升手順（需另一次明確核准）：置換 placeholder → 人工審查 → 移入 `prisma/migrations/` 或 Supabase SQL editor 套用 Preview → Redeploy／改 `DATABASE_URL` 使用者為 runtime role → 跑驗收。

---

## 7. Preview 套用前檢查清單

- [ ] 僅連 Preview ref `etrcbqtibmkkjwlzdsng`，**非** Production
- [ ] 已替換所有 `REPLACE_ME_*` placeholder
- [ ] Runtime role 密碼已用安全通道設定（不進 git）
- [ ] Preview `DATABASE_URL`／`DIRECT_URL`：runtime vs migrate 職責已分開文件化
- [ ] 已備份／可 rollback
- [ ] 套用後：`anon`／`authenticated` 無法讀業務表
- [ ] 套用後：App health／HQ login／POS login／LINE webhook／ECPay Stage／cron 煙測
- [ ] Security Advisor 複掃（套用後才可談 53→0）
- [ ] Production 未變更

---

## 8. 測試（本地、無遠端 DB）

- `lib/rls/__tests__/policy-matrix.test.ts`
- `lib/rls/__tests__/sql-draft-static.test.ts`
- `lib/booking/__tests__/booking-auth-gate.test.ts`
