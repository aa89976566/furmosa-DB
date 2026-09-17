# Furmosa Release Evidence

狀態：**NO-GO／尚未取得發布資格**

候選日期：2026-09-15

本文件是每個候選版本的唯一發布證據入口。只有同一 revision 的必要 Gate 全部通過，才可改為 GO。其他分支或資料夾的測試、平台顯示成功、代理口頭回報都不能替代本表。

工作包如何建立、資料庫如何發布、測試層級、分批上線、停止與事故回復，統一依 `docs/ENGINEERING-DELIVERY-PROCEDURE.md`；本文件只保存當次候選版本的實際證據與決策。

## 候選基準

| 項目 | 結果 |
|---|---|
| Repository | `aa89976566/furmosa-DB` |
| Base revision | `c688b943b5bd24d9b3846593f02fdd5bd18366d3` |
| Base | 2026-09-15 已 fetch 並核對 GitHub 遠端 main |
| Worktree | 隔離工作樹，建立後為乾淨 detached HEAD |
| Validated application revision | `c688b943b5bd24d9b3846593f02fdd5bd18366d3`；其後只允許本證據文件的 commit |
| Pull request | `#244`；已合入最新 main 基準；以 PR 最新 head 的 GitHub checks／deployment 為文件後繼版本證據，避免把自指 SHA 寫回文件造成永久過期 |
| Production revision | `c688b943b5bd24d9b3846593f02fdd5bd18366d3`；Vercel deployment `9rzbVqzrDmdcWz7AHfSPcs5zb4PY`，Ready；schema 未驗證 |
| Schema／migration production status | **未驗證** |

先前使用的 `codex/oms-claude-cursor-rule` 位於 `0e7f1a3b...`，比本機 `origin/main` 落後 44 commits，不得作為發布候選。

## Build 與 migration 邊界

| 檢查 | 結果 | 證據 |
|---|---|---|
| build 不執行 migration | PASS | `package.json`: `prisma generate && next build` |
| build 無 migrate／seed／db push／示範帳號寫入 | PASS | `build-zero-write-security.test.ts` 6/6 |
| migration 有獨立命令 | PASS（靜態） | `npm run prisma:deploy` |
| DEPLOY 指引可直接操作 | FAIL | 舊內容仍描述自動 migration／正式重置；已加禁止操作警告 |
| production-mode build 可完成 | PASS（CI） | 應用 revision `c688b94` 與其文件後繼 revision 均由 PR #244 CI 驗證；最新 run 以 PR checks 為準 |

## 必要發布 Gate

- [x] Fetch 後確認 latest main SHA，候選必須以該 revision 為基準。
- [x] 記錄完整 working tree，白名單外 diff 為零。
- [x] Prisma validate 通過。
- [x] migration 只在隔離 PostgreSQL 通過；不得連正式資料庫。
- [x] TypeScript typecheck 通過。
- [x] 完整測試通過，保存 exit code 與測試數量。
- [x] production-mode build 完成且零資料寫入。
- [ ] Preview 使用隔離資料庫，不共享正式資料。
- [ ] 店家／POS Golden Journey 通過。
- [ ] 一般客戶／Shopify Golden Journey 通過。
- [ ] LINE／換罐 Golden Journey 通過。
- [ ] Production protection／批准規則已確認。
- [ ] 記錄可用 rollback target 與回復步驟。
- [ ] 部署後唯讀 smoke 通過；登入 redirect 不算 authenticated read 成功。
- [ ] 觀察窗內無新增重大錯誤、同步積壓或對帳差異。

## Golden Journey Evidence

| Journey | Revision | Environment | Result | Test namespace | Evidence |
|---|---|---|---|---|---|
| 店家／POS | `c688b94` | local pure contracts | PARTIAL | 交易、收貨、庫存、結帳 | 核心與補貨規格契約通過；未做 DB/browser E2E |
| 一般客戶／Shopify | `c688b94` | local pure contracts | PARTIAL | webhook order/fulfillment | 事件順序、重送、未知 SKU、取消與履約單調性通過；未送真 webhook |
| LINE／換罐 | `c688b94` | local pure contracts | PARTIAL | 簽章、序號解析、付款狀態機 | 外部訊息 Preview choke 通過；序號／點數真 DB suite 未執行 |

## 本工作包的實際測試

