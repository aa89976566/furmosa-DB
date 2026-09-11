# INCIDENT 2026-08-14 — Production migration drift

**類型：** documentation-only
**狀態：** OPEN
**基準 main：** `e733f04435ed5cd811c241528deccd04944387c2`
**本文件性質：** 只記錄已完成的唯讀稽核與 2026-08-14 已確認的資料保留決策。沒有資料變更、沒有 remediation、沒有部署。
**Audit snapshot：** 本文所有 audit counts／ranges 皆為 **2026-08-14 的 point-in-time SELECT-only snapshot**，不是永久 invariant。之後的列數可能改變；不得把當日數字當成可刪除或可忽略的依據。

---

## 1. 摘要

Production `_prisma_migrations` ledger 有 **12 筆 `202608*` migration**。
`origin/main` 的 migration tree **一筆 `202608*` 都沒有**。

這是 **DB history ahead of main**：正式資料庫已經套用過這些變更，但 main 的 schema／code／active migrations 都還沒有對應內容。

這不是「main 比 Production 新、可以補跑 SQL」的情況。
也不是「把 Draft PR 直接 merge 就能對齊」的情況。

---

## 2. 完整 12 筆 ledger

全部 12 筆在 Production 皆為 **finished**，`rolled_back_at` 為空。
下表 checksum 為 Production ledger 記錄值；除特別標示外，與對應 source commit 的 `migration.sql` 檔案位元組 SHA-256 一致。

