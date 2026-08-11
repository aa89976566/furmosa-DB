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
| Stack base | PR #102 head `3b15f34`（`cursor/line-morning-phase4b-d-dashboard-2673`） |

## PR stack

```
main → #96 → #97 → #100 → #101 → #102 @3b15f34 → (本階段) sample-first
```

**硬規則**：不得改寫／force-push／merge／關閉既有 PR。schema diff = 0。

---

## Phase 0 Inventory（熔斷檢查）

| 檢查 | 結果 |
|------|------|
| Working tree | clean @ `3b15f34` |
| Latest stack | #102 Dashboard |
| HUMOR_ONLY / NEWS_ONLY / ALTERNATE / NEWS_FIRST_* / OFF | domain+storage 皆存在；不新增 enum |
| Legacy display mapping | `CONTENT_MODE_LABELS` + `OPTIN_CONTENT_OPTIONS` + `toDomainContentMode` |
| Consent | 既有 `LineMorningPreferenceConfirmLedger`；沿用 |
| Master switch | `LineMorningSettings.masterEnabled` + env |
| 活動中心 | **在 repo**：`buildEventsCenterMessages`／`events_center`／`chaos_events` |
| Schema migration 需求 | **否**（pending 用既有 LineChatSession draft JSON） |

熔斷：**未觸發** → 繼續實作。

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|------|------|--------|--------|-----|-------|---------|
| RL-HIST-102 | 2026-08-11 | Cloud | 4B-D Dashboard | `VERIFIED` | `…-d-dashboard-2673` | `3b15f34` | [#102](https://github.com/aa89976566/furmosa-DB/pull/102) | 197 | Ready |
| RL-2026-08-11-SAMPLE | 2026-08-11T00:49Z | Desktop（ChatGPT/Claude/Gemini CONSENSUS） | sample-first 雙選項＋活動中心單一入口 | `PLANNED` | `cursor/line-morning-sample-first-2673` | — | TBD | — | — |
