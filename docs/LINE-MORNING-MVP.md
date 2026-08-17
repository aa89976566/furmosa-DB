# 壽司匠早安 LINE Morning MVP（14-day Preview）

獨立功能：早安 opt-in 短訊。不與飼料 `Subscription`、UGC `Campaign` 混用。

## 決策摘要

| 項目 | 決策 |
|------|------|
| preferred name | 復用 `Customer.name`；有名字不重問 |
| Admin | `/campaigns/line-morning`（HQ session／admin+staff） |
| Delivery | 專用表；`@@unique(lineUserId, campaignKey, taipeiDate)` |
| Cron | 僅 dry-run API；**未**加入 `vercel.json`；不真送 |
| Kill switch | DB `LineMorningSettings.masterEnabled` 預設 `false` |
| 新聞 | Provider + registry（enabled=false）+ SSRF／XXE 框架 + fixture；**不串 live** |

## 重用既有元件

- Webhook：`lib/line/handle-event.ts`、`parse-message`、`postback`
- Identity：`Customer.lineUserId`／`name`、`bind-customer`、`register-from-chat`
- Sender：`pushLineMessages`（MVP 不呼叫真送）、`replyLineMessage`
- State：`LineChatSession`（新增 flow `morning_prefs`）
- Scheduler 骨架：`authorizeCronRequest`、`taipeiDateInput`／`taipeiWeekdayIndex`
- Admin：HQ cookie session、`getCurrentUser` role 檢查

## Schema（additive）

Migration：`prisma/migrations/20260808060000_line_morning_mvp`

- `LineMorningPreference` — contentMode／frequency／pausedAt
- `LineMorningContent` — DRAFT／APPROVED／ARCHIVED 笑話庫
- `LineMorningNewsItem` — 新聞＋安全狀態
- `LineMorningDelivery` — exactly-once + skip reason
- `LineMorningSettings` — master kill switch + dailyQuota

回滾：DROP 上述五表（不碰既有欄位／seed）。

## 對話行為

1. 開戶暱稱步驟改為壽司匠固定開場（`LINE_REGISTER_INTRO`）。
2. 開戶完成後恢復原 intent（如 `enter_code`），並非阻擋地進入內容→頻率偏好。
3. 已註冊會員不重問名字；可用「早安設定」更改。
4. 裸「停止」只澄清，**絕不會**關閉交易通知。

## 發送規則（dry-run 驗證）

- 時區 Asia/Taipei；窗 08:00–08:29；`hash(lineUserId) % 30` 分散。
- 頻率：每天／平日／每週（週五）／先不用。
- 交易優先：見 `TRANSACTIONAL_COVERAGE_NOTES`（預約時間戳已覆蓋；換罐／開箱／出貨尚無通用已送戳）。
- 只送 APPROVED 笑話或 AUTO_APPROVED 新聞；耗盡 skip。
- DRAFT／ARCHIVED／BLOCKED／REVIEW_REQUIRED 永不發。

## Preview 驗證步驟

1. HQ 登入 → `/campaigns/line-morning`
2. 「載入 DRAFT 範例」→ 核准至少一則（或保持 DRAFT 測 skip）
3. 手動 upsert 一筆 `LineMorningPreference`（測試帳）
4. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$URL/api/cron/line-morning-dry-run"`
5. 後台查看 delivery／skip reason；再打一次確認不重複（unique）
6. 確認 `vercel.json` **沒有** morning cron；總開關保持 OFF

## 真實來源 Preview（本階段）

- 文件：`LINE-MORNING-SOURCES.md`、`LINE-MORNING-THREAT-MODEL.md`、`LINE-MORNING-STYLE.md`
- Migration：`20260808080000_line_morning_news_metadata`（additive）
- 純 `news` 偏好無安全新聞 → skip（`no_safe_news`）；僅 `alternate` 可退回核准笑話
- Admin：「Preview 刷新新聞閘門」跑 fixture ingest（需 HQ auth）

## 禁止事項

- Production deploy／merge（由人類決定）
- 對真實 LINE 用戶廣播或測試發送
- 覆寫既有 seed／把 DRAFT fixtures 預設核准
- HTML scraping、付費 LLM、Production secret 做抓取
- 未授權來源 `enabled=true` 或實際網路存取
