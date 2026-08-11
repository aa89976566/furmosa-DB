# 壽司匠早安 — Canonical Worklog

> **單一 canonical 工作紀錄**。手機 Remote／Desktop／Codex relay 指令若未寫入本檔 Request Ledger 並 commit，一律視為尚未執行。

## 執行契約（Remote／AI）

1. **動碼前**：先在下方 Request Ledger 新增一筆（至少：時間、來源、摘要、狀態=`RECEIVED`）。
2. **規劃後**：更新為 `PLANNED`，註明 branch／預計改動邊界。
3. **每完成一段**：更新狀態、`commit`、tests、Preview URL（若有）。
4. **禁止**：未入 ledger 就改功能碼；跳過 ledger 更新。
5. **安全硬限制**：不真送 LINE、不加 Production cron、不 live fetch、不 merge、不碰 Production secret／migrate／deploy，除非人類明確授權。

---

## Current phase

| 欄位 | 值 |
|------|-----|
| Phase | **Sample-first CONSENSUS** — 雙選項 sample flow＋活動中心單一入口 |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-sample-first-2673` |
| Stack base | PR #102 head `3b15f34` |
| Head | `5ac5943`＋worklog |
| Draft PR | [#103](https://github.com/aa89976566/furmosa-DB/pull/103) |
| Preview | https://furmosa-db-git-cursor-line-morning-0e30a0-aa89976566s-projects.vercel.app |

## PR stack

```
main → #96 → #97 → #100 → #101 → #102 @3b15f34 → #103 @5ac5943
```

**硬規則**：不得改寫／force-push／merge／關閉既有 PR。

---

## Phase 0 Inventory（通過）

| 檢查 | 結果 |
|------|------|
| HUMOR_ONLY／NEWS_ONLY／ALTERNATE／NEWS_FIRST_*／OFF | 存在；不新增 enum |
| Legacy mapping | `CONTENT_MODE_LABELS` + full `OPTIN_CONTENT_OPTIONS` |
| Consent | 既有 ConfirmLedger |
| Master switch | 既有 |
| 活動中心 | repo 內 `buildEventsCenterMessages` |
| Schema migration | **不需要**（pending 用 session draft） |

## Verification

| Check | Result |
|-------|--------|
| morning+LINE | **203 pass** |
| schema diff vs #102 | **0** |
| prisma validate/generate | ok |
| next build（無 migrate deploy） | ok |
| tsc | **0 new**（baseline 3） |
| Vercel Preview | Ready |
| push/broadcast／cron | 無 |
| Frozen #96–#102 | 不變 |

### 新聞來源核對（NEWS sample）
- 7 座寵物公園
- 2009 年起陸續設置
- 2023 年全面增設洗腳池
- URL：ntpc.gov.tw dataserno=579176ca4ae665a9a8553ccf68864cb8

### Next
- 真送／cron／live 新聞另 PR
- Preview 手測：兩 sample、切換、取消、三頻率、legacy、活動中心

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-102 | 2026-08-11 | Cloud | 4B-D Dashboard | `VERIFIED` | `…-d-dashboard-2673` | `3b15f34` | [#102](https://github.com/aa89976566/furmosa-DB/pull/102) | 197 | Ready |
| RL-2026-08-11-SAMPLE | 2026-08-11T00:49Z | Desktop CONSENSUS | sample-first 雙選項＋活動中心 | `VERIFIED` | `cursor/line-morning-sample-first-2673` | `5ac5943` | [#103](https://github.com/aa89976566/furmosa-DB/pull/103) | 203 | [Ready](https://furmosa-db-git-cursor-line-morning-0e30a0-aa89976566s-projects.vercel.app) |
