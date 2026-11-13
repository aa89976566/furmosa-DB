# 認養資料自動同步

## 範圍與來源

2026-11-13 使用者已核准新增認養資料與同步紀錄兩張表，接入後台排程及 Shopify 網站。
來源限台灣愛兔協會公開資料；維持原頁連結及照片來源，不儲存領養申請人資料、不推測性格。

## 已實作

- AdoptionSourceRecord：source+sourceId 唯一鍵、公開資料 JSON、hash、狀態、核對時間與重試排程。
- AdoptionSyncRun：排程來源、開始/完成時間、列表完整性、異動數與錯誤；資料庫 lease 防止重疊。
- 沿用既有五分鐘 automation-worker；原 LINE 與訂單任務先執行，認養工作獨立捕捉失敗。
- 列表每三十分鐘核對，最多三十頁。個別頁每批最多二十五筆、成功後一小時再核對，每次來源請求間隔 750ms。
- 未開放/幼兔不送養/已送養明確狀態移出搜尋；列表缺席僅優先核對；連續兩次獨立的直接 404/410 暫停刊登，不能宣稱已送養。
- 逾時、5xx、未知欄位保留最後成功資料；大量消失暫停缺席判斷；頁數/時間/筆數均有上限。
- 原頁活動卡、側欄連結不當作動物；快照 hash 只包含動物欄位。
- 公開 GET /api/storefront/adoption 僅回傳明確允許欄位及同步時間，不回傳錯誤內容、DB ID、憑證。
- 新表啟用 RLS，不向 anon/authenticated 開放 Data API。Prisma 伺服器存取；不新增任何套件。

## 驗證與啟用

1. node --test lib/adoption/*.test.mjs：來源、同步決策、重啟續跑、lease、原頁錯誤及隔離 Postgres migration。
2. node --import tsx --test lib/__tests__/adoption-public-response.test.ts：公開欄位與 CORS。
3. middleware.test.ts：僅精確讀取端點免登入，子路徑仍須 HQ 認證。
4. CI 使用隔離 PostgreSQL 套用 migration，執行全測試及 build。
5. 正式依 Deploy Production、PR #645、完整 SHA、standard plan 執行限定 migration 後發布。
6. 正式 worker 設 ADOPTION_SYNC_ENABLED=true 才啟用；預設停用。不得在 build/start 執行 migration 或 seed。
7. Shopify 僅在 API 可讀且回傳有效資料後切換，標示逐筆核對時間及首次建檔進度；來源不可用顯示保留資料狀態。
8. 驗收必須有不同時間的 scheduled run、資料庫核對時間與 API/Shopify 一致。手動預檢或一次成功部署不算自動更新驗收。

## 回復

設 ADOPTION_SYNC_ENABLED=false 停止後續來源抓取，保留 LINE 與訂單任務。
Shopify 可回復上一版靜態資料並顯示舊核對日期。新表保留，不用 DROP TABLE 回復。

## 第二來源：台灣認養地圖（2026-11-13）

- 依公開「動物送養使用方式」第4項公益推廣分享約定：https://www.meetpets.org.tw/content/9 。僅認養個案圖文，不複製知識文章、個人聯絡欄位與網站素材。
- 爬取官方 dog/cat/others 列表與分頁、逐筆原頁。來源 namespace、lease、最新成功時間均獨立，不改 schema、不新增排程/環境變數，沿用現有啟用開關。
- 原刊登者個性、故事、認養條件保留原文。已送出/找到家等明確標題移出列表；失敗保留舊資料、連續兩次直接404/410暫停。刊登中不代表已向送養人確認。
- API 只接受 source=loverabbit 或 source=meetpets；未指定保持原愛兔回應相容。每個來源均有獨立同步紀錄。
- 網站新增獨立來源區，沿用既有卡片、桌機三欄/手機單欄，五分鐘刷新，維持來源原頁連結及核對時間。
- SPCA/PACK/流浪兔協會目前無授權回覆；Wepet條款另限制自動利用。以上維持連結，不自動匯入。
