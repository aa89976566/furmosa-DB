# 認養資料自動同步：執行前核對

## 已核實的現況

Railway production 的 automation-worker 每五分鐘執行 scripts/process-automation-jobs.ts。
該程式只呼叫 processDueAutomationJobs 與 retryFailedShopifyIntakes，未處理認養資料。
Shopify 浪浪尋家的愛兔協會資料目前嵌入頁面 JavaScript，並非自動同步。

## 本次範圍

提供獨立、唯讀的來源解析器、差異判斷與預檢指令，不修改既有 LINE／Shopify 訂單 worker。
不修改 Prisma schema、不執行 migration、不寫入正式資料、不啟用排程、不宣稱同步已上線。
零新增套件。node --test lib/adoption/source-sync.test.mjs 可驗證規則。
node scripts/adoption-sync-preflight.mjs --limit 10 --output /tmp/adoption-preflight.json 可對來源做限量預檢。
非完整掃描退出碼為 2；任何抓取失敗、解析失敗或批次上限都不得推導刪除。

## 正式接入計畫（待核准資料結構後實作）

1. 新增 AdoptionSourceRecord：source+sourceId 唯一鍵、公開來源欄位 JSON、hash、sourceStatus、publicationStatus、lastCheckedAt、lastSeenAt、missingCount；不存個人申請資料。
2. 新增 AdoptionSyncRun：開始／完成／最後成功時間、列表完整性、數量、錯誤摘要、異動計數及 lease，避免 worker 重疊。
3. 新增獨立、非破壞性 migration，經 standard release plan 核准執行；不得在 build/start 自動 migration。
4. 在既有 worker 加入有時間門檻、批次上限的認養工作。列表目標 30 分鐘；詳細頁分批輪巡，頻率待來源試跑確認。
5. 只成功完成的 run 可更新最後成功時間。明確關閉狀態移出搜尋；列表缺席先直接核對；逾時/5xx/未知欄位保留舊資料。大量消失熔斷。
6. 新增僅回傳公開認養欄位的讀取 API；Shopify 改讀該 API，保留最後成功資料與過期標示。不得把資料庫憑證放前端。
7. 先對隔離 Preview DB 驗證新增、修改、關閉、失敗、重新啟動恢復與圖片失效；再經 Deploy Production 指定 PR/SHA 發布。
8. 驗收需看到排程自行執行的不同 run、資料庫時間更新、API 返回更新與 Shopify 顯示一致；手動跑一次不算自動同步完成。

## 回復方式

以功能開關停用認養工作，既有 LINE／訂單任務持續。Shopify 回復上一版靜態資料並明確標記核對日期。
新表保留稽核資料，不以 DROP TABLE 作為一般回復方式。
