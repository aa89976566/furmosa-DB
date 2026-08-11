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
| Phase | **4B-D CONSENSUS** — HQ Dashboard 資訊架構精簡（presentation only） |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-phase4b-d-dashboard-2673` |
| Stack base | PR #101 head `6213fdd` |
| Head | `dbf9e57` |
| Draft PR | [#102](https://github.com/aa89976566/furmosa-DB/pull/102) |
| Preview | https://furmosa-db-git-cursor-line-morning-85dcf0-aa89976566s-projects.vercel.app |
| HQ path | `/campaigns/line-morning`（`?tab=today|content|preferences|system`） |

## PR stack

```
main
  └── #96  @ 446d648
        └── #97  @ 2ecdfec
              └── #100 @ a60ad1a
                    └── #101 @ 6213fdd  (4B-C plan runner)
                          └── #102 @ dbf9e57  (4B-D dashboard IA；本階段)
```

| PR | Branch | Head | 角色 |
|----|--------|------|------|
| [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | mvp | `446d648` | MVP |
| [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | 4B-A | `2ecdfec` | domain/decision |
| [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 4B-B consensus | `a60ad1a` | opt-in + ConfirmLedger |
| [#101](https://github.com/aa89976566/furmosa-DB/pull/101) | 4B-C plan | `6213fdd` | plan runner |
| [#102](https://github.com/aa89976566/furmosa-DB/pull/102) | 4B-D dashboard | `dbf9e57` | HQ IA tabs + plan UX |
| [#99](https://github.com/aa89976566/furmosa-DB/pull/99) | birthday | `04e4eea` | 凍結；不改 |

**硬規則**：不得改寫／force-push／merge／關閉 #96／#97／#99／#100／#101。

---

## Capability inventory（before = after 可達）

| ID | 能力 | 入口 |
|----|------|------|
| C-PLAN | 產生今日 plan preview | `generateMorningPlanPreviewAction` |
| C-PLAN-UX | Plan UX wrapper（同業務） | `generateMorningPlanPreviewUxAction` |
| C-MASTER | 總開關（二次確認） | `setMorningMasterEnabledAction` |
| C-QUOTA | 配額 | `setMorningDailyQuotaAction` |
| C-FIX-LOAD | 載入草稿範例 | `ensureMorningFixturesAction` |
| C-FIX-REFRESH | fixture refresh（二次確認） | `refreshMorningNewsPreviewAction` |
| C-CONTENT | 核准／回草稿／封存 | `updateMorningContentStatusAction` |
| C-OPTIN-RO | Opt-in Preview 唯讀 | `buildMorningOptinPreview` |
| C-SOURCE / C-TX / C-NEWS / C-GATE / C-LOGS | 系統 details | 系統狀態 tab |

## Verification（4B-D）

| Check | Result |
|-------|--------|
| morning+LINE | **197 pass / 0 fail** |
| HQ tab／capability／plan UX／a11y／schema=0 | pass |
| prisma validate/generate | ok |
| schema diff vs #101 | **0** |
| next build（無 migrate deploy） | ok |
| tsc | **0 new**（baseline 3 unrelated） |
| Vercel Preview | Ready |
| Frozen #96/#97/#100/#101 | `446d648` / `2ecdfec` / `a60ad1a` / `6213fdd` |
| push/broadcast／morning cron | 0 |

### Next PR 邊界
- 真實 sender／cron／live news
- Dashboard 視覺品牌大改（非本 PR）
- Production migrate／deploy／merge

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-100 | 2026-08-08 | Cloud | 4B-B CONSENSUS | `VERIFIED` | `…-b-consensus-2673` | `a60ad1a` | [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 163+ | Ready |
| RL-HIST-101 | 2026-08-10 | Cloud | 4B-C CONSENSUS | `VERIFIED` | `…-c-plan-2673` | `6213fdd` | [#101](https://github.com/aa89976566/furmosa-DB/pull/101) | 177 | Ready |
| RL-2026-08-11-4BD | 2026-08-11T00:25Z | Desktop（ChatGPT/Claude/Gemini CONSENSUS） | 4B-D：HQ Dashboard IA 精簡 | `VERIFIED` | `cursor/line-morning-phase4b-d-dashboard-2673` | `dbf9e57` | [#102](https://github.com/aa89976566/furmosa-DB/pull/102) | 197 pass | [Ready](https://furmosa-db-git-cursor-line-morning-85dcf0-aa89976566s-projects.vercel.app) |
