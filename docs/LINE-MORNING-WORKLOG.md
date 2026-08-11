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
| Phase | **Brief-first follow-up** — MODE_BRIEF_SHOWN＋CONFIRM winner first content |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-brief-first-2673` |
| Stack base | PR #103 head `9946077` |
| Head | （本 PR） |
| Draft PR | （建立中） |
| Preview | （建立中） |

## PR stack

```
main → #96 → #97 → #100 → #101 → #102 @3b15f34 → #103 @9946077 → brief-first（本 PR）
```

**硬規則**：不得改寫／force-push／merge／關閉既有 PR（含 #103）。

---

## Preflight（本 PR）

| 檢查 | 結果 |
|------|------|
| flow step 儲存 | `LineChatSession.step` 為 **String**（非 Prisma enum）→ 可加 `brief` |
| MODE_SAMPLE | 保留 legacy read-only；讀到即清 pending |
| schema/enum migration | **不需要** → 繼續 |
| ConfirmLedger | `eventDedupKey` unique + `(sessionNonceHash,payloadDigest)` unique + tx |
| winner-only reply | 僅 `wrote===true` 後 composition；同 event retry → 200/no-op |
| final reply ≤5 | 目標 2 text objects |
| push/broadcast | 禁止；reply failure 無 fallback |

## Verification

| Check | Result |
|-------|--------|
| morning+LINE | （跑測中） |
| schema diff vs #103 | **必須 0** |
| prisma validate/generate | （待） |
| next build（無 migrate deploy） | （待） |
| tsc | **0 new**（baseline 3） |
| Frozen #96–#103 | 不變 |

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-102 | 2026-08-11 | Cloud | 4B-D Dashboard | `VERIFIED` | `…-d-dashboard-2673` | `3b15f34` | [#102](https://github.com/aa89976566/furmosa-DB/pull/102) | 197 | Ready |
| RL-2026-08-11-SAMPLE | 2026-08-11T00:49Z | Desktop CONSENSUS | sample-first 雙選項＋活動中心 | `VERIFIED` | `cursor/line-morning-sample-first-2673` | `5ac5943`／`9946077` | [#103](https://github.com/aa89976566/furmosa-DB/pull/103) | 203 | [Ready](https://furmosa-db-git-cursor-line-morning-0e30a0-aa89976566s-projects.vercel.app) |
| RL-2026-08-11-BRIEF | 2026-08-11T01:20Z | Desktop CONSENSUS | brief-first＋winner first content | `PLANNED` | `cursor/line-morning-brief-first-2673` | — | — | — | — |
