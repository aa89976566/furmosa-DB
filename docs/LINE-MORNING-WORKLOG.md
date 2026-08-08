# 壽司匠早安 — Canonical Worklog

> **單一 canonical 工作紀錄**。手機 Remote／Desktop／Codex relay 指令若未寫入本檔 Request Ledger 並 commit，一律視為尚未執行。  
> 產品規格細節仍見：`LINE-MORNING-MVP.md`、`LINE-MORNING-STYLE.md`、`LINE-MORNING-SOURCES.md`、`LINE-MORNING-THREAT-MODEL.md`。本檔不重複寫規格長文。

## 執行契約（Remote／AI）

1. **動碼前**：先在下方 Request Ledger 新增一筆（至少：時間、來源、摘要、狀態=`RECEIVED`）。
2. **規劃後**：更新為 `PLANNED`，註明 branch／預計改動邊界。
3. **每完成一段**：更新狀態、`commit`、tests、Preview URL（若有）；狀態推進至 `IMPLEMENTED`／`VERIFIED`／`BLOCKED`。
4. **禁止**：未入 ledger 就改功能碼；跳過 ledger 更新；把手機口述當成已執行。
5. **安全硬限制**：不真送 LINE、不加 Production cron、不 live fetch、不 merge、不碰 Production secret／migrate／deploy，除非人類明確授權。

---

## Current phase

| 欄位 | 值 |
|------|-----|
| Phase | **4B-B** — 明確 opt-in UI + HQ dry-run 驗證（進行中） |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-phase4b-b-optin` |
| Stack base | PR #97 head `2ecdfec`（`cursor/line-morning-phase4b-a-2673`） |

## PR stack

```
main
  └── #96  cursor/line-morning-mvp-2673          @ 446d648  (Preview MVP + Phase 3 QA)
        └── #97  cursor/line-morning-phase4b-a-2673  @ 2ecdfec  (Phase 4B-A domain/consent/decision)
              └── (本階段) cursor/line-morning-phase4b-b-optin  (Phase 4B-B opt-in UI；Draft PR TBD)
