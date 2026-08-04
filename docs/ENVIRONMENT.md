# Environment Variables & Deployment Context

**規則：** 只列名稱與用途；**永不**在文件或 commit 中寫入真實值。  
**來源：** `.env.example`, `DEPLOY.md`, `docs/LINE-SETUP.md`, 程式 `process.env`／`readEnv`。

---

## 1. 變數一覽

| 變數名稱 | 用途 | 使用位置（代表） | 必填 | 前端可見 | 敏感 |
|----------|------|------------------|------|----------|------|
| `DATABASE_URL` | Postgres 池化連線（runtime） | Prisma, `lib/prisma.ts` | 是（prod） | 否 | 是 |
| `DIRECT_URL` | Postgres 直連（migrate） | Prisma schema `directUrl` | 是（migrate） | 否 | 是 |
| `AUTH_SECRET` | HQ／POS JWT 簽名 | `lib/auth.ts`, `auth-edge.ts`, `merchant-auth/session.ts` | **是（prod）** | 否 | 是 |
| `SESSION_HOURS` | Session 時長（小時） | auth／merchant-auth | 否（預設 168） | 否 | 否 |
| `CRON_SECRET` | Cron Bearer | `app/api/cron/*` | 是（prod） | 否 | 是 |
| `WAITING_FOR_JAR_RESERVATION_DAYS` | 換罐保留天數設定 | `lib/config/product-settings.ts` | 否 | 否 | 否 |
| `LINE_CHANNEL_SECRET` | Webhook HMAC | `lib/line/config.ts`, verify-signature | LINE 功能必填 | 否 | 是 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Reply／Push | `lib/line/config.ts`, reply／push | LINE 功能必填 | 否 | 是 |
| `LINE_CHANNEL_ID` | LIFF ID Token 驗證（Login 頻道） | `lib/line/liff-config.ts` | LIFF 必填 | 否 | 中* |
| `LINE_LIFF_ID` | LIFF 後備 ID | `liff-config.ts` | 否 | 否† | 中* |
| `LINE_LIFF_ID_REGISTER` | 註冊 LIFF | liff-config, LIFF pages | LIFF 建議 | 否† | 中* |
| `LINE_LIFF_ID_PROFILE` | 資料／預約綁定 LIFF | 同上；booking 可選 | 建議 | 否† | 中* |
| `LINE_LIFF_ID_REWARDS` | 兑獎 LIFF | 同上 | 建議 | 否† | 中* |
| `NEXT_PUBLIC_MEMBER_SITE_URL` | 會員核銷站網域顯示 | 會員／店家連結 | 建議 | **是** | 否 |
| `VAPID_PUBLIC_KEY` | Web Push 公鑰 | `lib/web-push.ts`, notifications API | Push 必填 | 經 API 暴露 | 低 |
| `VAPID_PRIVATE_KEY` | Web Push 私鑰 | `lib/web-push.ts` | Push 必填 | 否 | 是 |
| `VAPID_SUBJECT` | VAPID subject | web-push | Push 必填 | 否 | 低 |
| `NODE_ENV` | 執行環境 | cookie secure、cron 寬鬆邏輯 | 框架設定 | 否 | 否 |
| `VERCEL_URL` | 部署 URL 推導 | `lib/stores/redeem-url.ts` | Vercel 自動 | 否 | 否 |

腳本用（勿入 repo 值）：`MERCHANT_ID`, `USERNAME`, `PASSWORD`, `DISPLAY_NAME`, `ALLOW_ADDITIONAL_ACTIVE` — `scripts/create-merchant-user.ts`。

\* LIFF／Channel ID 非密碼但可被濫用，宜當半敏感。  
† LIFF ID 可能出現在客戶端 bundle／URL（`liff.line.me/...`），非 `NEXT_PUBLIC_` 但仍可能暴露 — 屬平台特性。

---

## 2. Local development

1. 複製 `.env.example` → `.env`（gitignored）。  
2. 填 Supabase URL 或本地 Postgres。  
3. `npm install` → `npx prisma migrate deploy` →（可選）`npm run prisma:seed`。  
4. `npm run dev`。  
5. **勿**使用 production `AUTH_SECRET`／DB 於不可信環境。

---

## 3. Staging／Preview

- Vercel Preview：需設定與 production 相同**名稱**的 env（可用獨立 DB）。  
- Preview SSO 可能擋住匿名 curl（待確認專案設定）。  
- Cron 在 Preview **不一定**執行（Vercel 行為待確認）；邏輯仍應要求 `CRON_SECRET`。

---

## 4. Production

- 平台：Vercel；DB：Supabase（`DEPLOY.md`）。  
- Cron：`vercel.json` 兩條每日 UTC 排程（Hobby 不可改更頻繁）。  
- 輪替：種子帳號密碼、`AUTH_SECRET`、LINE token、VAPID。  
- Build：`package.json` `build` 含 `prisma generate` 與 `migrate deploy`。

---

## 5. Database

| 項目 | 說明 |
|------|------|
| Runtime | `DATABASE_URL` + pgbouncer 參數（見 `.env.example` 註解） |
| Migrate | `DIRECT_URL` |
| 禁止 | 對 production 執行 `db:reset`／任意 destructive |

---

## 6. External integrations checklist

| 整合 | 必要 env |
|------|----------|
| DB | `DATABASE_URL`, `DIRECT_URL` |
| Auth | `AUTH_SECRET` |
| Cron | `CRON_SECRET` |
| LINE Bot | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` |
| LIFF | `LINE_CHANNEL_ID`, `LINE_LIFF_ID_*` |
| Web Push | `VAPID_*` |

設定步驟（無值）：`docs/LINE-SETUP.md`, `DEPLOY.md`。

---

## 7. Deployment requirements

- Node 對應 Vercel Next 14 影像  
- Env 齊全後 Deploy  
- 首次／遷移：migrate 成功  
- Post-deploy：驗證 `/login`、`/pos/login`、LINE webhook URL、cron 日誌  
