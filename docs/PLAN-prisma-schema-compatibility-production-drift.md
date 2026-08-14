# PLAN — Prisma schema compatibility for Production drift（design-only）

**類型：** documentation-only／design-only
**狀態：** DRAFT — 未核准實作
**本 branch base / origin/main：** `e733f04435ed5cd811c241528deccd04944387c2`
**Prisma on main：** `^5.20.0`；`schema.prisma` generator **無** `previewFeatures`（含無 extendedIndexes）。
**本文件性質：** 唯讀盤點。讓 repository Prisma schema **解釋** Production 已存在物件的差距。不是 reconciliation 完成，不是授權改 schema，不是授權啟用功能。

## 固定證據（唯讀，不複製進 `prisma/migrations`）

| 輸入 | commit | 角色 |
|---|---|---|
| [PR #112](https://github.com/aa89976566/furmosa-DB/pull/112) | `aa6cfaecd317ac980c978b1bca62fed632ed6501` | 保留決策 |
| [PR #113](https://github.com/aa89976566/furmosa-DB/pull/113) | `b7604c778b3fbdc8780b5caec3ceaaa9d894d92f` | forward-reconciliation 設計 |
| [PR #114](https://github.com/aa89976566/furmosa-DB/pull/114) | `dd05550d64bdfcf8a59063260cd6ea78d05be6c0` | **12 筆 migration／checksum 唯一清單**（non-active evidence archive） |

#114 **不是** reconciliation 完成。Prisma 不讀該 archive，不修復 migrate status／drift。

## 不可談判的保留決策（#112）

- LINE morning 資料與結構：**PRESERVE — FEATURE DISABLED**。不得啟用發送、cron、新聞抓取、unfinished runtime。
- `refill_flavours.product_id` 非空 7 筆（2026-08-14 snapshot）：**PRESERVE — PRODUCTION DATA**。
- 其他零筆／零非空 DB-only objects：**UNRESOLVED — PRESERVE IN PLACE**。零筆 ≠ 可刪。
- [PR #111](https://github.com/aa89976566/furmosa-DB/pull/111) **持續 Draft／blocked**。
- `20260804160000_payment_order_active_unique` **只認** `155979e2c06775971a49e4ee8926f2acc9edb407`／checksum `dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`。**拒絕** `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161`。

## 分類規則（本設計遵守）

- **FIRST_CLASS_MODEL** 只在「既有 Production 資料需保留 **且** 未來正式 runtime 確需 Prisma 存取」時建議。Draft 功能 PR 不是正式 runtime 授權。
- 不得假設 `@@ignore` 可表達欄位、partial index、任意 constraint 或 seed row。
- Partial index／特殊 constraint 只列 **RAW_INDEX_OR_CONSTRAINT_EVIDENCE**，不新增 migration。
- Settings seed 與歷史 `UPDATE`／`DELETE` 屬 **DATA_ONLY_EVIDENCE**，不冒充 schema reconciliation。
- 零資料物件列 **NEEDS_SEPARATE_DECISION**，不得當可刪。

Status 枚舉：`MATCHED`／`PARTIAL`／`MISSING`／`NOT EXPRESSIBLE IN PRISMA`／`UNKNOWN-STOP`。

本盤點 **UNKNOWN-STOP = 0**、**BLOCKED mapping = 0**。main `schema.prisma` 可確定；12 筆來源／checksum 與 #114 一致。

---

## 1. 12/12 migration rollup

| # | migration | #114 checksum | 物件摘要 | rollup status | 主要 treatment |
|---|---|---|---|---|---|
| 1 | `20260803110000_jar_flavour_product_link` | `43371057…a4991f5e` | `product_id` 欄＋unique＋FK；7 筆正式關聯 | MISSING | NEEDS_SEPARATE_DECISION（資料保留；無已核准 first-class runtime） |
| 2 | `20260804120000_member_points_ledger_source_unique` | `49549168…e613e7f8` | 全欄 unique `(source_type, source_ref_id)`；曾 DROP 舊 non-unique index | PARTIAL | RAW_INDEX_OR_CONSTRAINT_EVIDENCE（model 已 first-class；unique 未宣告） |
| 3 | `20260804140000_refill_order_flavours` | `c3b40ff7…0f697d5d` | 口味／履行欄＋index／FK；`new_container_serial` **partial** unique | PARTIAL | 欄位 NEEDS_SEPARATE_DECISION；partial unique RAW／NOT EXPRESSIBLE |
| 4 | `20260804160000_payment_order_active_unique` | `dd723c6f…bbafa84` | partial unique；歷史 `UPDATE` mark-losers-failed | NOT EXPRESSIBLE IN PRISMA ＋ DATA_ONLY | RAW ＋ DATA_ONLY；來源鎖 `155979e2` |
| 5 | `20260804172000_payment_paid_dup_guard` | `66b9ca68…4bf30e99` | 同 #4 partial unique 再宣告；paid dup fail-fast | NOT EXPRESSIBLE IN PRISMA ＋ DATA_ONLY | 依賴 #4；不重跑、不改 #4 歷史檔 |
| 6 | `20260808060000_line_morning_mvp` | `e57db476…a05e009` | 5 tables＋indexes／FKs；settings seed INSERT | MISSING ＋ DATA_ONLY | NEEDS_SEPARATE_DECISION；FEATURE DISABLED |
| 7 | `20260808080000_line_morning_news_metadata` | `c4c953a8…53ea29e` | news 欄＋ingest table | MISSING | 同 morning 族；依賴 #6 |
| 8 | `20260808120000_campaign_application_line_profile` | `01254a38…8ef5bf33` | 2 nullable 欄 | MISSING | NEEDS_SEPARATE_DECISION；與 #9 同 timestamp、無依賴 |
| 9 | `20260808120000_line_morning_phase4b_a_domain` | `9b76f57d…c088aeca` | news license 欄；animal_facts；deliveries FK | MISSING | 依賴 #6+#7；與 #8 無依賴 |
| 10 | `20260808220000_line_morning_preference_confirm_ledger` | `b3f1dffe…d99dafdb` | confirm ledger table | MISSING | 邏輯依賴 #6；零列 PRESERVE IN PLACE |
| 11 | `20260810120000_line_morning_plan_ledger` | `b82f3ab6…5d662f25` | plan ledger table | MISSING | 邏輯依賴 #6；不得啟用 runner／cron |
| 12 | `20260811043000_refill_exchange_entitlement` | `28f65cf1…6839224` | entitlements table＋unique／index／FK | MISSING | NEEDS_SEPARATE_DECISION；FK 目標在 main 已存在 |

**Mapping coverage = 12/12。**

同 timestamp、無依賴：#8 與 #9。不可合併、不可互當來源。

---

## 2. Object-level mapping matrix

證據路徑皆相對 #114：`docs/migration-evidence/production-2026-08-14/sql/<name>/migration.sql`。不把這些檔放進 active tree。

### 2.1 `20260803110000_jar_flavour_product_link`

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `refill_flavours.product_id` | column | ADD COLUMN | `RefillFlavour` **無** `productId` | MISSING | NEEDS_SEPARATE_DECISION | 現 client 看不見此欄；誤加欄位會讓 generate 露出寫入 API | 空白 DB 若用新 migration 加欄會與 #114 bytes 分叉 | main `refillFlavour` upsert **不**讀寫此欄；加 first-class 可能誘使寫入 | 7 筆正式關聯不得清／覆寫 | 僅在已核准的正式 catalog runtime 需要 Prisma 存取時，才評估 FIRST_CLASS |
| `refill_flavours_product_id_key` | unique index | CREATE UNIQUE INDEX | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 無 client unique 名稱 | `migrate diff` 可能想建另一份 unique | 低（constraint 已在 DB） | 保護 7 筆唯一性 | 不新增 migration 重做此 index |
| `refill_flavours_product_id_fkey` | FK → `Product.id` ON DELETE SET NULL | ADD CONSTRAINT | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 無 relation | 空白 DB 新 FK ≠ 歷史 SQL | 低 | 保留關聯完整性 | 同欄位決策 |
| 7 筆非空 `product_id` | data | #112 snapshot count | schema 不描述列 | DATA 非 schema | DATA_ONLY_EVIDENCE | n/a | 禁止 backfill／UPDATE | 禁止當 Preview 殘留清掉 | **PRESERVE — PRODUCTION DATA** | 唯讀 count 另案授權 |

`Product` 在 main 已存在。未發現未記錄的外部 dependency。

**不建議現在 FIRST_CLASS：** 資料要留，但正式 runtime 尚未核准。FIRST_CLASS 會擴大 generated client，有覆寫風險。

### 2.2 `20260804120000_member_points_ledger_source_unique`

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `member_points_ledger_source_type_source_ref_id_key` | unique index `(source_type, source_ref_id)`（PG 允許多個 NULL） | CREATE UNIQUE INDEX；註解預檢 SELECT **不是**本檔執行的 mutation | `MemberPointsLedger` 有欄位；僅 `@@index([sourceType, sourceRefId])` **非** `@@unique` | PARTIAL | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | client 無此 unique；`appendPointsLedger` 仍寫入，DB 已 fail-closed | schema 仍宣告舊 non-unique index 語意；Production 已 DROP `…_idx`。`migrate diff` 可能想重建舊 index 或另建 unique | 不啟用新功能；只影響既有寫入競態 | **UNRESOLVED — PRESERVE IN PLACE**（零重複 ≠ 可 DROP） | 如何宣告 unique 而不生出不同 checksum 的新 migration → 另案 |
| DROP `member_points_ledger_source_type_source_ref_id_idx` | historical DDL | DROP INDEX | schema 仍用 `@@index` 描述同欄 | PARTIAL | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | shadow／empty 可能再造 non-unique index | 低 | 不得為了「對齊 schema」去 DROP Production unique | 隔離 diff 必須看到這項衝突 |

預檢 SELECT 註解屬文件，不是 DATA mutation。本檔 **不**刪列。

### 2.3 `20260804140000_refill_order_flavours`

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `refill_orders.preferred_flavour_id` | column | ADD COLUMN | `RefillOrder` 無 | MISSING | NEEDS_SEPARATE_DECISION | 加欄會露出寫入 | 新 migration ≠ #114 | main 無口味定案 runtime | snapshot 非空=0；**PRESERVE IN PLACE** | 零非空 ≠ 可刪 |
| `refill_orders.fulfilled_flavour_id` | column | ADD COLUMN | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 同上 | 同上 | 同上 |
| `refill_orders.fulfilled_by_user_id` | column（**無 FK**） | ADD COLUMN | 無 | MISSING | NEEDS_SEPARATE_DECISION | 若誤加 `User` relation 會多 dependency | 同上 | 同上 | 同上 | 不得假設有 User FK |
| `refill_orders_preferred_flavour_id_idx` | index | CREATE INDEX | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 空白 DB 重建 ≠ 歷史檔 | 低 | 保留 | 不重跑 |
| `refill_orders_fulfilled_flavour_id_idx` | index | CREATE INDEX | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 同上 | 低 | 保留 | 不重跑 |
| `refill_orders_preferred_flavour_id_fkey` | FK → `refill_flavours` | ADD CONSTRAINT | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 同上 | 低 | 保留 | 不重跑 |
| `refill_orders_fulfilled_flavour_id_fkey` | FK → `refill_flavours` | ADD CONSTRAINT | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 同上 | 低 | 保留 | 不重跑 |
| `refill_orders.new_container_serial` | column | 既有欄；本檔只加 unique | `RefillOrder.newContainerSerial` **MATCHED** | MATCHED | 已 first-class 欄位 | main 已讀寫 | 低 | 已在用 | 欄位保留 | 無 |
| `refill_orders_new_container_serial_key` | **partial** unique `WHERE new_container_serial IS NOT NULL` | CREATE UNIQUE INDEX … WHERE | schema **無** unique。`@@unique` 也**不能**表達此 WHERE | NOT EXPRESSIBLE IN PRISMA | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | client 無此 partial unique；DB 已約束 `newContainerSerial` 寫入 | 用完整 `@@unique` 冒充會與 Production 不完全等價 | 低（已 fail-closed） | snapshot 非空=0；unique **PRESERVE IN PLACE** | 禁止新增 migration 重做；禁止用非 partial unique「替代」 |

`refill_flavours`／`refill_orders` 在 main 已存在。`fulfilled_by_user_id` 無 FK，不是未記錄的 User dependency。

### 2.4 `20260804160000_payment_order_active_unique`（來源鎖）

**唯一來源：** `155979e2c06775971a49e4ee8926f2acc9edb407`。**拒絕** #90 current `43519603…`。不得覆蓋 ledger。

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `payment_orders_active_refill_purpose_key` | **partial** unique `(refill_order_id, purpose) WHERE status IN ('pending','paid')` | CREATE UNIQUE INDEX … WHERE | `PaymentOrder` 僅 `@@index([refillOrderId, purpose])` | NOT EXPRESSIBLE IN PRISMA | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | client 無 partial unique；`paymentOrder.create` 已受 DB 約束 | 任何新 SQL／#90 current 檔都是 stop | 不啟用新付款功能；影響既有建立路徑 | **PRESERVE IN PLACE** | 永遠拒絕 `43519603…` |
| 歷史 `UPDATE payment_orders … status='failed'`（mark losers） | data mutation | UPDATE | 非 schema | n/a（已發生） | DATA_ONLY_EVIDENCE | n/a | **禁止 replay** | 重跑會再改付款列 | 不得當 schema 相容步驟 | 只承認歷史已套用；不重做 |

`PaymentOrder`／`payment_orders` 在 main 已存在。

### 2.5 `20260804172000_payment_paid_dup_guard`

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| 同名 `payment_orders_active_refill_purpose_key` | partial unique 再宣告 IF NOT EXISTS | CREATE UNIQUE INDEX | 同 #4 | NOT EXPRESSIBLE IN PRISMA | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 同 #4 | 拆開 archive 會讓空白 DB 順序錯 | 同 #4 | 同 #4 | 依賴 #4 historical bytes |
| paid+paid fail-fast `DO $$ … RAISE` | guard（讀 count，不改列） | procedural SQL | 非 schema | n/a | DATA_ONLY_EVIDENCE | n/a | 禁止當 schema；禁止重跑 | 低 | #112 paid duplicate groups=0 是 snapshot | 不把 guard 寫成 Prisma enum／check |

### 2.6–2.7–2.9–2.10–2.11 LINE morning 族（FEATURE DISABLED）

main **無** `LineMorning*` models，app／lib **無** morning runtime（disabled by absence）。FIRST_CLASS 會生成 client 並提高接上 cron／send／ingest 的風險，**現在不建議**。`@@ignore` **未證明**不 DROP，且不能表達 seed／partial／任意 constraint → 不得當預設。

| Production object | type | evidence | schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `line_morning_preferences` | table＋unique／indexes | #6 CREATE TABLE | 無 | MISSING | NEEDS_SEPARATE_DECISION | first-class 會露出 model | 空白 DB 建整組 Draft 表 | **禁止**接 opt-in runtime | snapshot=0；結構屬 morning 保留 | 安全審查前不 FIRST_CLASS |
| `line_morning_contents` | table＋unique／index | #6 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 禁止當內容後台啟用 | snapshot=4；**PRESERVE — FEATURE DISABLED** | 不 DROP、不啟用 |
| `line_morning_news_items` | table＋unique／indexes | #6 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 禁止新聞發送 | snapshot=4 | 同 |
| `line_morning_deliveries` | table＋unique／indexes＋FK content／news | #6 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | **禁止 send path** | snapshot=0 | 同 |
| `line_morning_settings` | table | #6 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 露出 `master_enabled` 極危險 | 同上 | 啟用開關 | 結構保留 | 同 |
| `line_morning_settings` default 列 | seed INSERT `id='default', master_enabled=false` | #6 INSERT | 非 schema | n/a | DATA_ONLY_EVIDENCE | n/a | 禁止當 schema reconciliation；禁止重跑 INSERT | 重跑可能衝突 | snapshot default 列=1 | 只當歷史 seed |
| news metadata 7 欄＋`content_hash` unique＋source index | columns／indexes | #7 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 依賴 #6 | 禁止 ingest 啟用 | 隨 news 4 筆保留 | 同 |
| `line_morning_ingest_runs` | table＋index | #7 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | **禁止新聞抓取** | snapshot=2 | 同 |
| news license／provider 5 欄 | columns | #9 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 依賴 #6+#7 | 低（仍屬 morning） | 保留 | 與 #8 無依賴 |
| `line_morning_animal_facts` | table＋uniques／indexes | #9 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 禁止 fact runtime | snapshot=0 | 同 |
| `line_morning_deliveries.animal_fact_id`＋index＋FK | column／index／FK | #9 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 禁止 | snapshot 非空=0 | 同 |
| `line_morning_preference_confirm_ledgers` | table＋uniques／indexes | #10 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 邏輯依賴 #6 | 禁止 re-opt-in | snapshot=0 | 同 |
| `line_morning_plan_ledgers` | table＋unique／indexes | #11 | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 邏輯依賴 #6 | **禁止 plan runner／cron** | snapshot=0 | 同 |

Morning 內部 FK 不依賴 main 既有表。未發現未記錄的外部 dependency。

### 2.8 `20260808120000_campaign_application_line_profile`

與 #9 **同 timestamp、無依賴**。

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `campaign_applications.line_picture_url` | column | ADD COLUMN | `CampaignApplication` 無 | MISSING | NEEDS_SEPARATE_DECISION | 加欄可能誘使存頭像 URL | 新 migration ≠ #114 | main 不寫入 | snapshot 非空=0；**PRESERVE IN PLACE** | 零非空 ≠ 可刪；FIRST_CLASS 僅在已核准審核 UI 需要 Prisma 讀取時再議 |
| `campaign_applications.line_profile_synced_at` | column | ADD COLUMN | 無 | MISSING | NEEDS_SEPARATE_DECISION | 同上 | 同上 | 同上 | 同上 | 同上 |

`campaign_applications` 在 main 已存在。

### 2.12 `20260811043000_refill_exchange_entitlement`

| Production object | type | evidence | current schema | status | treatment | generated-client | migration／shadow | runtime activation | preservation | future gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `refill_exchange_entitlements` | table | CREATE TABLE | 無 | MISSING | NEEDS_SEPARATE_DECISION | first-class 會露出兌換資格 API | 空白 DB 建表 | main 無 entitlement runtime；加 model 可能誘使啟用 | snapshot=0；**PRESERVE IN PLACE** | 零列 ≠ 可 DROP |
| `refill_exchange_entitlements_returned_jar_code_id_key` | unique | CREATE UNIQUE INDEX | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 不重跑 | 低 | 保留 | 不重跑 |
| customer／merchant／expires indexes | indexes | CREATE INDEX ×3 | 無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 不重跑 | 低 | 保留 | 不重跑 |
| FKs → `Customer`／`jar_codes`／`Merchant` | FK | ADD CONSTRAINT ×3 | 目標 model 在 main **存在**；本表無 | MISSING | RAW_INDEX_OR_CONSTRAINT_EVIDENCE | 低 | 空白 DB 建 FK 需本表 | 低 | 保留 | 目標表不是新 dependency |

---

## 3. 必查項核對

| 必查 | 結果 |
|---|---|
| `product_id` 欄／unique／FK／7 正式關聯 | 欄／unique／FK 皆 MISSING；7 筆 DATA_ONLY；不 FIRST_CLASS |
| refill_orders 口味／`fulfilled_by`／`new_container_serial` 與索引 | 三新欄＋兩 index＋兩 FK MISSING；serial **欄 MATCHED**；serial unique **partial／NOT EXPRESSIBLE** |
| payment 兩 migration 的 partial unique 與歷史資料修正 | #4+#5 同一 partial unique NOT EXPRESSIBLE；#4 UPDATE 與 #5 fail-fast 皆 DATA_ONLY；#4 只認 `155979e2`／`dd723c6f…`，拒絕 `43519603…` |
| 全部 Morning tables／columns／FK／index／default settings | 皆 MISSING；settings INSERT 是 DATA_ONLY；runtime 必須保持 disabled |
| campaign LINE profile 欄 | 兩欄 MISSING；零非空 PRESERVE IN PLACE |
| entitlements table／unique／index／FK | 皆 MISSING；FK 目標已在 main |
| 兩筆同 timestamp 無依賴 | #8 與 #9 已標明 |
| #90 `04160000` 來源鎖 | 已鎖；archive 不含拒絕 checksum |

---

## 4. 未來驗證矩陣（只寫方法，不執行）

任何一列都 **尚未執行**。執行前必須有本設計核准與該列標示的人工批准。

| 驗證 | 目的 | 隔離環境 | 允許 | 禁止 | success | stop | 人工批准 |
|---|---|---|---|---|---|---|---|
| Empty DB replay | 看「若誤把 #114 SQL 或新相容 migration 放進 active tree」空白路徑會建什麼 | 從 exact main `e733f04` 新建空白 Postgres | 只跑 main 既有 migrations；對照本 matrix | 指向 Production；用正式資料；把結果當成可 merge | 能列出將被新建的 Draft 物件，且不碰正式 DB | checksum 分叉、出現 #90 `43519603…`、需要正式 secret | 要（建隔離 DB） |
| Schema-only Production clone | 在無 PII 下比對物件／index／FK／ledger **名字與 checksum** | schema-only dump／shadow；無業務 row | 讀物件目錄與 checksum | 複製 PII；可寫正式專案；`migrate resolve` | matrix 的 Production object 皆能對上 clone | 必須讀正式列內容才能繼續；發現未記錄 dependency | 要（取得 schema-only 產物） |
| Prisma validate／generate | 看現行 main schema 與「假設的相容宣告」會不會通過 | 隔離 checkout；不連 Production | `validate`／`generate` 在隔離目錄 | 改正式 schema 後直接 deploy；把 generate 當啟用 | main 現況可 generate；候選宣告的 diff 可列清單 | generate 需要連正式 DB；client 突然包含 morning send API 且無 disabled 閘 | 要（若動候選 schema 檔） |
| Migration status／drift | 證明 #114 不修 status；量化 DB ahead of main | 隔離；以 migrations folder vs schema vs schema-only clone 為 data source | read-only diff／status | 對 Production 跑 deploy／resolve | 顯示 12 筆 ahead；#114 目錄不改變結果 | 任何 ledger mutation；active tree 出現 12 檔 | 要（若連任何遠端） |
| Shadow DB | Prisma shadow 是否會對 extra unique／morning 表提出 DROP／CREATE | 本機／CI shadow，不是 Production | 觀察計畫 SQL | 對正式 DB 開 shadow；套用 destructive SQL | 計畫無 DROP 保留物件、無 replay 12 筆 | 計畫含 DROP／DELETE／UPDATE／backfill | 要 |
| Generated-client compile | first-class 建議會不會擴大可寫 surface | 隔離 `generate` + typecheck | 列新增 delegate | 合併 Draft 功能；接 cron | 能指出哪些 model 會出現 | compile 失敗被拿來「修」Production | 要（若產生候選 schema） |
| Read-only Production invariants | count／existence／checksum 是否仍符合 snapshot **機制**（非永久 invariant） | 另案、唯讀、無 PII | counts、null 檢查、ledger checksum | 讀完整 row；寫入；replay | 7 筆 product links 未被本工作改寫；Morning 未啟用 | 需要 PII／secret 才能解釋差異 | **要（每次）** |
| Runtime disabled state | Morning send／cron／news fetch／unfinished runtime 仍不存在 | 對 main 與候選 PR 做靜態路徑盤點 | grep／route 清單 | 新增 job、打開 `master_enabled`、merge #96–#101 | 無 send／cron／ingest 入口 | 任何啟用路徑出現 | 要（若要改 code；本 gate 不改） |

---

## 5. 明確不做（本 PR 與本 gate）

- 不改 `schema.prisma`、`prisma/migrations`、app／lib／scripts、package、config、env、workflow
- 不跑 Prisma、DB、SQL、clone、shadow
- 不改 Production／ledger／data
- 不 replay／rollback／DROP／resolve
- 不啟用 Morning／cron／news／unfinished runtime
- 不合併任何 Draft 功能 PR
- 不把 #114 稱為 reconciliation 完成
- 不新增 active migration 來「表達」partial index

---

## 6. UNKNOWN／BLOCKED

| 項 | 值 |
|---|---|
| UNKNOWN-STOP mapping rows | **0** |
| BLOCKED mapping rows | **0** |
| 未記錄 Production dependency | **未發現**（entitlement／product FK 目標皆在 main；`fulfilled_by_user_id` 無 FK） |
| 必須讀 Production DB 才能完成盤點 | **否**（#112 snapshot + #114 bytes + main schema 已足夠） |

若未來隔離驗證發現 schema 無法表達、或 clone 出現未列物件，該次驗證必須標 UNKNOWN-STOP，不得在本文件「順便」改分類去啟用功能。

---

## 7. 下一唯一 gate

**本設計核准之後的唯一下一 gate：**

在隔離環境做 **empty DB（exact main）＋ schema-only Production clone** 驗證本 matrix（加上 Prisma validate／generate／drift 的隔離觀察）。

- 仍 **不** 改 `schema.prisma`
- 仍 **不** 把 #114 SQL 移入 `prisma/migrations`
- 仍 **不** 啟用功能、不改 Production
- 仍 **不** 解禁 #111
- 之後若要寫 schema compatibility 實作 PR，必須再另設 gate 與人工批准

---

## 8. Stop conditions（沿用 #113，本文件不放寬）

checksum／來源不符、ledger mutation、DROP、資料清理、replay、需要 Production secret／PII、啟用 Morning、覆寫 7 筆 links、誤用 #90 current、無法證明空白 DB 與既有 DB 都安全、分類結果等於啟用功能 → 停止。
