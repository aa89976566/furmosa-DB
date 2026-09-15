# Furmosa Release Evidence

狀態：**NO-GO／尚未取得發布資格**

候選日期：2026-09-15

本文件是每個候選版本的唯一發布證據入口。只有同一 revision 的必要 Gate 全部通過，才可改為 GO。其他分支或資料夾的測試、平台顯示成功、代理口頭回報都不能替代本表。

## 候選基準

| 項目 | 結果 |
|---|---|
| Repository | `aa89976566/furmosa-DB` |
| Base revision | `780046272ac0c947fd23c94b6302a75f616ee537` |
| Base | 2026-09-15 已 fetch 並核對 GitHub 遠端 main |
| Worktree | 隔離工作樹，建立後為乾淨 detached HEAD |
| Production revision | **未驗證** |
| Schema／migration production status | **未驗證** |

先前使用的 `codex/oms-claude-cursor-rule` 位於 `0e7f1a3b...`，比本機 `origin/main` 落後 44 commits，不得作為發布候選。

## Build 與 migration 邊界

| 檢查 | 結果 | 證據 |
|---|---|---|
| build 不執行 migration | PASS | `package.json`: `prisma generate && next build` |
| build 無 migrate／seed／db push／示範帳號寫入 | PASS | `build-zero-write-security.test.ts` 6/6 |
| migration 有獨立命令 | PASS（靜態） | `npm run prisma:deploy` |
| DEPLOY 指引可直接操作 | FAIL | 舊內容仍描述自動 migration／正式重置；已加禁止操作警告 |
| production-mode build 可完成 | **未驗證** | 尚未在本候選執行 |

## 必要發布 Gate

- [ ] Fetch 後確認 latest main SHA，候選必須以該 revision 為基準。
- [ ] 記錄完整 working tree，白名單外 diff 為零。
- [ ] Prisma validate 通過。
- [ ] migration 只在隔離 PostgreSQL 通過；不得連正式資料庫。
- [ ] TypeScript typecheck 通過。
- [ ] 完整測試通過，保存 exit code 與測試數量。
- [ ] production-mode build 完成且零資料寫入。
- [ ] Preview 使用隔離資料庫，不共享正式資料。
- [ ] 店家／POS Golden Journey 通過。
- [ ] 一般客戶／Shopify Golden Journey 通過。
- [ ] LINE／換罐 Golden Journey 通過。
- [ ] Production protection／批准規則已確認。
- [ ] 記錄可用 rollback target 與回復步驟。
- [ ] 部署後唯讀 smoke 通過；登入 redirect 不算 authenticated read 成功。
- [ ] 觀察窗內無新增重大錯誤、同步積壓或對帳差異。

## Golden Journey Evidence

| Journey | Revision | Environment | Result | Test namespace | Evidence |
|---|---|---|---|---|---|
| 店家／POS | — | — | 未驗證 | — | — |
| 一般客戶／Shopify | — | — | 未驗證 | — | — |
| LINE／換罐 | — | — | 未驗證 | — | — |

## 本工作包的實際測試

```text
node --experimental-strip-types --test lib/__tests__/build-zero-write-security.test.ts
tests 6; pass 6; fail 0
```

測試只讀取原始碼與 `package.json`，沒有 import 業務模組、連線資料庫或執行 build。

## Production Side Effects

本工作包沒有執行 deployment、migration、seed、import、cron、webhook、帳號建立、正式資料修改或刪除。

## GO／NO-GO 規則

- 任一必要 Gate 未驗證或失敗：`NO-GO`。
- migration、付款、權限、正式資料修復：另需明確人工批准。
- Candidate SHA 在驗證後改變：原證據失效，重新驗證。
- Rollback 不可用：停止發布，不用現場修補替代。