```text
package-lock.json 精確版本安裝

本機核心測試（未接 DB，最新 main 基準）：tests 1063; pass 1063; fail 0
最新候選 CI：一次性 PostgreSQL 16 migration、typecheck、完整測試與 production-mode Next.js build 全部 PASS；run 編號由 PR #244 最新 checks 保存
middleware／公開換罐入口／health：tests 18; pass 18; fail 0
關鍵流程契約加跑（訂單、審核、出貨、POS 收貨、換罐、LINE 簽章、Shopify webhook、對帳）：tests 150; pass 150; fail 0
ECPay 簽章／金額／外部副作用 choke：tests 14; pass 14; fail 0（未涵蓋 route 回跳與 callback 併發）
HQ→出貨→POS 收貨、跨店隔離、重送與通知：tests 29; pass 29; fail 0
TypeScript typecheck：PASS
Prisma validate（假本機 URL、純結構驗證）：PASS
git diff --check：PASS
```

以上測試沒有連線正式資料庫、執行 migration、seed、資料匯入或外部副作用。第一次使用 pnpm 依 semver 範圍安裝時出現 5 個測試失敗；改用 `package-lock.json` 精確版本後同 5 項與完整套件全部通過，因此前者判定為測試環境污染，不列為產品缺陷。

## 目前發布阻擋

