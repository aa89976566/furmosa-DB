# PLAN — Production migration forward reconciliation（design-only）

**類型：** documentation-only／design-only
**狀態：** DRAFT — 未核准實作
**基準 main：** `e733f04435ed5cd811c241528deccd04944387c2`
**固定輸入：** [PR #112](https://github.com/aa89976566/furmosa-DB/pull/112) commit `aa6cfaecd317ac980c978b1bca62fed632ed6501` 的保留決策。本設計不得改寫那些決策，也不得修改 PR #112。
**本文件性質：** 只設計如何讓 repository migration history 與 Prisma schema **安全解釋** Production 已存在的 12 筆 `202608*` migration。不是實作、不是授權、不是 deploy。

Audit counts／ranges 沿用 incident #112 的 **2026-08-14 point-in-time SELECT-only snapshot**，不是永久 invariant。

---

## 1. Non-negotiable facts

- Production `_prisma_migrations` 有 **12 筆 finished、未 rollback** 的 `202608*` migration。`origin/main` 的 migration tree **一筆都沒有**。這是 DB history ahead of main。
- `20260804160000_payment_order_active_unique` **只認** historical commit `155979e2c06775971a49e4ee8926f2acc9edb407` 的 checksum 匹配版本（Production `dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`）。PR #90 current head checksum `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161` **不得列為可用來源，不得覆蓋 Production**。
- LINE morning `contents=4`／`news_items=4`／`ingest_runs=2`（2026-08-14 snapshot）：**PRESERVE — FEATURE DISABLED**。保留結構與資料；目前不得啟用發送、cron、新聞抓取或 unfinished runtime。
- `refill_flavours.product_id` 非空=7（2026-08-14 snapshot）：**PRESERVE — PRODUCTION DATA**。不得清除、覆寫、回滾或當 Preview 殘留。
- 其他目前零筆／零非空的 DB-only objects：**UNRESOLVED — PRESERVE IN PLACE**。零筆 ≠ 可刪；另案設計並取得人工授權前不得 DROP。
- [PR #111](https://github.com/aa89976566/furmosa-DB/pull/111) **持續 Draft／blocked**。本設計不是 #111 的解禁。
- 禁止刪改 `_prisma_migrations` ledger。禁止 rollback、replay、重跑這 12 筆 SQL。禁止把 Draft 功能 PR 當 remediation merge。

---

## 2. 12-entry manifest

可信來源 = 與 Production ledger checksum **byte-for-byte** 匹配的 **唯一** git commit。PR 編號只標事件來源，不代表 current head 可用。
**不得把 PR #90 current version 列為 `20260804160000` 的可用來源。**

| # | migration | Production checksum | 唯一可信 source | dependency | 已建立 object | main schema／runtime | 資料分類 | 風險 | 禁止 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `20260803110000_jar_flavour_product_link` | `43371057f2924128945b085e48b130cc69036b1acc2fdb501d0fbe45a4991f5e` | `6ad56dbd933ab8934deea286e5c35c70158ae4cb`／[#84](https://github.com/aa89976566/furmosa-DB/pull/84) Draft | 無（既有 `refill_flavours`） | `refill_flavours.product_id` + unique + FK | schema **無** `productId`；runtime 不讀寫此欄 | **PRESERVE — PRODUCTION DATA**（snapshot 非空=7） | 空白 DB 套用會加欄；漏宣告會讓 Prisma 看不見正式關聯 | 不得清 7 筆；不得當 Preview 殘留 |
| 2 | `20260804120000_member_points_ledger_source_unique` | `49549168d4e4b2f3301acdb8891ae4eec27374fd5ae50d1ea47de9a5e613e7f8` | `b3c17d3df8558233176065378c08039bb8029b83`／[#89](https://github.com/aa89976566/furmosa-DB/pull/89) Draft（#91 同檔匹配，非第二來源） | 無（既有 `member_points_ledger`） | unique `member_points_ledger_source_type_source_ref_id_key` | schema 僅 `@@index`，**無** `@@unique`；`appendPointsLedger` 仍會寫入 | **UNRESOLVED — PRESERVE IN PLACE** | 活 unique 已約束 main writers；競態 fail-closed | 不得 DROP unique；不得重跑 |
| 3 | `20260804140000_refill_order_flavours` | `c3b40ff7db5f579cc5d1992324f879df75333fb6a06d9910bc12c7710f697d5d` | `3adc941326064d40c6605616dd396cfe52c80b5d`／[#90](https://github.com/aa89976566/furmosa-DB/pull/90)（此檔 current 仍匹配；**不**授權 #90 的 `04160000`） | 無（既有 `refill_orders`／`refill_flavours`；**不**依賴 #1） | `preferred_flavour_id`／`fulfilled_flavour_id`／`fulfilled_by_user_id` + indexes／FKs；`refill_orders_new_container_serial_key` | schema 有 `newContainerSerial` 但 **無 unique**、**無** 口味履行欄；runtime 會更新序號 | 口味／履行欄與 `new_container_serial`（snapshot 非空=0）：**UNRESOLVED — PRESERVE IN PLACE** | 空白 DB 會建 Draft 欄；序號 unique 已約束 main writers | 不得 DROP；不得因零非空刪欄 |
| 4 | `20260804160000_payment_order_active_unique` | `dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84` | **僅** `155979e2c06775971a49e4ee8926f2acc9edb407`。**拒絕** #90 current `1977b27d0bb3f0bf4df5eef3874576aa4732e97c`（`43519603…`） | 無（既有 `payment_orders`） | partial unique `payment_orders_active_refill_purpose_key`；歷史版本含 mark-losers-failed 語意 | schema **無** 此 unique；runtime 會 `paymentOrder.create` | **UNRESOLVED — PRESERVE IN PLACE** | checksum 分叉；錯檔會讓 Production migrate 失敗或被誘使覆蓋 | **禁止 #90 current 當來源**；禁止覆蓋 ledger；禁止重跑 |
| 5 | `20260804172000_payment_paid_dup_guard` | `66b9ca6855ec1a2b6b2facf582765764941b31ebb656330ade45bcb44bf30e99` | `1977b27d0bb3f0bf4df5eef3874576aa4732e97c`／#90（此檔匹配） | **依賴 #4**（同一 unique 的 IF NOT EXISTS 再宣告＋ paid dup guard） | 再確認 `payment_orders_active_refill_purpose_key`；paid dup guard 語意 | 同 #4：schema 無此 unique | **UNRESOLVED — PRESERVE IN PLACE** | 與 #4 綁定；拆開 archive 會讓空白 DB 順序錯 | 不得單獨重跑；不得改 #4 歷史檔來「配合」此檔 |
| 6 | `20260808060000_line_morning_mvp` | `e57db4767e3f6ea8256fa167efb26396207f8125b708a7c59f42b5c61a05e009` | `b3b0740cf1042b52582a67a26acb0f3727243866`／[#96](https://github.com/aa89976566/furmosa-DB/pull/96) Draft | 無（新建 morning 域） | `line_morning_preferences`／`contents`／`news_items`／`deliveries`／`settings` + uniques／FKs | schema **無** morning models；main **無** morning runtime（disabled by absence） | contents 等有資料者：**PRESERVE — FEATURE DISABLED**；零筆 morning 表：**UNRESOLVED — PRESERVE IN PLACE**（結構仍屬 morning 保留） | 空白 DB 會建整組 Draft 表；誤接 code 會啟用發送 | 不得啟用 send／cron／抓取；不得 DROP |
| 7 | `20260808080000_line_morning_news_metadata` | `c4c953a8a86ba9739af04c6a70d8cb3d46a761d0bd572c467c8fee86153ea29e` | `d0853e3d3ad69358bef72811bb440840e4814c51`／#96 | **依賴 #6** | `news_items` metadata 欄＋`content_hash` unique；`line_morning_ingest_runs` | 無 schema／無 ingest runtime | ingest_runs snapshot=2 與 news=4：**PRESERVE — FEATURE DISABLED** | 空白 DB 會加欄與 ingest 表 | 不得啟用新聞抓取；不得清 4／2 筆 |
| 8 | `20260808120000_campaign_application_line_profile` | `01254a38b74cd34d8a0fc2cc3744924cad41a30fc46c4d4386b9d0878ef5bf33` | `138699c78252fdf63e4513874ff387a9cddca44a`／[#93](https://github.com/aa89976566/furmosa-DB/pull/93) Draft | 無（既有 `campaign_applications`） | `line_picture_url`／`line_profile_synced_at` | schema **無** 這兩欄；campaign runtime 不寫入 | **UNRESOLVED — PRESERVE IN PLACE**（snapshot 非空=0） | 與 #9 **同 timestamp、無依賴** | 不得因零非空 DROP |
| 9 | `20260808120000_line_morning_phase4b_a_domain` | `9b76f57d43493282555ae84f88755b6d05680211feda7c51888418e6c088aeca` | `2ecdfecf23c7579473341e72f7874df3dab92c7c`／[#97](https://github.com/aa89976566/furmosa-DB/pull/97) Draft | **依賴 #6 與 #7**（改 `news_items`／`deliveries`） | news license 欄；`line_morning_animal_facts`；`deliveries.animal_fact_id` + FK | 無 schema／無 runtime | facts／該欄：**UNRESOLVED — PRESERVE IN PLACE**；屬 morning 保留結構 | 與 #8 同 timestamp、**無依賴** | 不得與 #8 綁成單一檔；不得啟用 |
| 10 | `20260808220000_line_morning_preference_confirm_ledger` | `b3f1dffe5cdd2a8b974f3c4c677fa1051cd15d04bb28661b5ce57098d99dafdb` | `d5291877e8f9154a62949cdb5ab2b6c7f8605160`／[#100](https://github.com/aa89976566/furmosa-DB/pull/100) Draft | **邏輯依賴 #6**（SQL 新建獨立表） | `line_morning_preference_confirm_ledgers` + uniques | 無 schema／無 confirm runtime | **UNRESOLVED — PRESERVE IN PLACE**（snapshot=0） | 空白 DB 會建表 | 不得 DROP；不得啟用 re-opt-in |
| 11 | `20260810120000_line_morning_plan_ledger` | `b82f3ab6dd4089aba5ad89c83b63d3a83663629bd9d915f37e04f8ce5d662f25` | `94254bd1a5d9066bfb1eb75a75d18b493fd3ec00`／[#101](https://github.com/aa89976566/furmosa-DB/pull/101) Draft | **邏輯依賴 #6** | `line_morning_plan_ledgers` + uniques | 無 schema／無 plan runner | **UNRESOLVED — PRESERVE IN PLACE**（snapshot=0） | 空白 DB 會建表；誤接 runner 會排程發送 | 不得啟用 plan runner／cron |
| 12 | `20260811043000_refill_exchange_entitlement` | `28f65cf14d0035d8a4c0d62062e55c73388bbc8cc60adc67436c22a006839224` | `6c8bdb18067945ac20e8258d3df1392346bf59e5`／[#105](https://github.com/aa89976566/furmosa-DB/pull/105) Draft | 無（FK 指向 main 已有的 customer／jar_code／merchant） | `refill_exchange_entitlements` + uniques／FKs | schema **無** 此 model；main **無** entitlement runtime | **UNRESOLVED — PRESERVE IN PLACE**（snapshot=0） | 空白 DB 會建表 | 不得 DROP；不得當可淘汰 |

**Manifest row count = 12。**

---

## 3. Dependency graph

```text
[main 既有] refill_flavours
    └── 1. 20260803110000 jar_flavour_product_link     (獨立)

[main 既有] member_points_ledger
    └── 2. 20260804120000 points source unique         (獨立)

[main 既有] refill_orders + refill_flavours
    └── 3. 20260804140000 refill_order_flavours        (獨立；不依賴 1)

[main 既有] payment_orders
    └── 4. 20260804160000 payment active unique        (獨立；來源=155979e2 僅此)
          └── 5. 20260804172000 payment paid dup guard (依賴 4)

[main 既有] campaign_applications
    └── 8. 20260808120000 campaign LINE profile        (獨立)

[new] 6. 20260808060000 line_morning_mvp               (獨立根)
    ├── 7. 20260808080000 news_metadata
    │     └── 9. 20260808120000 morning phase4b-a      (依賴 6+7)
    ├── 10. 20260808220000 preference confirm ledger   (邏輯依賴 6)
    └── 11. 20260810120000 plan ledger                 (邏輯依賴 6)

[main 既有] customer / jar_codes / merchants
    └── 12. 20260811043000 refill_exchange_entitlement (獨立)

同 timestamp、無依賴：
  8. 20260808120000_campaign_application_line_profile
  9. 20260808120000_line_morning_phase4b_a_domain
  不可合併、不可互相當來源。
```

相依族：

| 族 | 成員 | 順序 |
|---|---|---|
| refill product link | 1 | 單獨 |
| points | 2 | 單獨 |
| refill order flavours／serial | 3 | 單獨 |
| payment | 4 → 5 | 4 必須用 historical `155979e2`，不可用 #90 current |
| campaign profile | 8 | 單獨；與 morning #9 同時戳但無關 |
| morning | 6 → 7 → 9；6 → 10；6 → 11 | runtime 全族 FEATURE DISABLED |
| entitlement | 12 | 單獨 |

---

## 4. 方案比較（僅設計，不執行）

共同約束：forward-only；不改 Production ledger；不重跑；不 rollback；不 DROP 保留資料；Morning 維持 disabled。

### A. byte-for-byte restore exact applied migration history

把 12 個 **已套用檔案的精確位元組** 放回 repository（來源必須是 manifest 的唯一可信 commit；#4 只能是 `155979e2`）。

| 維度 | 評估 |
|---|---|
| ledger checksum | 若檔案與 Production 完全一致，`migrate deploy` 在 **已存在 Production** 理論上應視為已套用、不重跑。#4 若誤用 `43519603…` 會 checksum mismatch，必須停止。 |
| 空白 DB 結果 | 若放進 **active** `prisma/migrations`，空白／Preview DB 會 **真的建出** Draft 表與欄。main 尚無對應 code。**不安全，除非另證。** |
| Production 是否重跑 | 正確位元組 → 應不重跑。錯位元組 → 失敗或被誘使「修 checksum」。 |
| Prisma drift | 只還原 history、不改 schema，drift 仍在。 |
| 資料風險 | Production 路徑若真的 skip，資料不動。空白 DB 路徑會造出空的 Draft 結構。 |
| runtime 啟用風險 | 還原 SQL 本身不啟用功能；但空白環境一旦有表，後續誤 merge Draft code 更容易接上。 |
| rollback 可行性 | 不需要、也不允許 rollback。此方案不能靠 rollback 救命。 |

### B. schema-only compatibility representation

只擴充 `schema.prisma`（欄位／model／index）去 **描述** 已存在物件，不把 12 筆 SQL 放進 active migrations。

| 維度 | 評估 |
|---|---|
| ledger checksum | **不修復**「DB ahead of main」。Production ledger 仍比 main tree 多 12 筆。 |
| 空白 DB 結果 | `migrate deploy` 不會因這 12 個名字建表。若有人對空白 DB 跑 `migrate dev` 產出 **新** migration，可能用不同 SQL／不同 checksum 再建一次。必須禁止這條旁路。 |
| Production 是否重跑 | 不放 12 檔則不會重跑這 12 筆。新的「相容 migration」若出現，有重跑／重複物件風險。 |
| Prisma drift | 可降低 client／schema drift；`migrate status` 的 history drift 仍在。 |
| 資料風險 | 宣告欄位不應改值；錯誤的 `@default`／backfill 想法必須禁止。7 筆 `product_id` 只能被描述，不能被覆寫。 |
| runtime 啟用風險 | 把 morning models 寫進 schema **不是** 啟用許可。必須同時保證無 cron／send／ingest。 |
| rollback 可行性 | 不適用。拿掉 schema 宣告不會刪 DB 物件，也不應刪。 |

### C. externally managed／ignored models

僅當 **Prisma semantics 可證明**：migrate／generate **不會 DROP**、不會對這些物件發出變更 SQL。

| 維度 | 評估 |
|---|---|
| ledger checksum | 不修復 history drift。 |
| 空白 DB 結果 | ignored models 通常不會被新建。空白 DB 會繼續缺少這些表。 |
| Production 是否重跑 | 不重跑 12 筆。 |
| Prisma drift | 對 **新建 morning／entitlement 表** 可能降低誤 DROP 風險。對 **已受 main 管理的表上的 extra unique**（points／payment／`new_container_serial`）**不能**用 ignore 藏起來；那些 index 已約束 live writers。 |
| 資料風險 | 若 Prisma 未來把 ignored 當可刪，有 DROP 風險。未證明前不可選。 |
| runtime 啟用風險 | ignore 有助維持「schema 看見但不驅動功能」；仍須禁止接 runtime。 |
| rollback 可行性 | 不適用。 |

**C 的適用範圍（設計預設）：** 最多只考慮 morning／entitlement 等 **main 尚不管理的表**。points／payment／serial／`product_id` unique **不適用 C**。未證明安全前，C 不是預設採用項。

### D. forward decommission

**目前明確排除。** 使用者已選擇保留 Morning 資料與結構、保留 7 筆 product links，以及零筆物件原地保留。本設計不得規劃 DROP／資料清理／功能淘汰 SQL。

---

## 5. 推薦方案

採用 **expand／compatibility、forward-only**。把工作拆成不同 PR／gate，不在單一 PR 同時「還原 history + 改 schema + 啟用功能」。

1. **Gate 0（本 PR）：** design-only。12-entry manifest、相依、方案與驗證方法。不改 repo 其他檔。
2. **Exact-history evidence archive PR（後續，須本設計核准）：** 只保存 12 筆 **已套用位元組** 的可驗證複本，來源鎖死 manifest。`#4` 只能來自 `155979e2`。預設放在 **非 active** 位置（不得直接進 `prisma/migrations`）。
   非 active archive 只保存 byte-for-byte 證據與 checksum；Prisma 不會讀取它，因此它不改變 Prisma migration history、不修復 migrate status/drift，也不代表 reconciliation 完成。
3. **Schema compatibility PR（後續，與 evidence archive 分開）：** 讓 Prisma **解釋** 已存在物件（至少：`product_id`、points unique、payment active unique、`new_container_serial` unique、morning／entitlement 結構）。不產生會在 Production 重跑的 SQL。Morning 宣告 ≠ 啟用。
4. **是否移入 active migration tree、建立 baseline、或採其他 reconciliation：** 本設計 **不得預設**。必須等 empty DB／schema-only clone 驗證及人工決策後另設 gate。在該 gate 之前 **禁止** 搬入 active `prisma/migrations`。即使日後另設 gate，仍須同時證明：
   - **已存在 Production：** checksum 全數匹配 → migrate 為 no-op，不重跑、不改 ledger、不改資料。
   - **空白 DB（從 exact main）：** 要嘛不建出未準備好的 Draft 結構，要嘛建出後仍 disabled 且有明確產品授權。目前 **沒有** 這項授權。
   - `#4` 絕不會變成 `43519603…`。

不採用 D。C 僅作 morning／entitlement 的備選，且須先通過第 6 節的 Prisma semantics 證明。

---

## 6. Validation design（只寫方法，不執行）

本節不是執行清單。任何實作 PR 都必須先有隔離環境與人工核准。

### 6.1 Isolated empty DB from exact main

- 從 `origin/main` `e733f04`（或當時已核准的後續 main）建 **全新空白** PostgreSQL。
- 只跑 main 既有 migrations。
- 用來回答：若誤把 12 檔放進 active tree，空白路徑會建出什麼。
- 禁止指向 Production。禁止用正式資料。

### 6.2 Isolated clone／shadow of Production schema

- 只複製 **schema／物件定義**（table／column／index／FK／ledger **名字與 checksum**）。
- **禁止**複製正式 PII 或完整業務 row。
- 用途：驗證「已存在 DB + 候選 repo」的 migrate 計畫是 no-op。
- 禁止可寫入正式專案的連線。

### 6.3 Manifest／checksum verification

- 對每一筆：`sha256(file bytes) == Production checksum`。
- `#4` 必須等於 `dd723c6f…`／`155979e2`。
- 任何 `43519603…` 或 #90 current `04160000` 檔案出現在候選 tree → **立即拒絕**。
- 必須正好 12 筆，不能多、不能少、不能改名。

### 6.4 Prisma schema compatibility／drift read-only check

- 用 read-only `migrate diff`／`migrate status` 類檢查（實作時再選不連 Production 的具體指令）。
- 目標：沒有 DROP、沒有「再 apply 12 筆」、沒有新的 destructive SQL。
- 本設計階段 **不跑** Prisma／migrate。

### 6.5 Assert no DROP／DELETE／UPDATE／backfill／replay

- 候選 SQL 與 Prisma 計畫不得含對這 12 個物件的 DROP。
- 不得 DELETE／UPDATE 既有資料，不得 backfill `product_id` 或 morning 列。
- 不得 `migrate resolve` 改 Production ledger。
- 不得 replay／rollback。

### 6.6 Assert Morning runtime 仍 disabled

- main 與候選 PR 都不得新增會發送、cron、新聞抓取或 unfinished morning runtime 的入口。
- 即使 schema 宣告 morning models，也必須能指出：無 cron、無 send path、無 ingest job。

### 6.7 Assert 7 product links

- 隔離驗證只核對 **count 與「值不被寫入」的機制**。
- 不得讀出或寫入具體 product／flavour 識別值到文件。
- 正式環境若做 status check，只能 count／null 檢查，且須另案人工授權。
- 目標：非空數保持 7，既有值不被覆寫。snapshot 的 7 不是永久 invariant，但 **本 reconciliation 不得改變它們**。

### 6.8 Assert #90 錯版本永遠被拒

- CI 或 review checklist：`20260804160000_payment_order_active_unique` 的 bytes 不得等於 `43519603aa4aec3fdb3fb061ae356327fc81feb108cdf5b3058a9a4539284161`。
- 唯一可接受 bytes：`dd723c6f2995961f11072cb767777984f2423d49650fefd5b6c9e61c3bbafa84`。

---

## 7. Rollout gates

嚴格順序。跳步 = 停止。

1. Incident [PR #112](https://github.com/aa89976566/furmosa-DB/pull/112) **approved**（保留決策成為已核准輸入；核准 ≠ 改 Production）。
2. **本 design PR approved**（仍是 documentation-only）。
3. **Exact-history evidence archive PR**（非 active；只存 byte-for-byte 證據與 checksum；Prisma 不讀取；不改變 migration history、不修復 migrate status/drift、不代表 reconciliation 完成；#4 = `155979e2`）。
4. **Schema compatibility PR**（與 3 分開；不啟用功能；不重跑 SQL）。
4a. **另設 gate（不得預設）：** 是否移入 active migration tree、建立 baseline、或採其他 reconciliation，必須等 empty DB／schema-only clone 驗證及人工決策。
5. **Isolated validation**（empty DB from main ＋ schema-only／無 PII shadow）。
6. **Read-only Production status check**（另案授權；只讀 counts／checksum／object existence）。
7. **Human Production authorization**（每次 mutation 單獨授權）。
8. 以上全部通過後，才 **重新評估** [PR #111](https://github.com/aa89976566/furmosa-DB/pull/111)。在此之前 #111 **保持 Draft／blocked**。

本 PR 停在第 2 步之前。不 Ready、不 merge、不 deploy、不開始第 3 步實作。

---

## 8. Stop conditions

出現任一項，立即停止，不得自行修復 Production：

- checksum mismatch（含 #4 變成 `43519603…` 或非 `155979e2` 位元組）
- 任何 `_prisma_migrations` ledger mutation
- DROP（table／column／index／FK）
- 資料清理、DELETE、覆寫、backfill
- migration replay／rollback／重跑 12 筆 SQL
- 需要 Production secret、token、連線字串或 PII 才能繼續
- 啟用 Morning 發送／cron／新聞抓取／unfinished runtime
- 覆寫或清除 7 筆 `product_id` 關聯
- 把 PR #90 current `04160000` 當來源
- 無法證明 **空白 DB** 與 **既有 Production** 兩條路徑都安全且不重跑
- 工作樹不乾淨、或與 #111／#112／功能 Draft 檔案重疊

---

## 9. Responsibility／RACI

| 活動 | Cursor／AI | 設計作者（本 PR） | 人工 reviewer | Production 批准人 |
|---|---|---|---|---|
| 寫 design／manifest | 可起草（非 R） | R | C | I |
| 核准 design | 不可 | C | R | A |
| 核准 incident #112 決策 | 不可 | I | R | A |
| 改 schema／migration／code | 不可在本任務 | 不可在本任務 | R（未來 PR 的 review） | A |
| 連 Production／跑 migrate | 不可 | 不可 | 不可擅自（非 R） | A（每次） |
| merge／deploy | **不可** | 不可 | R | A |
| 重新評估 #111 | 不可 | I | R | A |

標準 RACI（不得自創縮寫定義）：

- **R** = Responsible
- **A** = Accountable
- **C** = Consulted
- **I** = Informed

人工 reviewer 是執行 review 的 **Responsible**。Production 批准人是 **Accountable**。
連 Production／跑 migrate 的 Responsible 只能是另案授權的人工操作者，不是 Cursor、設計作者或 reviewer。
Cursor／AI **不得**自行 merge、deploy、migrate、`db push`、改 ledger、或操作 Vercel／Supabase 正式環境。
本文件不授予任何人 Production mutation 權限。

---

## 10. Open questions

只列還需要後續證據的技術問題。**不再詢問**已確認的保留決策（Morning 要留、7 筆 product links 是正式資料、零筆物件先原地保留、#90 current 不可用、#111 blocked）。

1. 精確歷史 SQL 應放在哪個 **非 active** 路徑，才能做 checksum 驗證、又不會被 `migrate deploy` 撿走？
2. 對 **main 已管理的表** 宣告 extra unique（points／payment／`new_container_serial`）時，如何避免空白 DB 的 `migrate dev` 生出 **另一份不同 checksum** 的新 migration？
3. Morning／entitlement 要用 first-class models 還是（在證明不 DROP 之後的）ignored models，才能讓 `migrate diff` 不提出刪表？
4. 無 PII 的 Production schema shadow 要用哪種唯讀、可重複的取得方式（例如 schema-only dump），且不需要把 secret 寫進 repo？
5. Exact-history evidence archive 之後，Preview／空白環境的預期是「繼續沒有這 12 個物件」還是「可有 dark schema 但 runtime disabled」？這會決定能不能把檔案移入 active tree；本設計不得預設答案。
6. 不連 Production 的 Prisma read-only drift 指令組合，要以哪一版 Prisma／哪兩個 data source（migrations folder vs schema vs schema-only shadow）為準？

---

## 11. Out of scope（本 PR）

- 任何 schema／migration／code／package／env 變更
- 執行 build、test、Prisma、migrate、SQL
- 連 Supabase／Vercel
- 修改 PR #112 或 PR #111
- 啟用 LINE morning
- 開始 Exact-history evidence archive 或 schema compatibility 實作