| # | migration | Production checksum (SHA-256) | source commit | PR | PR status | 備註 |
|---|---|---|---|---|---|---|
| 1 | `20260803110000_jar_flavour_product_link` | `43371057f2924128945b085e48b130cc69036b1acc2fdb501d0fbe45a4991f5e` | `6ad56dbd933ab8934deea286e5c35c70158ae4cb` | [#84](https://github.com/aa89976566/furmosa-DB/pull/84) | OPEN Draft | current head 檔案仍匹配 |
| 2 | `20260804120000_member_points_ledger_source_unique` | `49549168d4e4b2f3301acdb8891ae4eec27374fd5ae50d1ea47de9a5e613e7f8` | `b3c17d3df8558233176065378c08039bb8029b83` | [#89](https://github.com/aa89976566/furmosa-DB/pull/89)（[#91](https://github.com/aa89976566/furmosa-DB/pull/91) 亦含同檔） | OPEN Draft | current heads 檔案仍匹配 |
| 3 | `20260804140000_refill_order_flavours` | `c3b40ff7db5f579cc5d1992324f879df75333fb6a06d9910bc12c7710f697d5d` | `3adc941326064d40c6605616dd396cfe52c80b5d` | [#90](https://github.com/aa89976566/furmosa-DB/pull/90) | OPEN Draft | current head 檔案仍匹配 |
| 4 | **`20260804160000_payment_order_active_unique`** | **`dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`** | **僅 `155979e2c06775971a49e4ee8926f2acc9edb407`** | [#90](https://github.com/aa89976566/furmosa-DB/pull/90) | OPEN Draft | **見下方特別標示** |
| 5 | `20260804172000_payment_paid_dup_guard` | `66b9ca6855ec1a2b6b2facf582765764941b31ebb656330ade45bcb44bf30e99` | `1977b27d0bb3f0bf4df5eef3874576aa4732e97c` | [#90](https://github.com/aa89976566/furmosa-DB/pull/90) | OPEN Draft | current head 檔案仍匹配 |
| 6 | `20260808060000_line_morning_mvp` | `e57db4767e3f6ea8256fa167efb26396207f8125b708a7c59f42b5c61a05e009` | `b3b0740cf1042b52582a67a26acb0f3727243866` | [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | OPEN Draft | current head 檔案仍匹配 |
| 7 | `20260808080000_line_morning_news_metadata` | `c4c953a8a86ba9739af04c6a70d8cb3d46a761d0bd572c467c8fee86153ea29e` | `d0853e3d3ad69358bef72811bb440840e4814c51` | [#96](https://github.com/aa89976566/furmosa-DB/pull/96) | OPEN Draft | current head 檔案仍匹配 |
| 8 | `20260808120000_campaign_application_line_profile` | `01254a38b74cd34d8a0fc2cc3744924cad41a30fc46c4d4386b9d0878ef5bf33` | `138699c78252fdf63e4513874ff387a9cddca44a` | [#93](https://github.com/aa89976566/furmosa-DB/pull/93) | OPEN Draft | current head 檔案仍匹配 |
| 9 | `20260808120000_line_morning_phase4b_a_domain` | `9b76f57d43493282555ae84f88755b6d05680211feda7c51888418e6c088aeca` | `2ecdfecf23c7579473341e72f7874df3dab92c7c` | [#97](https://github.com/aa89976566/furmosa-DB/pull/97) | OPEN Draft | current head 檔案仍匹配 |
| 10 | `20260808220000_line_morning_preference_confirm_ledger` | `b3f1dffe5cdd2a8b974f3c4c677fa1051cd15d04bb28661b5ce57098d99dafdb` | `d5291877e8f9154a62949cdb5ab2b6c7f8605160` | [#100](https://github.com/aa89976566/furmosa-DB/pull/100) | OPEN Draft | current head 檔案仍匹配 |
| 11 | `20260810120000_line_morning_plan_ledger` | `b82f3ab6dd4089aba5ad89c83b63d3a83663629bd9d915f37e04f8ce5d662f25` | `94254bd1a5d9066bfb1eb75a75d18b493fd3ec00` | [#101](https://github.com/aa89976566/furmosa-DB/pull/101) | OPEN Draft | current head 檔案仍匹配 |
| 12 | `20260811043000_refill_exchange_entitlement` | `28f65cf14d0035d8a4c0d62062e55c73388bbc8cc60adc67436c22a006839224` | `6c8bdb18067945ac20e8258d3df1392346bf59e5` | [#105](https://github.com/aa89976566/furmosa-DB/pull/105) | OPEN Draft | current head 檔案仍匹配 |

### 特別標示：`20260804160000_payment_order_active_unique`

- Production ledger checksum **只** 與歷史 commit `155979e2c06775971a49e4ee8926f2acc9edb407` 的檔案位元組匹配。
- PR #90 **current head** `1977b27d0bb3f0bf4df5eef3874576aa4732e97c` 的同名檔案 checksum 為 `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161`。
- **#90 current head 不匹配 Production。禁止用 #90 新版本覆蓋 Production ledger 或重跑該 SQL。**
- Production 套用的是較舊的「mark losers failed」版本，不是 #90 現在這份。

---

## 3. Ledger 狀態與禁止事項

- 12 筆全部 `finished_at` 有值。
- 12 筆全部 `rolled_back_at` 為空（未 rollback）。
- 不得刪除 `_prisma_migrations` ledger 列。
- 不得 rollback。
- 不得重跑這些 SQL。
- 不得把上述 Draft 功能 PR 當成 remediation 直接 merge。
- 不得把這些檔案直接放進 main 的 active `prisma/migrations` 當成「archive 完成」。

---

## 4. Object audit

唯讀確認：與這 12 筆相關的 table／column／index／FK **均存在**。

**新建 tables（10）：**

- `line_morning_preferences`
- `line_morning_contents`
- `line_morning_news_items`
- `line_morning_deliveries`
- `line_morning_settings`
- `line_morning_ingest_runs`
- `line_morning_animal_facts`
- `line_morning_preference_confirm_ledgers`
- `line_morning_plan_ledgers`
- `refill_exchange_entitlements`

**既有表新增欄位／約束（摘要）：**

- `refill_flavours.product_id` + unique + FK
- `refill_orders.preferred_flavour_id` / `fulfilled_flavour_id` / `fulfilled_by_user_id` + indexes + FKs
- `refill_orders_new_container_serial_key` unique
- `payment_orders_active_refill_purpose_key` partial unique
- `member_points_ledger_source_type_source_ref_id_key` unique
- `campaign_applications.line_picture_url` / `line_profile_synced_at`
- `line_morning_news_items` metadata／license 欄位
- `line_morning_deliveries.animal_fact_id` + FK

**完整性計數（無 PII；2026-08-14 point-in-time SELECT-only snapshot，非永久 invariant）：**

| 檢查 | 結果 |
|---|---|
| `line_morning_settings` default 列 | **1** |
| paid duplicate groups | **0** |
| ledger source duplicate groups | **0** |

---

## 5. Data audit

只記錄 counts／ranges。不含 PII、不含完整 row。
下列數字全部是 **2026-08-14 point-in-time SELECT-only snapshot**，不是永久 invariant。

| 對象 | count |
|---|---|
| `line_morning_contents` | 4 |
| `line_morning_news_items` | 4 |
| `line_morning_ingest_runs` | 2 |
| `line_morning_preferences` | 0 |
| `line_morning_deliveries` | 0 |
| `line_morning_animal_facts` | 0 |
| `line_morning_preference_confirm_ledgers` | 0 |
| `line_morning_plan_ledgers` | 0 |
| `refill_exchange_entitlements` | 0 |
| `refill_flavours.product_id` 非空 | 7 |
| `refill_orders.new_container_serial` 非空 | 0 |
| refill order 新口味／履行欄（`preferred_flavour_id` / `fulfilled_flavour_id` / `fulfilled_by_user_id`）非空 | 0 |
| campaign LINE profile 欄（`line_picture_url` / `line_profile_synced_at`）非空 | 0 |

---

## 6. 風險

- **不能直接把這 12 筆 archive 進 main 的 active `prisma/migrations`。** 空白／新環境若跑這份 archive，會把 Draft 功能表與欄位建出來，但 main 沒有對應 schema／code。
- **不能用 PR #90 現在的 `20260804160000_payment_order_active_unique` 覆蓋 Production。** checksum 已分叉；覆蓋或重跑會破壞 ledger 真實歷史。
- **main 的 schema 與 code 缺失這些物件的正式定義。** Prisma 會忽略多餘 table／column，但多餘的 unique index 仍會約束現有 main writers（點數 ledger、付款建立、`newContainerSerial` 更新）。競態可能在 DB 層 fail-closed。
- **空白 DB 跑 archive ≠ 與 Production 對齊。** 會新建 Draft 表，並可能套用錯誤版本的 payment unique SQL。

---

## 7. Business decisions — 2026-08-14

以下為使用者已確認的資料保留決策。這些決策**不**授權啟用功能、不授權改 Production、不授權 DROP。

### LINE morning：PRESERVE — FEATURE DISABLED

- 保留 `line_morning_contents`（snapshot=4）、`line_morning_news_items`（snapshot=4）、`line_morning_ingest_runs`（snapshot=2）及其相關結構。
- 相關 morning tables／columns／indexes／FKs 一併保留，不得當成可直接 decommission 的物件。
- **目前不得啟用**發送、cron、新聞抓取或 unfinished runtime。
- 未來只有在完整安全審查後，才可另案接回功能。本文件不是接回許可。

### `refill_flavours.product_id`：PRESERVE — PRODUCTION DATA

- snapshot 的 **7** 筆非空關聯視為**正式 Production 資料**。
- 不得清除、覆寫、回滾，也不得當成 Preview 殘留處理。
- 不得暗示這 7 筆可以連同 Draft 功能一起淘汰。

### 其他目前零筆／零非空的 DB-only objects：UNRESOLVED — PRESERVE IN PLACE

- 包含（但不限於）：其他 morning 表（preferences／deliveries／facts／confirm／plans）、`refill_exchange_entitlements`、campaign LINE profile 欄、refill order 新口味／履行欄、`refill_orders.new_container_serial`（snapshot 非空=0）與其 unique。
- **零筆不代表可刪除。**
- 另案 forward-only 設計完成並取得人工授權前，不得 DROP 這些物件。

約束類物件（點數 source unique、payment active unique／paid dup guard、`new_container_serial` unique）同樣維持原地保留；零重複／零非空不是刪除理由。

---

## 8. Containment

在另案設計與另行人工授權之前，強制遵守：

- 禁止刪改 `_prisma_migrations` ledger。
- 禁止 rollback、replay、重新執行這 12 筆 SQL。
- 禁止用 PR #90 current checksum `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161` 覆蓋 Production。`20260804160000_payment_order_active_unique` **只認** historical commit `155979e2c06775971a49e4ee8926f2acc9edb407` 的匹配版本（Production checksum `dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`）。
- [PR #111](https://github.com/aa89976566/furmosa-DB/pull/111) **保持 Draft／blocked**。不得 merge、不得 deploy、不得在 Production 跑其 migration。
- 不得把 Draft 功能 PR（#84／#89／#90／#91／#93／#96／#97／#100／#101／#105）當成 remediation 直接 merge。
- 不得把這 12 筆直接放進 main 的 active `prisma/migrations`。
- 不得啟用 LINE morning 發送、cron、新聞抓取或 unfinished runtime。

---

## 9. Gate

- 本 incident **不是** #111 的修復，也不是那些 Draft 功能 PR 的合併許可。
- 2026-08-14 保留決策已記錄於第 7 節。下一步**不是**實作 reconciliation，也不是啟用功能。
- **下一 gate：** 另開 **design-only** forward reconciliation。先做 12-entry manifest（checksum／source／dependency／object mapping）。設計驗證**僅**可在隔離 empty DB／clone 進行。
- 該 design-only 工作**不得**啟用功能，**不得**修改 Production。
- 任何 Production mutation（含 ledger、schema、資料、deploy、migration）都需要**另行人工授權**。本文件不構成授權。

---

## 10. 分類（2026-08-14 已確認，不得解讀為可直接 decommission）

### PRESERVE — FEATURE DISABLED

- LINE morning 全部相關結構，含有資料的 contents／news_items／ingest_runs，以及目前零筆的 preferences／deliveries／facts／confirm／plans
- 目前不得啟用發送、cron、新聞抓取或 unfinished runtime

### PRESERVE — PRODUCTION DATA

- `refill_flavours.product_id` 的 7 筆非空關聯（2026-08-14 snapshot）及其 unique／FK

### UNRESOLVED — PRESERVE IN PLACE

- `refill_exchange_entitlements`（snapshot=0）
- campaign LINE profile 欄（snapshot 非空=0）
- refill order 新口味／履行欄（snapshot 非空=0）
- `refill_orders.new_container_serial`（snapshot 非空=0）與其 unique
- 點數 source unique、payment active unique、paid dup guard

零筆／零非空／零重複都**不是** DROP 或 decommission 的許可。Morning 與 7 筆 product links **不可**被解讀為可直接淘汰。

---

## 11. Incident status

| 欄位 | 值 |
|---|---|
| Status | **OPEN** |
| Data mutation performed | **no** |
| Remediation deployed | **no** |

本文件只記錄現況與 2026-08-14 保留決策。沒有執行 archive、沒有改 ledger、沒有 rollback、沒有重跑 SQL、沒有 merge Draft 功能、沒有 deploy、沒有啟用 LINE morning。

---

## 12. Evidence

來源只限：

**Supabase SQL Editor SELECT-only + Git/GitHub history**

本文件不放連線字串、secret、PII、完整 row 內容。