1. **Preview 資料隔離尚未完整證明。** Vercel 實際設定顯示 `DATABASE_URL` 僅套 Production，而 Preview 使用 Supabase integration 提供的 `POSTGRES_PRISMA_URL`／`POSTGRES_URL`；這符合分離方向，但目前沒有可安全比對的資料庫專案身分證據。另有高風險舊腳本 `scripts/sync-vercel-db-env.sh`，會把同一組 `DATABASE_URL` 與 `DIRECT_URL` 同時寫入 `production`、`preview`，不得再直接執行。在資料庫身分完成核對前，禁止在 Preview 登入後建立、修改或刪除測試資料。
2. **本機未重跑 Production build，但候選 CI 已完成。** PR #244 最新 CI 在一次性 PostgreSQL 16 服務上依序通過 Prisma validate、migration deploy、typecheck、`npm test` 與 production-mode Next.js build。CI 使用 Node 22，Vercel runtime 設定為 Node 24.x，環境版本仍未對齊。
3. **Golden Journeys 尚未取得資料層證據。** HQ／POS 的未登入 redirect 已在 Preview 通過，但登入 redirect 不等於 authenticated E2E。
4. **相依套件安全警示未處理。** `npm audit` 回報 11 項（high 7、moderate 2、low 2、critical 0）。直接相依為 `postcss`（high）及被其影響的 `next`（moderate）；其餘為 axios、baseline-browser-mapping、brace-expansion、browserslist、esbuild、form-data、js-yaml、nanoid、postcss-selector-parser 等轉接相依。audit 對 Next 的建議是升到 16.3.5（major），不可自動套用；需另開相依套件安全工作包，逐項判斷 runtime 可達性與非破壞性升級路徑。
5. **專案規則與現況不一致。** `AGENTS.md` 宣告固定 Next.js 14，實際 `package.json`／lockfile 為 Next.js 15.5.25。不得在本工作包升降版，需由架構決策明確選定並同步規則。
6. **部署供應鏈仍有設定債。** Preview build 成功，但 Vercel 顯示 1 組 `allow-scripts` 警告：`@prisma/client`、`@prisma/engines`、`esbuild`、`prisma`、`unrs-resolver` 的安裝腳本尚未納入明確核准清單。另有兩項平台建議：Skew Protection 尚未啟用、On-Demand Concurrent Builds 尚未啟用。本工作包只記錄，不直接變更專案設定。
7. **預設測試命令漏掉三個目錄。** `package.json` 的 `npm test` 沒有包含 `lib/logistics/*.test.ts`、`lib/settlements/__tests__/*.test.ts`、`lib/stores/__tests__/*.test.ts`。額外執行這些檔案時，174 項通過、2 項失敗：結帳的 HQ/POS 台北時間字串在 Node 24 因 Unicode 空白不一致；`partner-stores-read-only.test.ts` 因 CJS 輸出不支援 top-level await 而無法載入。這兩項必須另開小型修復工作包，不能把預設測試綠燈視為完整綠燈。
8. **結帳的真資料庫整合測試未執行。** 換罐 `jar-exchange.test.ts` 已在 CI 的一次性 PostgreSQL 通過 2 項（重複序號拒絕；足額點數兌券並記成本）。但 `lib/settlements/__tests__/postgres-settlement.test.ts` 不在 `npm test` 內，且要求專用 loopback 隔離 PostgreSQL 與明確旗標；因此結帳唯一約束、來源鎖、併發與交易回滾仍缺真 DB 證據。另需注意：這類整組 `describe(..., { skip })` 在 Node 摘要可能仍顯示 `skipped 0`，不能只看尾端數字判斷是否真的執行。
9. **沒有可重複的已登入瀏覽器 E2E。** 專案沒有 Playwright／Cypress 測試檔或對應 script；現有 `scripts/production-smoke.mjs` 只驗證公開入口與未登入邊界。HQ 審核→出貨、POS 收貨→庫存、POS 銷售→對帳、一般客戶訂單，以及 LINE 序號→點數→兌券目前主要靠單元／契約測試，缺少隔離資料庫上的跨頁自動驗收。
10. **新版 POS 結帳寫入目前未啟用。** Vercel 專案環境變數查無 `POS_SETTLEMENT_WRITE_ENABLED`；程式只接受精確字串 `true`，缺值時會 fail closed。因此畫面與暫計可讀，但 `confirmStoreSettlementAction` 會拒絕建立新版結帳紀錄。啟用前必須先完成隔離 PostgreSQL 整合測試與 production schema 核對，不應直接補旗標。
11. **管理端存在有副作用的 GET。** `app/api/admin/ensure-zhuwo/route.ts` 的 `GET()` 直接轉呼叫 `POST()`，會補建／更新店家分店；授權只檢查任一 HQ 登入，沒有管理員角色與專用 CSRF／重認證閘門。HQ cookie 為 `SameSite=Lax`，跨站頂層 GET 仍可能帶 cookie。應另案改為只允許受權限保護的 POST，並加入「GET 永不寫入」與角色測試；本工作包不改行為。
12. **主分支與正式發布沒有強制保護。** GitHub Repository Rulesets 顯示尚未建立任何 ruleset，傳統 Branch protection 也未設定。名為 `Production` 的 GitHub Environment 雖存在，但 Required reviewers 與 Wait timer 均未啟用，Deployment branches and tags 為 `No restriction`，管理員繞過亦允許。故目前沒有平台層保證「PR、必要 checks、指定分支、人工批准」均成立後才可發布；在補齊保護規則前維持 NO-GO。本工作包只記錄，不改 repository／environment 設定。
13. **正式排程目前會安全拒絕，營運整理工作不會執行。** `vercel.json` 已排程 `/api/cron/expire-coupons` 與 `/api/cron/maintain-shipments`；兩條路由在 Preview／Production 都透過 `authorizeCronRequest` 強制要求 `CRON_SECRET`。2026-09-15 在 Vercel 專案環境變數搜尋 `CRON_SECRET` 為 `No Results Found`，因此平台觸發時會回 401。這會停止優惠券到期、出貨佇列完整性、訂閱出貨同步、店家 ensure、KPI snapshot 與預約提醒等工作。需另案產生高熵密鑰、同時設定 Vercel Cron 與 Production／Preview scope，並以隔離環境驗證 401／200 與零重複執行；本工作包不建立或傳送密鑰。
14. **GitHub Actions 供應鏈沒有 SHA 固定。** Repository Actions permissions 目前允許所有來源的 action／reusable workflow，且 `Require actions to be pinned to a full-length commit SHA` 未啟用；工作流程使用 `actions/checkout@v4`、`actions/setup-node@v4`、`anthropics/claude-code-action@v1` 等可移動 tag。最新 CI 另明確警告 checkout/setup-node v4 仍以已淘汰的 Node 20 為目標，平台正在強制改用 Node 24。預設 `GITHUB_TOKEN` 是 read-only、Actions 不可自行批准 PR，這兩點是正向控制；但 Claude workflow 會針對受信任成員的 `@claude` 事件取得 contents／PR／issues write 與 id-token write。正式化前應升級並以完整 commit SHA 固定第三方 action、最小化 Claude job 權限並加入 CODEOWNERS／受保護分支；本工作包不改自動化設定。
15. **LINE 入口缺 webhook 級去重，獎勵兌換亦缺提交冪等。** Shopify 已以 `shopDomain + topic + eventId` 唯一鍵與 advisory lock 防重送；LINE webhook 的事件型別與路由則未保存 webhook event id／redelivery 狀態，事件會逐筆直接執行。LINE Reply／Push、ID token verify、profile 與 loading 的 `fetch` 也未設定 AbortSignal timeout；webhook 逐筆同步等待業務處理，最長 runtime 30 秒，外部服務卡住時容易逾時後被 LINE 重送。瓶底序號入點本身使用 `updateMany(... status: unused)` 原子搶占，能拒絕同碼重複；但 LIFF 獎勵兌換只帶 `idToken + rewardIndex`，沒有客戶端 idempotency key，點數餘額以「讀最後一筆再寫新 balance」實作，未見 customer-level lock／序列化，`MemberPointsLedger` 的 `sourceType + sourceRefId` 也只有 index 而非 unique。快速雙擊、網路重試或並行請求可能造成重複兌換、序號碰撞錯誤或不一致 balance。需另案增加 webhook inbox／快速 ACK、外呼 timeout、兌換 idempotency key、客戶級鎖／原子餘額模型與並行 PostgreSQL 測試；本工作包不改 LINE／點數行為。
16. **換罐付款在正式環境尚未配置完成。** Vercel Project 顯示 `LINE_CHANNEL_SECRET`／`LINE_CHANNEL_ACCESS_TOKEN` 已套 Production，`LINE_LIFF_ID_REFILL` 已有 Production and Preview；但 Project 與 Shared 均查無程式實際要求的 `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`，因此 `initiateRefillPayment` 會在任何 Prisma 寫入前回 `ECPAY_NOT_CONFIGURED`／503。現有 `ECPAY_LOGISTICS_LIVE_*` 是物流電子地圖設定，不能代替金流憑證。另外，若只補三項金鑰而沒有設定 `ECPAY_PAYMENT_URL`，程式預設值是 `payment-stage.ecpay.com.tw`，仍非正式金流。需另案由付款管理者確認商店身分、正式 callback URL、簽章與金額，於沙盒通過後再以人工核准導入 Production；本工作包不讀取、不建立或傳送付款密鑰。
17. **HQ／POS session 缺撤銷與登入防暴力控制。** HQ JWT 預設 180 天，Vercel 查無 `HQ_SESSION_DAYS` 覆寫；POS 程式預設 168 小時，Production and Preview 有 `SESSION_HOURS` 變數但介面不顯示其值，故實際效期尚待管理者核對。兩者 middleware 與 server helper 都只驗 JWT 簽章／到期，不回查帳號的 `isActive`、密碼版本或 session version；停用帳號或重設密碼後，既有 token 仍可持續到期。HQ 登入會分別回「帳號不存在」與「密碼錯誤」，HQ／POS 都未見 persistent rate limit／lockout；`loginAction` 對 `next` 只驗 `startsWith('/')`，也未排除 protocol-relative `//host`。另 `verifySessionEdge` 對必填 claims 直接 `String(undefined)`，缺 claim 的已簽 token 不會因結構不完整而 fail closed。需另案加入通用錯誤、IP＋帳號節流、短效 session、server-side revocation/version、嚴格 same-origin next validator 與完整 claim schema；本工作包不更改帳號或登入行為。
18. **公開 LINE GET 可被用來反覆暖機資料庫。** `/api/line/webhook` 的 unauthenticated `GET()` 每次都排程 `SELECT 1`，並公開回傳 LINE secret／token 是否存在。2026-09-15 對正式網域執行一次唯讀 GET 得到 200、`configured:true`、`checks:{secret:true,token:true}`、`warm:true`；路由未見 rate limit。雖不修改資料，外部人可大量請求造成 serverless invocation 與資料庫連線壓力。應改成不碰 DB 的固定 liveness 或受 cron/admin 驗證的 readiness，且公開回應不揭露設定細節；本工作包只做一次唯讀確認。
19. **應用層安全回應標頭不完整。** 正式 `/login` 已由 Vercel 提供 HSTS，但實測未見 CSP／`frame-ancestors`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`，並仍暴露 `x-powered-by: Next.js`；`next.config.mjs` 亦無 `headers()`。在處理 HQ／POS 帳務與店家資料的系統中，應另案建立 CSP report-only→enforce、禁止 framing、收斂 referrer／browser capabilities 並關閉 powered-by，搭配登入、LIFF 與 Shopify App Proxy 相容性測試。
20. **程式部署與 schema 部署沒有可追溯的同版閘門。** `npm run build` 只執行 `prisma generate && next build`，Vercel 建置不會執行 migration；雖有 `npm run prisma:deploy`，但專案內沒有 production migration workflow、deployment job 或 migration revision 紀錄。CI 只在全新 PostgreSQL 16 從零套用 migration，無法證明正式資料庫已到候選 schema，也無法驗證舊資料升級、鎖表時間與 rollback。`docs/JIBA-UNBOX-MIGRATION.md` 與 `docs/PLAN-pos-booking-system.md` 仍描述合併／下次部署會自動套 migration，和現況相反，照舊文件操作會漏掉 schema。應另案建立「備份／PITR 確認 → production-like snapshot preflight → migration deploy → schema revision 記錄 → 應用發布」的人工批准流程，並清理矛盾 runbook；在正式 schema 身分未核對前，不得開啟依賴新欄位的 POS 結帳寫入。
21. **換罐付款回跳畫面可能誤報成功，併發回呼也可能重複通知。** `/api/payments/ecpay/return` 的 GET 只要帶任意 `orderId` 就導向 `?paid=1`，POST 即使簽章、金額或付款狀態處理失敗也同樣導向 `paid=1`；這不會改變付款真相，但會讓客戶看到錯誤成功提示。Server callback 的付款搶占採 `updateMany(... status: pending)`，資料更新本身可防重複；然而函式沒有把 `claimed.count` 帶出 transaction，併發請求中未搶到的一方仍會回報 `updated:true` 並呼叫 LINE 付款通知。現有測試只驗 MAC、金額常數與 parser，未覆蓋上述 route／併發情境。應另案讓回跳頁以伺服器查詢的付款狀態顯示、不可相信 query flag，並以 claim 結果控制通知與回傳值，補同一 callback 並行測試。
22. **HQ 直接建立店家補貨不是原子交易。** `createRestockOrderWithShipment` 接到 transaction client 時可把 Order 與 Shipment 放在同一交易，POS 補貨審核流程有這樣呼叫；但 HQ 店家頁直接建立進貨時未傳 transaction，會先建立 Order、再建立 Shipment，之後才逐筆建立建議規則。若第二步因編號碰撞、連線或驗證失敗，會留下沒有 Shipment 的已確認 Order；現有 cron 只修「有 Shipment、沒有 Order」的反方向孤兒，不能修這種狀態。這條路徑的 order／shipment 編號亦以查最大值加一且未加 advisory lock，並行操作可能撞 unique key。應另案統一由一個 transaction client 執行編號鎖、Order、Shipment 與必要設定，並加入故障注入、兩次並行建立與重試後不重複的 PostgreSQL 測試。
23. **LINE 活動請求仍可能在 runtime 執行 DDL／seed。** `ensureJibaCampaignSchema()` 會在活動查詢或 LINE 報名遇到缺表時，以 `$executeRawUnsafe` 動態 `CREATE TABLE`／index／FK，並 `INSERT` 固定活動資料；註解還假設 production build 的 migration 是 soft-fail，但實際 build 根本不執行 migration。這讓一般業務請求兼具 schema 管理權限，無 migration history、無完整原子性，部分 FK 失敗還會被 soft-skip，可能產生「頁面能用但資料約束不完整」的漂移狀態。應列為 P0：移除 runtime DDL，使用最小權限 runtime DB 帳號，將 schema 與 seed 納入可審核 migration／一次性 release job，並加入 schema drift gate；本工作包不觸發該函式、不修改資料庫。
24. **健康檢查與告警只能證明程序活著，不能證明系統可作業。** `/api/health` 與 `/api/health/live` 都固定回 200，不驗 DB 連線、schema revision、cron 最近成功時間、Shopify／LINE 積壓或 POS 結帳旗標；專案亦未見 Sentry／APM／OpenTelemetry instrumentation、錯誤率或業務不變量告警，背景失敗多半只 `console.error`。本次 Vercel 過去一小時日誌為 Warning／Error／Fatal 皆 0，只是短時間觀察，不能偵測「cron 全部 401」這類靜默失效。應在受保護的 readiness／營運面板加入 DB/schema、最後成功排程、webhook lag、孤兒 Order／Shipment、負庫存與對帳差異，並為 P0 不變量設告警；公開 liveness 保持不碰 DB。
25. **POS「紀錄」不是完整訂單來源，且銷售可能重複顯示。** `loadQueryFeed()` 讀取銷售交易、換罐單、補貨申請與全部庫存流水，沒有讀 `Order`／`Shipment`；因此它不能作為 HQ 與 POS 的店家訂單清單。第一個查詢已把 `merchantStockTxn(type: sale)` 分組成銷售項目，第四個查詢又讀取未排除 `sale` 的全部 `merchantStockTxn`，再把兩者合併，實際銷售可能同時以「銷售」及「庫存異動」出現。現有測試用不同 fixture 避開了重疊，未覆蓋同一 sale row。應另案先定義「訂單」與「操作流水」兩個資訊架構，再讓店家訂單直接讀同一 Order／Shipment 真相，流水排除已分組 sale 或用 canonical event id 去重。
26. **資料庫維運指令缺 production deny guard，名稱亦可能誤導。** `db:check` 實際先執行 `prisma migrate deploy`，不是唯讀檢查；`db:reset` 直接使用 `prisma migrate reset --force`，另有 seed、import、clear 指令直接取用目前環境的資料庫 URL。尤其 `prisma/seed.ts` 的開頭即逐表 `deleteMany`，之後建立固定預設帳號／密碼；`prisma/clear.ts` 也大量刪除業務資料並可能補建預設 admin。只有 `ensure-demo-admin` 明確看到 production fail-closed，通用 reset／seed／clear／deploy script 沒有相同包裝；`DEPLOY.md` 雖已加頂部警告，內文仍保留建立示範帳號、匯入與重置說明。應列 P0 維運安全包：把唯讀 status 與變更 deploy 分名、所有破壞性指令加入環境身分與手動 challenge、CI 禁止 production secret，並把歷史操作移到不可直接複製的封存文件。
27. **最新 main 已自動部署程式，但同版 migration 明確尚未完成。** 稽核期間 main 由 `7800462` 前進到 `db33edb`、`c688b94`，Vercel 已自動把兩者發布為 Production；`c688b94` 新增 `restock_request_items.weight_grams`／`variant_key` 與 `ShipmentItem.variantKey`，應用查詢也已開始選取／寫入這些欄位。該變更自己的 runbook 明載 production migration／repair 尚未完成，而 Vercel build 不會跑 migration。除非另有人已人工套用且留下證據，正式補貨頁可能因缺欄位失敗。不得以 Vercel Ready 當作 schema Ready；應立即唯讀核對 `_prisma_migrations` 與欄位、在結果明確前暫停相關寫入。這項核對需要資料庫授權，本工作包沒有連正式 DB。

## 修復權重與順序

| 優先級 | 工作包 | 先完成的原因 |
|---|---|---|
| P0-1 | 資料庫身分、備份／PITR、schema revision 與 migration release job | 不先證明資料庫與 schema，任何登入後 E2E 或寫入旗標都可能碰錯環境或遇到缺欄位。 |
| P0-1 | 封鎖 production reset／seed／clear／import，拆分唯讀 check | 目前部分一行指令可對當前 URL 大量刪除並建立預設帳密，需與資料庫身分保護同批先處理。 |
| P0-2 | 移除 runtime DDL／seed，收窄 runtime DB 權限 | 一般 LINE 請求不應能改 schema；先消除不可控漂移來源。 |
| P0-3 | HQ 店家補貨單原子化與編號併發鎖 | 防止 Order／Shipment 半張單，直接保護 HQ→出貨→POS 收貨主流程。 |
| P0-4 | ECPay 正式設定、付款狀態回查與 callback 併發冪等 | 防止付款功能不可用、誤報成功或重複通知；須先在沙盒與隔離 DB 驗證。 |
| P0-5 | CRON_SECRET 與排程執行證據 | 恢復優惠券、出貨完整性、訂閱、KPI 與提醒等維護工作，且確認可重跑。 |
| P0-6 | GitHub main／Production 強制保護 | 技術修好後仍需平台保證 checks、指定分支、人工批准與禁止直接上線。 |
| P1 | 已登入 Golden Journey、結帳真 DB suite、LINE inbox／獎勵冪等、session 撤銷與節流 | 補足跨頁、重送、併發與帳號停用證據，完成後才考慮開 POS 結帳寫入。 |
| P1 | 完整測試收錄、Node 版本一致、安全相依與安全標頭 | 消除目前預設測試的假綠燈與已知供應鏈／瀏覽器保護缺口。 |
| P2 | Vercel skew／concurrency、規則文件版本、觀測與告警 | 提升發布穩定與故障發現能力，不應先於交易與付款正確性。 |

每個工作包必須維持小 diff、獨立 PR、隔離資料庫測試、同 revision 證據；前一個 P0 未通過，不以擴增新功能掩蓋。

## Preview 唯讀檢查

- 部署：Vercel Ready；GitHub deployment check PASS。
- Build Logs：237 行、1 組警告、建置完成並成功上傳 cache；警告內容如「目前發布阻擋」第 6 項。
- Runtime Logs（部署後 30 分鐘）：24 次唯讀／未登入驗證請求，Warning 0、Error 0、Fatal 0；路由包含 `/login`、`/pos/login`、`/api/health`、`/orders/new`、`/pos/settle`。
- 外部副作用閘門：Vercel 的 `APP_ENV` 與 `EXTERNAL_EFFECTS_MODE` 都只套 Production，Preview 沒有；`allowsExternalEffects` 對缺值與非 production 一律拒絕。另加跑 LINE reply／push／loading／profile 與 build 零寫入契約：tests 32; pass 32; fail 0。
- Shopify webhook secret 只套 Production，Preview 不具備真 webhook 驗收條件；本次沒有向 Shopify 或 LINE 發出業務訊息。
- HQ `/orders/new`：未登入會導向 `/login?next=%2Forders%2Fnew`，PASS。
- POS `/pos/settle`：未登入會導向 `/pos/login?next=%2Fpos%2Fsettle`，PASS。
- `/api/health`：無 Vercel SSO 的 HTTP 請求先被平台 302 到 Vercel SSO；瀏覽器端直接開 JSON 被客戶端阻擋，因此尚未取得候選應用的 200 JSON 證據。
- 以上僅證明路由與登入邊界，不等於資料庫讀取、狀態同步或 Golden Journey 通過。

## Production 基線唯讀 smoke

2026-09-15 對 `https://furmosa-db.vercel.app` 執行固定、無 cookie、禁止跟隨 redirect 的 6 個 GET：6/6 PASS。涵蓋 `/api/health`、HQ/POS 登入頁、HQ/POS 未登入 redirect，以及店家換罐 API 未登入 401。稽核開始時正式網域對應 `7800462`；其後 main 被其他流程推進並自動發布為 `c688b94`（deployment `9rzbVqzrDmdcWz7AHfSPcs5zb4PY`，Ready）。這只證明平台完成建置，不能證明同版 migration 已套用；本工作包沒有觸發這兩次正式發布，也沒有在版本切換後對正式資料執行寫入。此基線不能用來證明 PR #244 候選功能。

