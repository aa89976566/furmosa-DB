# Zoho 品牌接洽

## 範圍與授權

使用者已於 2026-09-07 核准新增 `outreach_contacts`、`outreach_messages` 及測試後正式上線。既有訂單、庫存、會員、金流及 HQ/POS 驗證程式不變。

`/outreach` 使用既有 HQ 登入，另外查核資料庫中的 admin 身分。管理員提供已判定 DO 的品牌、官方公開聯絡來源及完成的英文開發信。重複 domain/email 不更新原紀錄，也不解除停止狀態。現階段沒有 ChatGPT 排程自動匯入入口，不應把後端啟用描述成每日總控台已完成串接。

## 寄送與停止規則

- 僅限 EU Zoho `support@furmosa.com`，以 `mailboxAddress` 核對寄件身分。登入主信箱為 Gmail 不影響公司 mailbox 的判定。
- 先搜尋品牌網域、收件地址及追蹤標記；任何既有往來會交由人工核對。這比原排程的 14 天冷卻更保守。
- 每個品牌只允許 sequence 1、2。PostgreSQL transaction advisory lock 保護去重及每日上限；SENDING 先持久化，寄出或寫入結果不明時不自動重試。
- 初次與追信各自每日最多 5 封，以 Europe/Madrid 日期計算。追信必須經過 5 個週一至週五，保持当地時間，未扣國定假日。
- 收到相關回覆（包含自動回覆）即停止追信。人工停止會保持，即使寄送程序稍後才回寫結果。發信前最後一次查核後仍可能出現極短的回覆到達競態；無法以跨服務交易完全消除此窗口。
- 回覆整理是原文關鍵欄位摘錄，未使用生成模型猜測報價。引文可能含舊信，需核對完整 Zoho 往來。完整內文只在伺服器暫存，DB 只留業務摘要與郵件 ID。
- Supabase 兩張新表啟用 RLS 且不設公開 policy，前端不可透過匿名 REST 讀取。

## 上線順序

1. 保持 `OUTREACH_SEND_ENABLED`、`OUTREACH_WORKER_ENABLED` 未設定或 `false`。
2. 確認最新 main 的 CI、正式 DB 連線及既有部署健康。不得為通過部署移除 readiness DB 檢查。
3. 核對 migration history，只套用 `20260907170000_add_outreach`。如發現其他 pending/failed migration，先釐清，不批次套用未核准的其他變更。
4. 合併通過檢查的版本，等待 Railway 部署成功。
5. 在 Railway Console 執行 `node --experimental-strip-types scripts/outreach-check.mjs --send-test`。它只寄送公司信箱自寄測試及一次測試回覆，並檢查新表、RLS、Mailbox 與寄送搜尋。不輸出 secrets，也不建立正式示範品牌。
6. 將 Railway production 的 `OUTREACH_SEND_ENABLED=true`、`OUTREACH_WORKER_ENABLED=true` 套用。既有五個 ZOHO 變數維持在 Railway。
7. `instrumentation.ts` 僅在 Railway production 明確開啟時啟動每 15 分鐘的檢查；Vercel／Preview 不啟動。每輪最多 10 品牌，按最久未檢查排序；每品牌至少間隔一小時。
8. 實際驗證 worker 紀錄與公司信箱。串接每日總控台的受驗證名單來源後，才能更新原 ChatGPT 排程為全自動 Zoho；不可只改提示詞便宣稱已串接。

## 驗證

`npm test` 包含邏輯測試。`outreach-db.test.ts` 在提供明確的 `OUTREACH_TEST_DB_URL` 時使用真正 PostgreSQL 驗證競態、每日上限、持久化、停止狀態與五工作天追信；只接受 localhost 的隔離測試 DB，CI 使用既有 PostgreSQL service。

本機已驗證：TypeScript、完整 Next build、登入後台、新增本機品牌、停止聯絡，以及單元與隔離 PostgreSQL 測試。正式連線、migration、測試寄送及 worker 啟用需以實際上線結果另外記錄。

## 回復

先關閉上述兩個 Outreach 開關，再回復應用版本；保留已建立的兩張表與寄送紀錄。不可 drop 或清空，以免遺失去重依據。不要自動恢復舊 Gmail 寄送。

## 官方 API

- https://www.zoho.com/mail/help/api/post-send-an-email.html
- https://www.zoho.com/mail/help/api/post-reply-to-an-email.html
- https://www.zoho.com/mail/help/api/get-search-emails.html
- https://www.zoho.com/mail/help/api/get-email-content.html
