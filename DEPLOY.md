# 上線指南 — Supabase Postgres + Vercel

照這份做完，你會拿到 `https://furmosa-hq.vercel.app`（或自訂網域）並有真實資料可登入。
預估 30–60 分鐘。

---

## Step 1 — 在 Supabase 建專案（5 分）

1. 前往 https://supabase.com → **Start your project** → 用 GitHub 登入
2. **New project**
   - Name：`furmosa-hq`
   - Region：選 `Northeast Asia (Tokyo)`（距台灣最近）
   - DB Password：**設一個你會記得的強密碼**（之後會用到）
3. 等 1–2 分鐘專案建好。
4. 左側 **Project Settings → Database → Connection string** 找兩條：

   - **Connection pooling**（Transaction mode）→ port `6543` → 這是 `DATABASE_URL`
   - **Direct connection**（Session mode）→ port `5432` → 這是 `DIRECT_URL`

   兩條的 `[YOUR-PASSWORD]` 換成你剛才設的密碼。
   `DATABASE_URL` 結尾要加 `?pgbouncer=true&connection_limit=5&pool_timeout=20`。
   （勿用 `connection_limit=1`：儀表板／列表會並行查詢，太緊會 pool timeout 再重試，點一下可卡約 10 秒。）

---

## Step 2 — 本機切到 Supabase，跑第一次 migration（10 分）

> 從這一步開始，本機開發也會直接連 Supabase 雲端資料庫。

1. 編輯 `.env`（不要 commit！），貼入上面兩條 URL：

   ```env
   DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=20"
   DIRECT_URL="postgresql://postgres.xxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
   AUTH_SECRET="$(openssl rand -base64 32)"
   ```

   `AUTH_SECRET` 直接用上面那段 `$(openssl …)` 在 shell 跑出來貼進去。

2. 產生第一份 migration 並推到 Supabase：

   ```bash
   rm -f prisma/dev.db prisma/dev.db-journal     # 清掉舊的 SQLite
   npx prisma migrate dev --name init            # 會在 prisma/migrations/ 建出 SQL
   ```

   完成後 Supabase 的所有 table 都會建好（你可以到 Supabase Dashboard 的
   **Table Editor** 看到 `User / Vendor / Product / Order …`）。

3. 灌種子資料 + 真實資料：

   ```bash
   npm run prisma:seed       # 建 4 個登入帳號 + 訂閱方案 + 倉庫 + 示範資料
   npm run db:import         # 從你 Downloads 的 CSV / 截圖灌真實廠商/商品/訂單
   ```

4. 確認沒問題 — `npm run dev` 開到 `http://localhost:3000` 用
   `admin@furmosa.com / furmosa2026` 登入，看資料是否齊全。

5. **重要**：把 `prisma/migrations/` **加入 git** 並 commit：

   ```bash
   git add prisma/migrations package.json .env.example
   git commit -m "feat: switch to postgres for production"
   git push
   ```

---

## Step 3 — 推 GitHub（如果還沒）

```bash
gh repo create furmosa-hq --private --source=. --push
# 或在 github.com 手動建 repo 後：
# git remote add origin <repo url>
# git push -u origin main
```

---

## Step 4 — 部署到 Vercel（10 分）

1. https://vercel.com → **Add New → Project** → 選你的 GitHub repo
2. **Framework Preset** 會自動偵測為 Next.js。**先不要按 Deploy。**
3. 展開 **Environment Variables**，加入：

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | 6543 的 pooled URL，**結尾加** `?pgbouncer=true&connection_limit=10&pool_timeout=20`（dashboard 一次發多個 query，太緊會 timeout） |
   | `DIRECT_URL` | 5432 的 direct URL |
   | `AUTH_SECRET` | 用 `openssl rand -base64 32` 產一條 **新的**（**不要**和本機共用） |
   | `SESSION_HOURS` | `168` |
   | `JIBA_TRANSFER_BANK_NAME` | Production 收款銀行名稱（Preview／本機用 placeholder） |
   | `JIBA_TRANSFER_BANK_CODE` | Production 銀行代碼 |
   | `JIBA_TRANSFER_ACCOUNT` | Production 收款帳號（**不要**寫進 Git） |

4. 按 **Deploy**。Vercel 會跑：

   ```
   npm install
     → postinstall: prisma generate
   npm run build
     → prisma generate && prisma migrate deploy && next build
   ```

   `migrate deploy` 會把 `prisma/migrations/` 內所有 SQL **冪等套用**到雲端 DB。

5. 完成後得到 `https://furmosa-hq.vercel.app`，用一樣的帳號登入。

---

## Step 5 — 第一次上線後的安全清單（5 分）

- [ ] **改掉預設密碼**：4 個系統帳號（admin / finance / ops / wh）目前都是
      `furmosa2026`。請從 UI 改密碼（或寫一支 admin 工具）。
- [ ] **AUTH_SECRET 用過就不要再貼到別處**（GitHub、Slack…）。
- [ ] **Supabase 啟用每日 backup**：Settings → Database → Backups（Free plan
      會保留 7 天 PITR）。
- [ ] **Vercel 加自訂網域**（可選）：Settings → Domains。

---

## 之後新增 schema 變更怎麼上線？

1. 本機改 `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_xxx_field`
   （會在 `prisma/migrations/` 生成新 SQL 並套到本機 Supabase）
3. `git commit && git push`
4. Vercel 自動部署，`migrate deploy` 自動把新 SQL 套到 prod

**永遠用 `migrate dev / migrate deploy`，不要再用 `db push`** — 否則 prod
和 dev 的 schema 會分岔。

---

## 故障排解

### `prisma migrate deploy` 在 Vercel 失敗：`Can't reach database server`
→ `DIRECT_URL` 沒設、或 password 有 `@` `:` 等特殊字元沒 URL-encode。

### Runtime 偶發 `prepared statement already exists`
→ `DATABASE_URL` 結尾忘了加 `?pgbouncer=true&connection_limit=5&pool_timeout=20`。
  若仍偶發連線 timeout，勿改回 `connection_limit=1`（會讓導航卡約 10 秒）。

### 改 schema 後 build 報 `column does not exist`
→ Migration 沒生 / 沒 push。本機跑 `prisma migrate dev` 後務必 `git add prisma/migrations`。

### 想完全重置 prod DB（**會清空所有資料**）
→ 在 Supabase Dashboard 砍掉所有 table，再下次 deploy 會自動跑 init migration。