## Production Side Effects

本工作包沒有執行 deployment、migration、seed、import、cron、webhook、帳號建立、正式資料修改或刪除。

## Rollback 邊界

- 應用程式：`c688b94` 前一個已知 Ready production deployment 是 `8GKfJqG7tgUpNx1WPaYc6PERDYiB`（commit `db33edb`），只能列為候選；若新 schema 尚未套用，回退應用可降低新欄位查詢風險，但實際 rollback 仍須人工批准與唯讀 smoke。
- 資料庫：尚未取得 production schema revision、備份／PITR 與還原演練證據，因此目前**沒有可聲稱有效的資料庫 rollback**；不得以 `rollback.sql` 或 Prisma reset 代替還原計畫。
- 外部事件：Shopify／LINE／ECPay 已送出的 webhook、訊息或付款不能靠回滾程式撤回；事件 inbox／冪等與人工對帳程序未完備前，外部整合發布維持 NO-GO。
- 停止條件：schema 身分不符、Preview 與 Production DB 身分不明、migration preflight 失敗、付款金額差異、跨店資料可見或單一 Golden Journey 失敗，立即停止，不在正式環境現場修補。

## GO／NO-GO 規則

- 任一必要 Gate 未驗證或失敗：`NO-GO`。
- migration、付款、權限、正式資料修復：另需明確人工批准。
- Candidate SHA 在驗證後改變：原證據失效，重新驗證。
- Rollback 不可用：停止發布，不用現場修補替代。
