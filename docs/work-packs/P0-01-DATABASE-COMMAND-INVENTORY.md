# P0-01 附件：資料庫指令與隱性寫入清冊

狀態：**STATIC REVIEW V1／只讀盤點完成，控制尚未實作**  
盤點日期：2026-09-15  
對應工作包：`docs/work-packs/P0-01-DATABASE-RELEASE-SAFETY.md`

## 1. 本次範圍與限制

本清冊只閱讀候選程式碼，沒有連接任何資料庫、沒有執行 migration、seed、clear、import、repair、backfill、cron、LINE API 或 Vercel 部署，也沒有修改正式資料。

分級定義：

- **R0 靜態**：不連資料庫。
- **R1 唯讀**：會連線，但設計上只讀取。
- **R2 安全預覽**：預設 dry-run；只有明確 `--apply` 或等價批准才寫入。
- **R3 寫入**：預設會新增或更新資料。
- **R4 高風險／破壞性**：大量刪除、重建、schema 變更、秘密輸出或正式環境控制。

目前沒有共用的資料庫身分驗證器，因此以下「預設 dry-run」只表示腳本的參數預設較安全，**不代表已可對 Production 執行**。

## 2. `package.json` 指令

| 指令 | 分級 | 實際行為 | 目前判定 |
|---|---:|---|---|
| `dev` | R0 | 產生 Prisma Client 後啟動開發站 | 不執行 migration；仍需避免誤接 Production |
| `build` | R0 | 產生 Prisma Client 後建置 Next.js | 不執行 migration、seed 或 repair |
| `start` | R0 | 啟動已建置的 Next.js | 不執行 migration |
| `postinstall`／`prisma:generate` | R0 | 產生 Prisma Client | 可保留 |
| `prisma:validate` | R0 | 驗證 schema 語法 | 可作靜態 Gate |
| `prisma:migrate` | R4 | `prisma migrate dev` | 會改 schema，只允許隔離開發庫 |
| `prisma:deploy` | R4 | `prisma migrate deploy` | 會改 schema，只能由受控 release job 執行 |
| `db:check` | R4 | **先 deploy migration，再做 `SELECT 1`** | 名稱嚴重誤導；必須改為真正唯讀 |
| `prisma:seed` | R4 | 執行 `prisma/seed.ts` | 先大量刪除再重建固定資料，Production 必須拒絕 |
| `prisma:studio` | R3 | 開啟可互動讀寫資料的 GUI | 不可列為唯讀工具 |
| `db:setup` | R4 | migrate dev 加 seed | schema 與資料皆會變更 |
| `db:clear` | R4 | 大量刪除多數業務表，再重建部分基礎資料 | Production 必須拒絕 |
| `db:import` | R4 | 大量 upsert、更新與部分刪除 | Production 必須拒絕，不能以「可重跑」視為安全 |
| `db:import-prices` | R3 | 更新商品與重建價格級距 | 仍屬資料寫入，不是只讀匯入 |
| `db:reset` | R4 | `prisma migrate reset --force` | 破壞性重設，Production 必須在連線前拒絕 |
| `merchant:create-user` | R3 | 建立 POS 店家帳號 | 無共用目標環境防呆，需補強 |
| `merchant:ensure-demo-admin` | R3 | 建立測試 HQ／POS 帳號 | 有 `VERCEL_ENV` 與開關，但不足以證明 DB 身分 |
| `product:ensure-mooncake` | R2 | 預設預覽，`--apply` 才更新商品與價格 | 安全預設較佳，仍需共用 Production guard |
| `refill:seed-test` | R4 | 建立／覆寫換罐測試帳號、商品、序號、訂單與庫存 | 含固定測試身分，無 Production deny guard |
| `smoke:production` | R1 | 對固定公開頁面執行 GET smoke | 目前為唯讀；不可加入登入或 mutation |

## 3. 維運與資料腳本

| 入口 | 分級 | 預設行為 | 處置建議 |
|---|---:|---|---|
| `prisma/seed.ts` | R4 | 大量 `deleteMany` 後重建資料 | 僅允許隔離資料庫；Production 永久拒絕 |
| `prisma/clear.ts` | R4 | 清空主要業務資料 | Production 永久拒絕 |
| `prisma/import.ts` | R4 | 大量寫入，部分路徑會刪除店家、價格、訂單與出貨資料 | 拆成明確工作包，不得當一般初始化工具 |
| `prisma/dedupe-products.ts` | R4 | **未帶參數即實際合併／刪除**；`--dry-run` 才預覽 | 改成 dry-run 預設，套用需批准與不變量 |
| `scripts/cleanup-product-names.ts` | R4 | 實際合併商品、改關聯、刪資料 | 補 dry-run、目標清單、transaction 與 guard |
| `scripts/cleanup-unbound-jar-customers.ts` | R4 | **預設實際刪除客戶並重設序號** | 改為 dry-run 預設，正式套用需逐筆證據 |
| `scripts/jiba-shipping-backfill.ts` | R2 | 預設 dry-run，`--apply` 才寫入 | 保留安全預設，補環境身分與批准紀錄 |
| `scripts/repair-customer-shipping.ts` | R2 | 預設 dry-run，`--apply` 才寫入 | 同上 |
| `scripts/ensure-mooncake-product.ts` | R2 | 預設 dry-run，`--apply` 才寫入 | 同上 |
| `scripts/create-merchant-user.ts` | R3 | 預設建立 POS 帳號 | 補 Production target challenge、稽核與冪等規則 |
| `scripts/ensure-demo-admin.ts` | R3 | 需開關，且 `VERCEL_ENV=production` 時拒絕 | 再加 DB project identity；不得只信環境字串 |
| `scripts/seed-refill-test-data.ts` | R4 | 預設寫入並可能更新既有帳號密碼 | 限定隔離測試庫；Production 永久拒絕 |
| `scripts/ops/restock-0008-50g-preflight.sql` | R1 | 固定目標的 SELECT 預檢 | 唯讀，但只適用該單一 repair，不是通用檢查 |
| `scripts/ops/restock-0008-50g-repair.sql` | R4 | 固定 ID 的 transaction 修復 | 必須獨立批准；目前禁止執行 |
| `scripts/deploy-line-rich-menu.ts` | R3 | 建立、上傳、設預設並刪除舊 LINE 選單 | 屬外部系統 mutation，需 dry-run／目標 channel 驗證 |
| `scripts/get-cookie.ts` | R4 | 將有效 HQ session token 印到 stdout | 可能洩漏登入憑證，應停用或改為不可輸出秘密的本機測試方式 |
| `scripts/sync-vercel-db-env.sh` | R4 | 同時覆寫 Production／Preview DB URL，並立即重部署 Production | **隔離失效的最高風險入口；應封存，禁止日常使用** |

