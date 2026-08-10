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
| Phase | **4B-C CONSENSUS** — 每日 plan runner（結構零發送）＋會員文案最小化 |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-phase4b-c-plan-2673` |
| Stack base | PR #100 head `a60ad1a`（`cursor/line-morning-phase4b-b-consensus-2673`） |

## PR stack

```
main
  └── #96  @ 446d648
        └── #97  @ 2ecdfec
              └── #100 @ a60ad1a  (4B-B CONSENSUS ConfirmLedger)
                    └── (本階段) cursor/line-morning-phase4b-c-plan-2673
```

| PR | Branch | Head | 角色 |
|----|--------|------|------|
| [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | mvp | `446d648` | MVP |
| [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | 4B-A | `2ecdfec` | domain/decision |
| [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 4B-B consensus | `a60ad1a` | opt-in + ConfirmLedger |
| [#99](https://github.com/aa89976566/furmosa-DB/pull/99) | birthday | `04e4eea` | 凍結；不改 |

**硬規則**：不得改寫／force-push／merge／關閉 #96／#97／#99／#100。

---

## Inventory（4B-C 動碼前）

### Topology
- #100 base=#97 `2ecdfec`；head=`a60ad1a` Draft OPEN — OK
- 新 branch base = #100 head

### 可重用
- `decideMorningContent`／consent／optin／ConfirmLedger／schedule／transactional providers
- HQ `/campaigns/line-morning` + `getCurrentUser` admin/staff
- `morningTaipeiDate`／`frequencyMatchesDay`／`taipeiDateInput`

### 缺口 → 本 PR
- 獨立 plan ledger（`@@unique([runDate,lineUserId])`）；不可用 Delivery 當 plan（含正文）
- 結構零發送 daily plan runner（不 import sender）
- ALTERNATE：4B-A 日期奇偶＋NEWS→HUMOR fallback **與 4B-C CONSENSUS 衝突** → 本 PR 在同一 decision module 演進為 last-SUCCESS／NEWS 缺則 SKIP（見 D-ALT-4BC）
- 會員文案最小化（shared optin copy only）
- HQ 只讀今日 plan 驗收＋LINE id 遮罩

### Migration
- additive `LineMorningPlanLedger` only

---

## Immutable decisions（4B-C）

| ID | 決策 | 狀態 |
|----|------|------|
| D-ALT-4BC | ALTERNATE：下一類＝上一筆 **SENT** morning delivery contentType；無歷史→HUMOR；NEWS 缺→SKIP 且不暗換笑話；PLANNED/SKIPPED/dry-run 不推進 | LOCKED（取代日期奇偶） |
| D-PLAN-0 | `@@unique([runDate,lineUserId])`；transaction/P2002；無正文／姓名／token | LOCKED |
| D-SEND-STRUCT | plan runner/Preview **結構上**不可達 sender；無 isDryRun=false；不加 cron | LOCKED |
| D-COPY-MIN | 只改 shared optin consumer copy；狀態機／confirm／nonce 不動 | LOCKED |

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-100 | 2026-08-08 | Cloud | 4B-B CONSENSUS | `VERIFIED` | `…-b-consensus-2673` | `a60ad1a` | [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | 163+ | Ready |
| RL-2026-08-10-4BC | 2026-08-10T09:37Z | Desktop（ChatGPT/Claude/Gemini CONSENSUS） | 4B-C：每日 plan runner（結構零發送）＋plan ledger＋文案最小化＋HQ 只讀驗收 | `PLANNED` | `cursor/line-morning-phase4b-c-plan-2673` | — | TBD | — | — |
