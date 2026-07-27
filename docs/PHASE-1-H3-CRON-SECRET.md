# Phase 1 / H3 — Cron 強制 CRON_SECRET

**日期：** 2026-07-27  
**分支：** `cursor/phase1-h3-cron-secret-24aa`  
**範圍：** 只處理 SECURITY H3（一次一問題）

## 計畫

Preview／Production（`VERCEL_ENV=preview|production` 或 `NODE_ENV=production`）一律要求 `CRON_SECRET`，且 `Authorization: Bearer <secret>` 必須吻合（timing-safe）。  
本機 `development`／`test` 在未設定 secret 時仍可放行，方便手動觸發。

## 變更

| 檔案 | 說明 |
|------|------|
| `lib/cron-auth.ts` | `requiresCronSecretEnv` / `authorizeCronRequest` |
| `app/api/cron/expire-coupons/route.ts` | 改用 shared helper |
| `app/api/cron/maintain-shipments/route.ts` | 同上 |
| `lib/__tests__/cron-auth.test.ts` | 回歸測試 |
| `.env.example` | 註明 Preview／Production 必填 |
| `docs/PHASE-1-H3-CRON-SECRET.md` | 本說明 |

## 驗收

- [x] production／preview + 無 `CRON_SECRET` → 401
- [x] 有 secret 但 Bearer 錯誤 → 401
- [x] development 無 secret → 放行
- [x] `node --import tsx --test lib/__tests__/cron-auth.test.ts` 全綠

## 營運檢查

- 確認 Vercel Preview／Production 已設定 `CRON_SECRET`（與 Vercel Cron 自動帶的 Bearer 一致）

## 風險與回滾

- **風險：** Preview／Production 若漏設 `CRON_SECRET`，排程會 401（預期安全行為）。  
- **回滾：** `git revert` 本 PR commit。  
- **驗證：** Preview 打 `/api/cron/expire-coupons` 無 Bearer → 401；帶正確 Bearer → 200（或業務 JSON）。
