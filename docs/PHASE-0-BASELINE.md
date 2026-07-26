# Phase 0 Baseline Report

**日期：** 2026-07-26  
**分支：** `cursor/claude-handoff-docs-24aa`（已 merge `origin/main`）  
**計畫依據：** `docs/CLAUDE_REVIEW_PLAN.md` § Phase 0  
**本 Phase 程式變更：** 無（僅本報告）

---

## 1. 環境

| 項目 | 結果 | 分類 |
|------|------|------|
| `.env` 檔 | 不存在 | 環境 |
| `DATABASE_URL` | 有設定，指向 `localhost` | 環境 |
| `DIRECT_URL` | 有設定 | 環境 |
| Postgres 可連線 | **否**（`Can't reach database server at localhost:5432`） | 環境 |
| 交接文件包 | 存在（見 §3） | 通過 |
| `CLAUDE.md` / `middleware.ts` / `prisma/schema.prisma` / `package.json` | 存在且可讀 | 通過 |

---

## 2. 指令結果

| 指令 | Exit | 結果 | 失敗分類 |
|------|------|------|----------|
| `npx prisma validate` | 0 | Schema valid | — |
| `npx prisma generate` | 0 | Client 已產生（merge 後需執行才能對齊 `petBreed`） | — |
| `npx tsc --noEmit` | **2** | 1 個型別錯誤（見下） | **產品** |
| `npm test` | **1** | 150 pass / 0 fail / **2 cancelled** | **環境**（cancelled） |
| `npm run lint` | **1** | 互動式「How would you like to configure ESLint?」後失敗 | **產品／環境** |

### 2.1 `tsc` 失敗（產品）

```
lib/line/__tests__/flex-menu.test.ts(70,23):
  Property 'contents' does not exist on type 'LineReplyMessage'.
```

- 依據：`LineReplyMessage` 聯合型別在 `lib/line/reply.ts`；測試未收窄至 flex 分支。  
- **Phase 0 不修改程式**（計畫禁止業務／測試修復混入本 Phase）。  
- 建議交 **Phase 6** 或獨立小 PR 修正測試型別。

> 註：`petBreed` 相關 tsc 錯誤在 `prisma generate` 後消失（schema 已有欄位；屬 client 未 regenerate 的環境現象）。

### 2.2 `npm test` cancelled（環境）

| Suite | 現象 |
|-------|------|
| `jar exchange`（`lib/jar-exchange/__tests__/jar-exchange.test.ts`） | parent 因無法連 `localhost:5432` 取消 2 個子測試 |

其餘 unit／merchant-auth／booking／line throttle 等 **150 通過**。

### 2.3 `npm run lint`（產品／環境）

- Repo **無** `.eslintrc*` / `eslint.config.*`。  
- `next lint` 進入首次設定互動選單，非互動 CI／agent 環境無法完成 → exit 1。  
- **Phase 0 不新增 ESLint 設定**（超出本 Phase「僅報告」範圍；若要修屬後續明確批准的工具鏈工作）。

---

## 3. 計畫指定檔案核對

| 檔案 | 狀態 |
|------|------|
| `CLAUDE.md` | ✅ |
| `package.json` | ✅（scripts: validate 用 prisma、test、lint、build） |
| `middleware.ts` | ✅（HQ／POS／公開路徑分流仍在） |
| `prisma/schema.prisma` | ✅（postgresql + `petBreed` 等） |
| `docs/SYSTEM_OVERVIEW.md` … `docs/CLAUDE_REVIEW_PLAN.md` | ✅ 交接包齊全 |

---

## 4. Baseline 結論

| 面向 | 判定 |
|------|------|
| Schema 健康 | ✅ validate 通過 |
| 型別健康 | ❌ 1 已知測試型別錯誤（產品） |
| 單元測試（無 DB） | ✅ 實質全綠；DB 整合 2 項環境取消 |
| Lint | ❌ 尚未配置／無法非互動執行 |
| DB | ❌ 本 agent 環境無可用 Postgres |
| 可否進入 Phase 1 | **可以**（Phase 1 安全項不依賴本機 DB；修改後仍應跑 `tsc` + 非 DB 測試） |

---

## 5. 進入 Phase 1 前注意

1. 先做 `npx prisma generate`（若剛 pull／merge）。  
2. 接受本機 `tsc` 在 flex-menu 測試仍紅，直到另 PR 修復。  
3. 不要在 Phase 1 PR 順便加 ESLint 初始設定（一次一問題）。  
4. Phase 1 第一刀依計畫：**強制 `AUTH_SECRET`**（`docs/SECURITY_AUDIT.md` C1）。

---

## 6. 回滾

本 Phase 僅新增本報告文件 → `git revert` 該 commit 即可；無業務邏輯變更。
