# EVIDENCE ONLY / NON-ACTIVE / DO NOT EXECUTE

這是 **Exact-history evidence archive**，不是 migration reconciliation。

- **NON-ACTIVE：** 檔案在 `docs/migration-evidence/`，不在 `prisma/migrations/`。
- **Prisma 不會讀取此目錄。** 它不改變 Prisma migration history，不修復 `migrate status`／drift，也不代表 reconciliation 完成。
- **DO NOT EXECUTE：** 不得執行這裡的 SQL。不得刪改或 `migrate resolve` Production `_prisma_migrations` ledger。
- 是否移入 active migration tree、建立 baseline、或採其他 reconciliation，必須另設 gate，且須先完成 empty DB／schema-only clone 驗證與**人工批准**。本 archive **不得預設**那些步驟。

## 這是什麼

Production ledger 有 **12 筆 finished、未 rollback** 的 `202608*` migration。`origin/main` 的 active migration tree 一筆都沒有。

本目錄只保存那 12 筆 **已套用 SQL 的 byte-for-byte 位元組**、Production checksum，以及唯一可信 Git 來源。沒有改 schema、沒有改 active migrations、沒有連資料庫、沒有執行 SQL。

固定輸入：

- Incident [PR #112](https://github.com/aa89976566/furmosa-DB/pull/112) commit `aa6cfaecd317ac980c978b1bca62fed632ed6501`
- Design [PR #113](https://github.com/aa89976566/furmosa-DB/pull/113) commit `b7604c778b3fbdc8780b5caec3ceaaa9d894d92f`

## 保留決策（來自 #112，不得重問）

- LINE morning：`contents`／`news_items`／`ingest_runs` 及其相關結構 **PRESERVE — FEATURE DISABLED**。目前不得啟用發送、cron、新聞抓取或 unfinished runtime。
- `refill_flavours.product_id` 非空關聯 **PRESERVE — PRODUCTION DATA**。7 筆（2026-08-14 snapshot）是正式資料，不得清除、覆寫、回滾或當 Preview 殘留。
- 其他目前零筆／零非空的 DB-only objects：**UNRESOLVED — PRESERVE IN PLACE**。零筆 ≠ 可刪。

## `#90`／`20260804160000` 來源鎖

- **只接受** historical commit `155979e2c06775971a49e4ee8926f2acc9edb407`。
- Production checksum 必須是 `dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`。
- **拒絕** PR #90 current checksum `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161`。該版本不在本 archive。

## 禁止事項

- 不得把本目錄當成 active migrations，也不得建立 symlink 或捷徑到 `prisma/migrations`。
- 不得 merge Draft 功能 PR（#84／#89／#90／#91／#93／#96／#97／#100／#101／#105）當 remediation。
- [PR #111](https://github.com/aa89976566/furmosa-DB/pull/111) **保持 Draft／blocked**。
- 不得 rollback、replay、重跑這 12 筆 SQL。
- 真正 reconciliation 需要 empty DB／schema-only clone 驗證與另案人工批准。本 PR 不是那項批准。

## 歷史 SQL 含 data mutation 的警示

部分原始 SQL 含 `INSERT`／`UPDATE`／`DELETE`（例如預設列、約束前清理、mark-losers-failed）。這些語句只以歷史位元組原樣保存。

**絕不執行。** 本 archive 不授權在任何環境重跑它們。

## 檔案

- `manifest.json`：12 筆來源、checksum、blob SHA
- `sql/<migration-name>/migration.sql`：正好 12 個 byte-for-byte 檔

不含連線字串、password、token、secret、專案 ref、PII 或正式 row 內容。
