# Phase 1 / C1 — 強制 AUTH_SECRET

**日期：** 2026-07-26  
**分支：** `cursor/phase1-auth-secret-24aa`  
**範圍：** 只處理 SECURITY C1（一次一問題）

## 計畫

Production（`NODE_ENV===production`，含 Vercel Preview／Production）未設定或空白 `AUTH_SECRET` 時，拒絕簽發／驗證 JWT，不再使用硬編碼 fallback。

## 變更

| 檔案 | 說明 |
|------|------|
| `lib/auth-secret.ts` | `resolveAuthSecret` / `getAuthSecretKey` |
| `lib/auth.ts` | HQ session 改用 shared helper |
| `lib/auth-edge.ts` | middleware HQ verify |
| `lib/merchant-auth/session.ts` | POS session |
| `lib/merchant-auth/edge.ts` | middleware POS verify |
| `lib/__tests__/auth-secret.test.ts` | 回歸測試 |
| `.env.example` | 註明 production／preview 必填 |

## 驗收

- [x] production + 無 AUTH_SECRET → throw `缺少環境變數 AUTH_SECRET`
- [x] development／test 仍可用本地 fallback（既有 merchant-auth 測試通過）
- [x] `node --import tsx --test lib/__tests__/auth-secret.test.ts lib/merchant-auth/__tests__/merchant-auth.test.ts` 全綠
- [ ] 部署前確認 Vercel 已設定 `AUTH_SECRET`（營運檢查）

## 已知非本 PR

- `tsc`：main 既有 `lib/line/__tests__/flex-menu.test.ts` 型別錯誤（Phase 0 baseline 已記錄）

## 風險與回滾

- **風險：** Vercel 若漏設 `AUTH_SECRET`，middleware／登入會失敗（預期安全行為）。  
- **回滾：** `git revert` 本 PR commit。  
- **驗證：** Preview 登入 HQ／POS；未設 secret 的環境應無法發 session。