## 4. 非指令入口的隱性變更

| 位置 | 風險 | 發現 |
|---|---:|---|
| `lib/campaigns/jiba-two-piece/ensure-schema.ts` | R4 | 一般服務／LINE 流程可在 request path 執行 `CREATE TABLE`、index、FK 與 seed。runtime user 因此必須持有 DDL 權限，違反 migration 與 runtime 權限分離。 |
| `lib/shipment-queue-filters.ts` | R3 | 名稱為讀取／列表整理，但 `maybeMaintainShipmentQueueIntegrity()` 會取消重複出貨、同步訂單狀態；完整維護還會建立孤兒訂單與搬移類型。讀頁不應偷偷改業務狀態。 |
| `app/api/admin/ensure-zhuwo/route.ts` | R3 | `GET` 直接呼叫會寫資料的 `POST`；違反 GET 唯讀語意，也提高預載、重試或掃描誤觸風險。 |
| `app/api/admin/customer-shipping-repair` | R2/R3 | GET 預設 dry-run；POST 加 `apply=1` 可寫入。只有 HQ 登入檢查，未見細分角色與雙重批准。 |
| `app/api/admin/jiba-shipping-backfill` | R2/R3 | GET 預設 dry-run；POST 加 `apply=1` 可寫入。需權限細分、固定上限與稽核。 |
| `/api/cron/maintain-shipments` | R3 | 會修補店家、物流與訂單資料；需把 mutation 明列為背景工作並保留結果與失敗證據。 |
| `/api/cron/expire-coupons` | R3 | 會批次更新優惠券狀態；需同樣納入工作執行與稽核規則。 |
| `/api/line/webhook` 的 GET | R1 | 會以 `SELECT 1` 測 DB；雖不寫入，但公開入口會放大 DB 連線，應與公開健康檢查分離。 |

## 5. 主要結論

1. **現在沒有單一可信的環境身分 Gate。** 多數腳本只要取得 URL 就能執行；`NODE_ENV` 或 `VERCEL_ENV` 不能證明實際連到哪個資料庫。
2. **`db:check` 不是檢查，而是 schema 發布。** 在完成修正前禁止使用。
3. **危險工具的預設不一致。** 部分腳本預設 dry-run，另一些不帶參數就會刪除或合併。
4. **Preview 與 Production 隔離可能被單一腳本同時覆寫。** `sync-vercel-db-env.sh` 不應留在一般操作路徑。
5. **讀頁與 GET route 存在隱性寫入。** 這會讓「只是查看頁面」也改變訂單／出貨狀態，難以稽核與重現。
6. **應用 request path 會做 DDL。** 這使正常服務帳號需要過高權限，也讓 schema 版本無法只由 migration history 證明。
7. **測試資料與登入憑證工具未被可靠隔離。** 固定測試身分或可輸出的 session 都不應接觸 Production。
8. **CI 的 migration 只作用於臨時 PostgreSQL。** 這是正確隔離，但目前仍缺「同一候選 SHA 的獨立 release job＋schema attestation」。

## 6. 建議的最小實作次序

以下尚未授權實作；每一項都應另凍結檔案白名單：

1. 新增共用 DB target identity guard 與真正唯讀的 `db:status`，先寫「Production 誤指向時必須在連線／寫入前拒絕」測試。
2. 將 `db:check` 改成唯讀；將 migration 改名為只可由 release job 呼叫的明確指令。
3. 對 reset、seed、clear、import、dedupe、cleanup、test-data、account-create 全部套用同一 guard；危險操作一律 dry-run 預設。
4. 移除 request path DDL，改為 Prisma migration；runtime DB user 不再擁有 DDL 權限。
5. 將出貨列表的資料修復移出讀頁，改成有身分、批次上限、冪等鍵、稽核紀錄與告警的背景工作。
6. 移除 side-effect GET；所有套用型 admin repair 改為細分角色、POST、一次性批准與可追溯結果。
7. 封存 `sync-vercel-db-env.sh` 與 `get-cookie.ts`，以平台權限分離及不輸出秘密的工具取代。
8. 建立獨立 migration release job：先備份證據與 preflight，再 migration、schema verification、應用 rollout；任一不符即 NO-GO。

## 7. 本階段決策

靜態指令清冊：**PASS（V1）**  
安全控制實作：**NOT IMPLEMENTED**  
Production 唯讀身分／schema／PITR：**NOT AUTHORIZED／UNKNOWN**  
正式發布決策：**NO-GO**

下一個可安全執行的小任務，是凍結「共用 DB 身分 Gate＋唯讀 `db:status`」的實作白名單與測試；在另行批准前不修改程式、不連 Production。
