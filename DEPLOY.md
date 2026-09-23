# 正式發布指南 — Railway + Supabase + Vercel Preview

本文件是正式發布的唯一操作入口。舊的「Vercel Production 自動跑 migration」流程已停用。

部署環境角色與正式網址的唯一機器可讀來源是 [`config/deployment-targets.json`](config/deployment-targets.json)。本文件解釋操作流程；兩者若衝突，立即停止 Release，先由獨立 PR 修正衝突，不得臨場猜測。

## 平台責任

| 平台 | 唯一責任 | 禁止事項 |
|---|---|---|
| GitHub | 原始碼、CI、受控 Release 與稽核紀錄 | 不得略過 exact SHA 與 CI |
| Railway | 唯一 Production，從 `main` 自動部署 | 不得部署落後 main 的分支 |
| Supabase | Production PostgreSQL | 不得由 build/start 自動改 schema |
| Vercel | Pull Request Preview | 不得視為 Production；不得連正式 DB |

Vercel 的 `ignoreCommand` 會略過 `main`，只建立非 main 分支的 Preview。Railway 必須保持 `Wait for CI` 關閉，並以 `/api/health` 作 deployment healthcheck；healthcheck 失敗時 Railway 不切換流量。`Deploy Production` 本身會核對 PR CI，且會等待 Railway 回報同一個 merge commit 的結果；若 Railway 同時等待這個 workflow，兩邊會形成循環等待。

## 自動更新邊界

- 開發者 push 功能分支：自動更新 Vercel Preview，正式站不變。
- PR 測試或審查失敗：停止，正式站不變。
- `Deploy Production` 鎖定 exact PR/SHA，通過檢查並合併到 `main`：Railway 自動部署該 merge commit。
- Railway 或 smoke 失敗：不得宣稱已部署，也不得改用 Vercel Production 補上。

因此本專案採「受控合併後自動部署」，不採「每次修改自動上正式站」。同一版本不需要同時部署 Railway Production 與 Vercel Production。

## 「部署」的固定意義

使用者說「部署」，代表執行 GitHub Actions 的 **Deploy Production**，並提供：

1. 開啟且 base 為 `main` 的 PR 編號。
2. 該 PR 當下完整 40 字元 head SHA。
3. 已核准的 migration plan；沒有 DB 變更時選 `none`。

瀏覽器目前所在網址不構成部署目標。Vercel 成功只代表 Preview 可供驗收，不能回報為正式上線；也不需要把同一版本再部署一次到 Vercel Production。

工作流程依序執行：

1. 核對 PR、exact head SHA、非 Draft。
2. 核對同一 SHA 的 `verify` CI 成功。
3. 核對 PR migration 路徑與所選 plan 完全相容。
4. 進入 GitHub `production` Environment approval。
5. 執行限定 migration runner；不執行全量待辦 migration。
6. 用正式 DB 做唯讀 HQ 密碼、訂單查詢與出貨查詢檢查。
7. squash merge exact PR head。
8. 等待 GitHub commit status 中 Railway 對同一 merge commit 回報成功。
9. 對 Railway 正式網址執行公開唯讀 smoke。
10. 再執行一次正式 DB 唯讀檢查。
11. 寫入 GitHub Job Summary，並保存 90 天 JSON release artifact。

只有第 8 至 10 步都通過後才能向使用者說「已部署」。回報須包含 PR、head SHA、merge SHA、Railway 正式網址及 smoke 結果；缺一項時只能回報「尚未完成」與實際停點。

任一步驟失敗就停止。migration 失敗發生在 merge 前，不會部署新版；Railway build／healthcheck 失敗時上一版繼續服務。部署後 smoke 失敗時工作流程標示失敗，依該次 artifact 與 Railway 上一個成功 deployment 人工 rollback，不做無限自動重試。

## GitHub 一次性設定

Repository → Settings → Environments 建立 `production`：

- 啟用 Required reviewers。
- Deployment branches 僅允許 `main`。
- Environment variables：
  - `PRODUCTION_ORIGIN=https://furmosa-hq-production.up.railway.app`
  - `RAILWAY_STATUS_CONTEXT=furmosa-hq - furmosa-hq`
- Environment secrets：
  - `PRODUCTION_DATABASE_URL`：Supabase direct/session PostgreSQL URL，只供 migration/readiness。
  - `PRODUCTION_SMOKE_HQ_EMAIL`：既有、最低必要權限的 HQ 驗證帳號。
  - `PRODUCTION_SMOKE_HQ_PASSWORD`：上述帳號密碼。

Secrets 不得放在 Repository variables、程式碼、PR、log 或 artifact。Smoke 帳號不得是新建的示範帳號，也不得用於寫入業務資料。

Repository → Settings → Actions → General：

- Workflow permissions 允許 GitHub Actions 建立 PR merge commit。
- `main` branch rules 禁止直接 push，要求 PR、`verify` 通過及必要 review。
- Railway GitHub integration 保持對 `main` 自動部署，但 `Wait for CI` 必須關閉。PR CI 與正式環境核准由 `Deploy Production` workflow 負責；Railway 負責 build 與 `/api/health` 切流量門檻。

## Migration plan 規則

可選 plan 定義在 `scripts/release/release-plans.mjs`，workflow choice 必須同步列出同名 plan。每個 plan 明列唯一 runner、允許修改的 migration 目錄及 PR 必須包含的檔案。

目前 plan：

- `none`：PR 不得修改 `prisma/migrations/**`。
- `hq_inventory_advisory_20260917`：只執行 `scripts/ops/deploy-hq-bulk.mjs`，限定 HQ bulk inventory 兩份 migration 與已核准六筆盤點。

新增 migration 時先建立新的 plan 與冪等／交易式 runner，通過 review 後才可提供 Production 使用。不得把 `prisma migrate deploy` 無條件用在目前正式庫，也不得把 migration 塞進 `npm run build`。

## 使用方式

GitHub → Actions → **Deploy Production** → Run workflow：

- `pr_number`：例如 `253`
- `expected_head_sha`：完整 40 字元 SHA
- `migration_plan`：依 PR 選擇

一般使用者只需要說「部署」。執行者負責解析目前核准的 PR 與 head SHA，不能猜測或自動改選 migration plan。

## 驗證範圍

公開 HTTP smoke 固定檢查 `/api/health`、HQ／POS 登入頁、未登入 redirect gate 與 merchant API 未授權回應。正式 DB readiness 固定驗證 HQ 密碼 hash、訂單唯讀查詢及出貨唯讀查詢。

流程不寄出訂單、不變更狀態、不呼叫物流／付款／webhook、不執行 cron，也不輸出客戶資料、帳號、密碼或資料庫 URL。

## 初次導入注意

`Deploy Production` workflow 必須先存在於 default branch 才能從 GitHub UI 執行。因此導入這套流程的第一個 PR 必須依舊有安全人工檢查與合併；自下一個 Release 起一律使用 workflow。Release controller（workflow、`scripts/release/**`、Vercel Preview gate）需用獨立 PR 更新，不能與一般產品 Release 同一批自我修改後立即執行。

## 回復

- 程式：從 Railway Deployments 選上一個已記錄的成功 deployment，執行 Rollback。
- DB：migration 預設採 expand/contract 與相容舊程式設計；不要自動 down migration。需要資料回復時必須另行核准精準 repair plan。
- 回復後重新執行公開 smoke 與唯讀 DB readiness，並把結果附在事件紀錄。
