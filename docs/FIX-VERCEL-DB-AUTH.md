# 正式站 DB 連線修復（Vercel Authentication failed）

## 現象

`https://furmosa-db.vercel.app/api/health` 回傳：

- `checks.database: error`
- `Authentication failed against database server at …pooler.supabase.com`

代表 **Vercel Production 的 DB 帳密與目前 Supabase 不符**（主機／埠看起來已是 pooler，多半是密碼過期或帳號格式錯）。

## 立刻修復（需有 Vercel 專案權限）

1. 打開 [Supabase](https://supabase.com/dashboard/project/ukjjopridghvwzobrsus/settings/database) → Database → Connection string  
2. 複製兩條（或重設 DB 密碼後再複製）：
   - **Transaction** pooler（port **6543**）→ 給 `DATABASE_URL`
   - **Session** pooler（port **5432**）→ 給 `DIRECT_URL`
3. 帳號必須是 `postgres.ukjjopridghvwzobrsus`（不是單純 `postgres`）
4. 打開 [Vercel → furmosa-db → Settings → Environment Variables](https://vercel.com/aa89976566s-projects/furmosa-db/settings/environment-variables)
5. 更新 **Production**（建議 Preview 一併更新）：
   - `DATABASE_URL`＝Transaction 字串，並加：`?pgbouncer=true&connection_limit=5&pool_timeout=30`（若尚未有）
   - `DIRECT_URL`＝Session 字串
6. **Redeploy** Production（Env 變更不會自動套到舊部署）
7. 再開 `https://furmosa-db.vercel.app/api/health` → 應 `ok: true`

### 範本（密碼請自行填）

```text
DATABASE_URL=postgresql://postgres.ukjjopridghvwzobrsus:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30

DIRECT_URL=postgresql://postgres.ukjjopridghvwzobrsus:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

## 用 token 一鍵同步（可選）

若已有 Vercel token：

```bash
export VERCEL_TOKEN=...   # https://vercel.com/account/tokens
export VERCEL_PROJECT_ID=prj_eDlebDCQOJp9wl65O5zpASoLj1f9
# DATABASE_URL / DIRECT_URL 使用目前可用的連線
bash scripts/sync-vercel-db-env.sh
```

然後開 `https://furmosa-db.vercel.app/api/health` 確認 `ok: true`。
