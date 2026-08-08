# 壽司匠早安 — 威脅模型與 Runbook（Preview）

## 資產

- LINE 用戶信任與商譽
- 伺服器 outbound 能力（SSRF 風險）
- HQ admin session
- 資料庫中的短摘要／URL 中繼資料（不存全文）

## 威脅與緩解

| 威脅 | 緩解 |
|------|------|
| SSRF（內網／metadata IP） | https only、host allowlist、DNS 解析後擋 private/link-local/reserved、redirect≤2 每次重驗證 |
| XXE／Billion laughs | 禁 DOCTYPE／ENTITY；深度／節點／文字上限；不使用展開 entity 的 DOM |
| 惡意 MIME／超大 body | Content-Type allowlist；1 MiB 上限 |
| 授權誤用 | registry `enabled=false` 預設；live 前雙檢 |
| 高風險內容進晨報 | 硬規則＋source trust＋classifier（僅更嚴）；不確定 fail-closed |
| LLM 當唯一門 | 本階段無付費 LLM；classifier 為規則型 |
| 重放／重複 | SHA-256 `contentHash` unique；delivery unique(lineUserId,campaign,date) |
| Kill switch 反向 | `masterEnabled` 預設 false；執行前＋寫入前讀取 |
| Log 洩漏 | 錯誤只回 reason code；不記完整 feed／token／LINE userId／PII |

## Kill switch

- DB：`LineMorningSettings.masterEnabled` 預設 `false`
- Env：`LINE_MORNING_MASTER_ENABLED` 可強制 true/false
- Preview dry-run 不真送；`vercel.json` **無** morning cron

## Rollback

1. 關閉 `masterEnabled`
2. 回滾 migration：`20260808080000_line_morning_news_metadata`（DROP 新欄位／`line_morning_ingest_runs`）
3. 必要時 DROP `20260808060000_line_morning_mvp` 五表（不影響既有業務表）

## Runbook：Preview 刷新

1. HQ 登入 `/campaigns/line-morning`（admin/staff）
2. 確認來源 live enabled = 0
3. 「Preview 刷新新聞閘門」→ fixture ingest
4. 查看 passed／blocked／dup／stale；無候選顯示「今天沒有通過安全檢查的新鮮事」
5. **禁止**對真實 LINE 用戶發送
