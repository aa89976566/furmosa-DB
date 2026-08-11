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
| Stack base | PR #101 head `6213fdd`（`cursor/line-morning-phase4b-c-plan-2673`） |

## PR stack

```
main
  └── #96  @ 446d648
        └── #97  @ 2ecdfec
              └── #100 @ a60ad1a  (4B-B ConfirmLedger)
                    └── #101 @ 6213fdd  (4B-C plan runner)
                          └── (本階段) cursor/line-morning-phase4b-d-dashboard-2673
```

| PR | Branch | Head | 角色 |
|----|--------|------|------|
| [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | mvp | `446d648` | MVP |
| [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | 4B-A | `2ecdfec` | domain/decision |
| [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 4B-B consensus | `a60ad1a` | opt-in + ConfirmLedger |
| [#101](https://github.com/aa89976566/furmosa-DB/pull/101) | 4B-C plan | `6213fdd` | plan runner + copy minimize |
| [#99](https://github.com/aa89976566/furmosa-DB/pull/99) | birthday | `04e4eea` | 凍結；不改 |

**硬規則**：不得改寫／force-push／merge／關閉 #96／#97／#99／#100／#101。

---

## Inventory（4B-D 動碼前）

### Topology
- #101 base=#100 `a60ad1a`；head=`6213fdd` Draft OPEN — OK
- 新 branch base = #101 head；schema diff 必須 0

### Before capability inventory（必須全部可達）
| ID | 能力 | 入口 |
|----|------|------|
| C-PLAN | 產生今日 plan preview（零發送） | `generateMorningPlanPreviewAction` |
| C-MASTER | 總開關 on/off | `setMorningMasterEnabledAction` |
| C-QUOTA | 更新每日配額 | `setMorningDailyQuotaAction` |
| C-FIX-LOAD | 載入草稿範例 | `ensureMorningFixturesAction` |
| C-FIX-REFRESH | Preview 刷新新聞閘門 | `refreshMorningNewsPreviewAction` |
| C-CONTENT | 核准／回草稿／封存 | `updateMorningContentStatusAction` |
| C-OPTIN-RO | 共用 Opt-in Preview（唯讀、不寫 preference） | `buildMorningOptinPreview` |
| C-SOURCE | 來源健康／live enabled=0 | registry 顯示 |
| C-TX | 交易覆蓋說明 | `TRANSACTIONAL_COVERAGE_NOTES` |
| C-NEWS | 已寫入新聞列 | prisma list |
| C-GATE | Fixture 閘門即時預覽 | mock provider |
| C-LOGS | delivery／plan 結果 | listRecentDeliveries / plan preview |
| C-AUTH | admin+staff only | `getCurrentUser` + actions |

### 本 PR 邊界
- 只做 presentation／view-model／UX wrapper／copy／tests／docs
- 禁止改 decision runner、plan ledger、schema/migration、opt-in state machine、confirm ledger、sender、cron、webhook、其他模組

---

## Immutable decisions（4B-D）

| ID | 決策 | 狀態 |
|----|------|------|
| D-IA-TABS | 同路由 `?tab=`：today／content／preferences／system；非法→today | LOCKED |
| D-PRES-ONLY | schema diff vs #101 = 0；business/auth 不變 | LOCKED |
| D-OPTIN-RO |「早安設定」Preview 本來唯讀；不得誤認成被移除的客服寫入 | LOCKED |
| D-CONFIRM-UX | 總開關／fixture refresh 二次確認 modal；取消 0 writes；server 仍最終防線 | LOCKED |

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-100 | 2026-08-08 | Cloud | 4B-B CONSENSUS | `VERIFIED` | `…-b-consensus-2673` | `a60ad1a` | [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 163+ | Ready |
| RL-HIST-101 | 2026-08-10 | Cloud | 4B-C CONSENSUS | `VERIFIED` | `…-c-plan-2673` | `6213fdd` | [#101](https://github.com/aa89976566/furmosa-DB/pull/101) | 177 | Ready |
| RL-2026-08-11-4BD | 2026-08-11T00:25Z | Desktop（ChatGPT/Claude/Gemini CONSENSUS） | 4B-D：HQ Dashboard IA 精簡（四區 tab、async plan UX、確認 modal） | `PLANNED` | `cursor/line-morning-phase4b-d-dashboard-2673` | — | TBD | — | — |
