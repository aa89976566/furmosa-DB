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
| Phase | **4B-B CONSENSUS** — 明確 re-opt-in 偏好對話＋共用 HQ Preview（stacked on #97） |
| Canonical Cursor agent | https://cursor.com/agents/bc-20a8edae-6fd3-422d-b7fb-2be1d3702673 |
| Active branch | `cursor/line-morning-phase4b-b-consensus-2673` |
| Stack base | PR #97 head `2ecdfec`（`cursor/line-morning-phase4b-a-2673`） |

## PR stack

```
main
  └── #96  cursor/line-morning-mvp-2673          @ 446d648
        └── #97  cursor/line-morning-phase4b-a-2673  @ 2ecdfec
              └── (本階段) cursor/line-morning-phase4b-b-consensus-2673
```

| PR | Branch | Head SHA | Base | 角色 |
|----|--------|----------|------|------|
| [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | `cursor/line-morning-mvp-2673` | `446d648` | `main` | MVP + 安全框架 + Phase 3 QA |
| [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | `cursor/line-morning-phase4b-a-2673` | `2ecdfec` | #96 branch | Phase 4B-A domain contract |
| [#98](https://github.com/aa89976566/furmosa-DB/pull/98) | `cursor/line-morning-phase4b-b-optin` | `7e455da` | #97 | 舊 4B-B 嘗試（非 CONSENSUS；不改 head） |
| [#99](https://github.com/aa89976566/furmosa-DB/pull/99) | `cursor/line-birthday-parser-fix-2673` | `04e4eea` | #98 | 生日 parser；不改 head |

**硬規則**：不得改寫／force-push／merge／關閉 #96／#97／#98／#99；不 Production。

---

## Immutable decisions（CONSENSUS 4B-B）

| ID | 決策 | 狀態 |
|----|------|------|
| D-CONSENT-0 | 舊 `jokes`/`news`/`alternate`/`off`/`unset` 不自動改；alternate 顯示「沿用原設定：笑話／新聞交替」 | LOCKED |
| D-ENTRY-0 | 註冊完成／尾端／延遲訊息**禁止**偏好 CTA；只允許註冊心流外「早安設定」文字入口 | LOCKED |
| D-WRITE-0 | confirm 前 preference **0 writes**；僅 confirm 單交易寫入 | LOCKED |
| D-LEDGER-0 | **禁止**把 confirm 成功結果塞進可被新 flow 覆寫的 LineChatSession | LOCKED（CONSENSUS 修正） |
| D-LEDGER-1 | 最小 additive `LineMorningPreferenceConfirmLedger`：eventDedupKey／sessionNonceHash(只存 hash)／stepVersion／payloadDigest／preferenceSnapshot／successSummary／status=SUCCESS／expiresAt；unique(eventDedupKey)+unique(sessionNonceHash,payloadDigest)；pref upsert+ledger create 同交易；dedup **禁止**用 expiresAt/now 過濾；不存 raw replyToken／raw nonce／訊息正文；不可 in-memory | LOCKED |
| D-POSTBACK-0 | payload 只帶 nonce+step/version+allowlisted action；不信任 label/mode | LOCKED |
| D-SHARED-0 | options／actions／copy／summary 單一 shared domain；LINE+HQ 同 import | LOCKED |
| D-SEND-0 | broadcast/push = 0；同步 Reply 必要且不可沉默 | LOCKED |
| D-MIG-1 | 新 additive migration；舊 migration 不改；dry-run 證明 alternate/off/unset 不變 | LOCKED |
| D-STYLE-1 | 成熟 Bark×台灣語境；不用「小管家」 | LOCKED |

---

## Inventory（CONSENSUS 4B-B，動碼前）

### Topology（已核對）
- #96 head：`446d6481066b82df9396036545e2a2795d8567d7`
- #97 head：`2ecdfecf23c7579473341e72f7874df3dab92c7c`
- 新 branch base = #97；不碰 #96/#97/#98/#99

### 可重用
- `lib/line/morning/domain/**`（consent／decision／ANIMAL_FACT）
- `LineChatSession`（flow/step/payload JSON）→ draft nonce／version／expiresAt／confirm ledger
- `replyLineMessage` quickReply postback
- 文字入口 `parseMorningCommand`「早安設定」
- HQ `/campaigns/line-morning`
- DB `LineMorningPreference.contentMode` / `frequency`（已含 news_first_fact_* 相容值）

### 缺口
- confirm 前 0 writes + summary→confirm 狀態機
- CSPRNG nonce + step/version postback（不信任 mode）
- confirm ledger（eventKey+digest）跨 instance 冪等
- shared domain module + HQ Preview parity
- 註冊／bind 完成訊息移除偏好 CTA
- B=NEWS_ONLY 完整揭露（無 fallback）；E=OFF

### Migration（CONSENSUS 修正後）
- **需要**最小 additive：`LineMorningPreferenceConfirmLedger`（confirm 成功不可放 Session）。
- `LineChatSession` 僅短期 draft（nonce／version／expiresAt／choices）；confirm 後可清 session。
- 舊 migration 不改；不改 `line_morning_preferences` 既有列。

---

## Request Ledger

| ID | 時間 (UTC) | 來源 | 原始需求摘要 | 狀態 | Branch | Commit | PR | Tests | Preview |
|----|------------|------|--------------|------|--------|--------|-----|-------|---------|
| RL-HIST-96 | 2026-08-08 | Desktop／Cloud | Phase 1–3 Preview MVP | `VERIFIED` | `cursor/line-morning-mvp-2673` | `446d648` | [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | pass | Preview Ready |
| RL-HIST-97 | 2026-08-08 | Desktop／Cloud | Phase 4B-A domain | `VERIFIED` | `cursor/line-morning-phase4b-a-2673` | `2ecdfec` | [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | pass | Preview Ready |
| RL-HIST-98 | 2026-08-08 | Desktop／Cloud | 舊 4B-B opt-in（非 CONSENSUS） | `VERIFIED`（凍結） | `cursor/line-morning-phase4b-b-optin` | `7e455da` | [#98](https://github.com/aa89976566/furmosa-DB/pull/98) | pass | Preview Ready |
| RL-2026-08-08-4BB-CONSENSUS | 2026-08-08T21:40Z | Desktop（ChatGPT/Claude/Gemini CONSENSUS） | Phase 4B-B：re-opt-in＋HQ Preview；confirm 前 0 writes；**ConfirmLedger 表**（非 Session）；additive migration；無 register CTA／#98 提前寫入 | `IMPLEMENTED`（待 Preview Ready→VERIFIED） | `cursor/line-morning-phase4b-b-consensus-2673` | TBD | TBD | morning+LINE 163+；prisma validate/generate 0；schema diff 僅 CREATE ledger | TBD |

---

## Historical checkpoints

1. **#96 @ `446d648`** — MVP tables、dry-run runner、news gate、Admin。`vercel.json` 無 morning cron。
2. **#97 @ `2ecdfec`** — Phase 4B-A domain／decision／ANIMAL_FACT。
3. **#98** — 舊 opt-in UI（寫入時機／register CTA／in-memory nonce 不符 CONSENSUS）；head 凍結。
4. **本階段** — CONSENSUS 4B-B stacked on #97。