```

| PR | Branch | Head SHA | Base | 角色 |
|----|--------|----------|------|------|
| [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | `cursor/line-morning-mvp-2673` | `446d648` | `main` | MVP + 安全框架 + Phase 3 QA |
| [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | `cursor/line-morning-phase4b-a-2673` | `2ecdfec` | #96 branch | Phase 4B-A domain contract |
| TBD | `cursor/line-morning-phase4b-b-optin` | `2d1ace6`+ | #97 branch | Phase 4B-B opt-in |

**硬規則**：不得改寫 #96／#97 head；不 merge；不 Production。

---

## Immutable decisions

| ID | 決策 | 狀態 |
|----|------|------|
| D-CONSENT-0 | **零擴張 consent**：舊 `jokes`/`news`/`alternate`/`off`/`unset` 不得推定為 FACT mixed；不得自動升級 | LOCKED |
| D-CONSENT-1 | `jokes→HUMOR_ONLY`、`news→NEWS_ONLY` 僅語意相等映射 | LOCKED（4B-A） |
| D-CONSENT-2 | `alternate` 維持笑話↔新聞；**無** ANIMAL_FACT fallback | LOCKED |
| D-CONSENT-3 | `off`/`unset` = 不活躍；不得推定同意 | LOCKED |
| D-CONSENT-4 | FACT mixed modes 僅明確 re-opt-in（本階段 UI 才提供選擇） | LOCKED |
| D-STYLE-1 | 成熟 **Bark × 台灣語境**；不幼稚；不小管家／小編口吻 | LOCKED |
| D-FACT-1 | ANIMAL_FACT **不是新聞**；必須含固定揭露句；禁止新聞口吻 | LOCKED |
| D-SEND-0 | Preview／dry-run：`pushLineMessages` call count = **0**；不加 morning cron | LOCKED |
| D-TX-0 | 退訂／先不用早安 **不影響** 交易通知 | LOCKED |

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 原始需求摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|--------------|------|--------|--------|-----|-------|---------|
| RL-2026-08-08-RISK-MOBILE | 2026-08-07～08（回溯） | Mobile Remote／追蹤缺口 | 手機 Remote 指示可能未進入電腦 Cursor 對話 → **無程式／無 commit／無紀錄風險**。緩解：本 worklog + AGENTS 最小補充；未入 ledger+commit 視為未執行 | `VERIFIED`（機制建立中→見 RL-2026-08-08-4BB-AUTH） | — | — | — | — | — |
| RL-2026-08-08-4BB-AUTH | 2026-08-08T12:36Z | Desktop（使用者授權） | 授權開始 Phase 4B-B；先完成永久留痕（worklog）與安全 stacked branch，再做明確 opt-in UI + HQ dry-run；LINE 真送必須 0 | `IMPLEMENTED` | `cursor/line-morning-phase4b-b-optin` | `2d1ace6`+feature | TBD | morning+LINE 151 pass | Preview pending |
| RL-HIST-96 | 2026-08-08（historical） | Desktop／Cloud Agent | Phase 1–3：Preview MVP、新聞安全框架、Phase 3 QA（手機卡片／繁中標籤／region） | `VERIFIED` | `cursor/line-morning-mvp-2673` | `446d648` | [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | morning+LINE pass（當時） | Preview Ready（#96） |
| RL-HIST-97 | 2026-08-08（historical） | Desktop／Cloud Agent | Phase 4B-A：domain／零擴張 consent／decision／ANIMAL_FACT renderer；無 UI 擴張 | `VERIFIED` | `cursor/line-morning-phase4b-a-2673` | `2ecdfec` | [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | domain+morning 65 pass；build 0；Vercel SUCCESS | https://furmosa-db-git-cursor-line-morning-247c4b-aa89976566s-projects.vercel.app |

---

## Historical checkpoints

1. **#96 @ `446d648`** — MVP tables、dry-run runner、news gate/fixtures、Admin `/campaigns/line-morning`、Phase 3 QA。`vercel.json` 無 morning cron。
2. **#97 @ `2ecdfec`** — Migration `20260808120000_line_morning_phase4b_a_domain`；`lib/line/morning/domain/**`；decision engine；ANIMAL_FACT disclosure。最終校對：prisma validate/generate 0；`npm run build` 0；#96 SHA 未變。
3. **本 docs checkpoint** — 建立本 worklog + AGENTS Request Ledger 規則；branch `cursor/line-morning-phase4b-b-optin` 自 #97 分出。**尚無功能碼。**

---

## UI／flow inventory（4B-B，只讀盤點）

### 可重用
- Domain consent／decision／ANIMAL_FACT renderer／dry-run runner／idempotent delivery（4B-A）
- `preference-flow`／`commands`／`copy`／`morning_prefs` session；註冊後非阻擋啟動
- HQ `/campaigns/line-morning`（開關、笑話 DRAFT、新聞 fixture、delivery 列表）
- `LINE_REGISTER_INTRO` 壽司匠開場；裸「停止」澄清不關交易通知

### 缺口
- 對話仍為舊 4 選（含「兩種交替」）；無 FACT mixed 指令／文案／labels
- 無 morning quick-reply／postback（可沿用 `reply.ts` quickReply）
- HQ 無「測試會員＋contentMode＋Taipei date」單筆 dry-run 面板
- 無 ANIMAL_FACT fixture／APPROVED admin 入口（僅有表＋picker）
- `pushLineMessages` 無 DI／call-count 閘門（僅靠 runner 不呼叫）

### Wire-level（目標）
1. 註冊 → intro → 5 選提示（不預選 mixed；未選保持 UNSET）  
2. 「早安設定」→ 同 5 選；舊 alternate 不自動升級  
3. Storage：`jokes`／`news`／`news_first_fact_fallback`／`news_first_fact_or_humor_fallback`／`off`  
4. 先不用 → content+frequency OFF；交易通知不變  
5. HQ dry-run：只 Preview DB；顯示 contentType 或 SKIP reason／來源／揭露句／renderer／idempotency

## Current checkpoint

- [x] 盤點：無既有 worklog／ADR／roadmap；重用 `AGENTS.md` + `docs/LINE-MORNING-*.md`
- [x] Canonical worklog 建立
- [x] AGENTS 最小相容補充（Request Ledger）
- [x] Stacked branch `cursor/line-morning-phase4b-b-optin` ← #97 `2ecdfec`
- [x] Phase 4B-B UI/flow inventory
- [x] Opt-in 對話選項（5 選）+ 不預設 mixed + signed postback
- [x] HQ Preview dry-run UI（U_TEST_* 標記；非測試不寫 preference）
- [x] ANIMAL_FACT Preview fixture 入口
- [x] sender-gate call count = 0
- [ ] Draft PR + Vercel Preview Ready → Ledger `VERIFIED`

## Next action

1. 開 stacked Draft PR（base = #97 branch）  
2. 等 Preview Ready，回填 URL／狀態 `VERIFIED`

## Blockers

- 無。Mobile Remote 未入 Ledger 者不執行。

## Known debt

| 項目 | 說明 |
|------|------|
| `tsc --noEmit` 既有失敗 | `jiba-two-piece`、`flex-menu`、`admin-labels-fixtures` 測試型別問題（#96 既有；非 4B-A／4B-B 引入） |
| Phase 4A 來源 | 0 Taiwan／0 Global ACCEPT（免費＋授權＋輕鬆寵物新聞）；live adapter 仍停 |
| 舊 `alternate` 無 FACT | 有意為之（D-CONSENT-2）；需新選項才進 FACT mixed |
| 本機 migrate deploy | Cloud agent 本機 DB 可能未起；以 Vercel Preview migrate／build 為準 |
| Mobile Remote 可見性 | 已用 Ledger 緩解；Desktop 對話不會自動收到未同步的手機指示 |
