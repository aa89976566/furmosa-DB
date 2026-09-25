# 盤點：已退役 store-redeem Token 的可達性與資料流

日期：2026-08-15
性質：只讀靜態盤點。本文件是唯一允許產出。
不恢復公開核銷。不設計新 POS 核銷。不假設店家分類、佣金、結算或 POS 權限。

## 0. 固定現況與範圍

本盤點建立在最新 `origin/main`，且確認包含 #119 merge：

| 項目 | 值 |
| --- | --- |
| Base / 建立 branch 時的 HEAD | `c5748cc187ebc92a3e2392fc60849aa6d727d975` |
| 該 commit | `security: redirect retired store redeem URLs in middleware (#119)` |
| 已確認含此 merge | 是（`origin/main` 與此 branch 的 merge-base 皆為此 SHA） |
| 未沿用 dirty branch | 是（前一 Cursor 任務從 clean `origin/main` 新建；本遍延續同一乾淨 branch，未沿用其他 dirty changes） |
| 本遍是否另開新 branch | 否。既有 `cursor/audit-retired-store-token-reachability-3b63` 乾淨、僅含本文件、base 已是 `c5748cc`，依指示延續 |
| `main` 與 `origin/main` | 一致（當時與本遍核對時皆為此 SHA） |

先前已合併、本盤點視為既成事實：

- PR #110：公開 `POST /api/coupons` 固定 410，不讀 body。
- PR #118：公開 store-redeem 頁改為只導向 `/pos/login`；舊 `lib/stores/verify-store-access.ts` 已刪。
- PR #119：middleware 在渲染前把退役路徑 307 到 `/pos/login`。
- Production smoke（先前已做，本盤點不再重跑）：退役路由 307、coupon 410、health 200。

本盤點**沒有**讀 Vercel env、Supabase、Production DB，也沒有複製任何 Token 值。

### 秘密硬規則（本文件已遵守）

- 不寫 Token 完整值、部分值、前後碼、hash、checksum、fingerprint。
- 只記「此 file/symbol **存在固定 literal**」。
- 原始搜尋若含 literal，不貼進本文件。
- 歷史 migration / evidence 只列路徑，不複製列值。

### 允許方法

`rg`、git history、call-site / import graph、靜態資料流、純 source test 閱讀、`git diff --check`、秘密 / PII / project-ref 靜態掃描（只報檔名）。

### 禁止（本 PR 未做）

改 code / schema / migration / test / package / config / env；build / Prisma / SQL / DB / Vercel / Supabase；輪替或讀正式 Token；執行 sync / ensure / seed / cron / script；恢復舊核銷；設計新 POS 核銷；Ready / merge / deploy。

---

## 1. 七題必答（先看這裡）

### Q1. #118 / #119 之後，是否還有 request path 用 Token 授權？

**沒有。** 靜態可證的 request path 都不再比對 `Store.secretToken`。

- 公開 `/store-redeem`、`/store/<一段>`：middleware 只看 pathname，307 到 `/pos/login`，不讀 query、不讀 DB、不比對 Token。
- 若 middleware 被繞過，頁面也只 `redirect('/pos/login')`，不讀 Token。
- 公開 `POST /api/coupons`：固定 410，不讀入參。
- 舊比對函式 `verifyStoreAccessSegment` 已刪；測試把它標成不可達。
- 剩下的 `parseStoreAccessSegment` 只是字串切開，**沒有任何 runtime caller**。

**active auth callers = 0**

### Q2. 是否仍有 runtime 固定 Token writer？

**有。** 程式裡仍有兩條「建立 Store 時寫入 `secret_token`」的路徑：

1. **固定 literal writer（repo 內寫死的值）**
   `lib/stores/zhuwo-branches.ts` 的 `ZHUWO_CONSIGNMENT_BRANCHES[].storeSecretToken`（**3 個固定 literal，值不寫出**）
   → 只在 `ensureZhuwoConsignmentBranches` 發現該 `storeSlug` **不存在** 時，`store.create` 寫入。
   已存在的列只改 `name`，不改 Token。

2. **隨機 writer（不是 repo literal）**
   `syncPartnerStoreForJarExchangeMerchant` 用 `generateSecretToken()`（6 碼、`Math.random()`）在「slug 與店名都找不到 Store」時 `store.create`。
   已存在的列只改 `name`。

這兩條都**可能寫 Production `stores.secret_token`**（只在「列不存在」時）。本盤點沒有查正式庫現況。

會呼叫到這兩條的 runtime 入口：

| 入口 | 誰可觸發 | 寫入哪一種 |
| --- | --- | --- |
| HQ `createMerchantAction` | HQ 建立店家 | 隨機（若類型含程式已寫死的 `jar_exchange` 檢查） |
| HQ `updateMerchantShipping`（同檔後續同步） | HQ 更新店家 | 同上 |
| `GET`/`POST /api/admin/ensure-zhuwo` | HQ 已登入 | 先走隨機 sync，再對豬窩 slug 可能寫 literal |
| `GET`/`POST /api/cron/maintain-shipments` | cron 授權 | 同上 |

`syncAllJarExchangePartnerStores` 仍存在，但 **#117 之後沒有 request-path caller**（清單讀取不再同步）。測試把它標成不可在 list 時呼叫。離線若有人直接跑此函式，仍可能寫隨機 Token。

**active token writers = 2**（literal create + random create）

### Q3. route / UI / API 是否可能讀出或回顯 Token？

**公開路徑：靜態已證不會。** middleware 307、coupon 410、退役頁不讀 DB。HQ 核銷連結 UI 只組「slug 的 `/store-redeem?store=…`」，**不帶 Token 欄位**。

HQ 口味庫存頁會在 **server memory** 載入完整 `Store`（`findMany` 無 `select`；`include: { store: true }`）。靜態 call chain **已證**完整物件沒有進入 Client props / HTML / JSON / Server Action response。因此：

- **proven disclosure = 0**
- **possible disclosure = 0**
- RSC Flight **不稱為** possible disclosure

可另記 **unverified integration surface = 1**：沒有做真實 Flight smoke；但沒有可證的序列化資料流，故不算 disclosure，也不列 UNKNOWN。

其他 JSON：

- `/api/admin/ensure-zhuwo` 回傳店家 `merchantId` / `name` / `status` / `types`，不選 Token。
- cron 只回傳建立筆數，不回傳 Token。
- 未發現 `console.*` 印 `secretToken`。

#### flavours 實際 call chain（能證明才算 disclosure）

禁止用「有 `findMany` 無 select」直接當成外洩。必須一跳一跳看完整 `Store` 物件有沒有被序列化出去。

| Hop | 位置 | 實際發生的事 | Token 去向 |
| --- | --- | --- | --- |
| 1 | `app/(main)/jar-exchange/flavours/page.tsx` `RefillFlavoursAdminPage` | async Server Component，無 `'use client'`。`prisma.store.findMany({ orderBy })` 無 `select`；`merchantRefillStock.findMany({ include: { store: true, flavour: true } })`。 | 完整 `Store`（含 `secretToken`）只進 **Node 記憶體**。還不是 HTTP。 |
| 2 | 同一函式的 JSX | `stores.map` 只用 `s.id`（`<option key/value>`）與 `s.name`（顯示文字）。`stocks.map` 只用 `s.store.name`、口味名、數量、可選、時間。JSX **沒有** `secretToken` / `slug`。 | 縮成 id / name 字串。 |
| 3 | props → `JarShell` / `JarPanel` | `JarShell` 只收字串 `pathname` / `title` / `description`，以及已縮過的 `children`。兩個元件檔都沒有 `'use client'`。本頁 **沒有 import** 任何 `'use client'` 元件。 | **已證：完整 Store 物件未進 Client props。** |
| 4 | HTML | 此頁不是 JSON API。畫面上能看到的店家資料只有 id（表單值）與 name（文字）。 | **已證：HTML 不含 Token。** |
| 5 | `flavours/actions.ts`（`'use server'`） | 四個 action 回傳 `void`。`setRefillStockAction` 只讀 FormData 的 `storeId`（id），不 `find` Store、不回傳 Store。`copyRefillPeriodAction` 讀 `merchantRefillStock` 且 **不** `include store`。 | **已證：Server Action 回應不含 Token。** |
| 6 | 錯誤邊界 | `flavours/` 沒有自己的 `error.tsx`。上層 `app/(main)/error.tsx` 是 **Client Component**。畫面只顯示 `error.digest`，不顯示 `error.message`。`useEffect` 的 `console.error` 是 **browser console**，**不是 server log**。它收到的是 `Error`，不是 Store 物件。退役頁 `app/store-redeem/error.tsx` 會顯示 `error.message`，但 #119 後不應渲染，且現頁只 `redirect`、不讀 Token。 | **不列 server-log UNKNOWN。** 也不是 disclosure。 |
| 7 | RSC Flight | 靜態 call chain 已證完整物件未進入 Client props / HTML / JSON / Action response。本盤點**沒有**做真實 Flight smoke。 | **unverified integration surface = 1**（未做 smoke）。**不是** possible disclosure，**不是** UNKNOWN。 |

**結論：** proven disclosure = 0；possible disclosure = 0；unverified integration surface = 1。本 PR 不改 `select`、不抓 runtime。

### Q4. 移除 runtime literal 會不會破壞 HQ / merchant / cron / sync？

就**本 repo 靜態呼叫圖**而言：

- 清單、報表、核銷連結、公開頁、coupon API **都不讀 Token 值**。拿掉 literal **不會**讓這些讀路徑編譯或邏輯依賴失敗。
- `ensureZhuwoConsignmentBranches` 在「豬窩 slug 列不存在」時**依賴** `branch.storeSecretToken` 才能 `create`（欄位在 schema 是必填）。若只刪欄位、不改 create，**會壞**這條 ensure。
- 已存在的列：ensure / merchant sync 只更新 `name`，不讀 Token。移除 literal **不會**改變「已存在列」的更新行為。
- merchant sync 本來就用隨機產生器，**不讀**豬窩 literal。
- `prisma/import.ts` 只引用豬窩的店名 / 編號 / 城市，**不讀** `storeSecretToken`。

**結論：** 移除 literal 本身不破壞讀路徑。下一 code-only gate **維持「缺列才建立」**，不採 fail closed（不改成缺列就不建）。缺列寫入改用 **server-side CSPRNG 產生的不可預測 legacy placeholder**，**不使用**現有 6 碼 `Math.random()` `generateSecretToken()`。該 placeholder **不得被描述或使用為 auth credential**。店家分類 / 佣金 / 結算 / POS 權限仍屬 Step 4，本盤點不裁決。

### Q5. Production DB Token 是否需另行人工輪替 / 清空？

**本盤點不能回答「現在正式庫裡是什麼」。** 禁止讀正式列。

能確定的只有：

- schema 仍要求 `secret_token` NOT NULL。
- 歷史 migration 曾 INSERT 過此欄（值不複製）。
- runtime 仍可能在「列不存在」時寫入（literal 或隨機）。
- 已沒有 request path 用它當授權因子。

因此：**若目標是「正式庫不再持有可用 Token」→ 必須另開人工批准的 DB 作業（輪替或清空），本 PR 不做。**
標成 `DB_ROTATION_REQUIRED`（決策 / 人工），不是本盤點可執行的步驟。

現況是否已與 repo literal 相同、是否已被隨機值覆蓋 → **UNKNOWN-STOP（需 DB 才能判斷）**。

### Q6. 哪些 migration / evidence 必須原樣保留？

下列 migration **含 `stores.secret_token` 的建立或 INSERT**。必須當歷史不可變檔，**不要改寫、不要複製其中的值**：

1. `prisma/migrations/20260603180000_partner_stores/migration.sql`（建欄 + INSERT）
2. `prisma/migrations/20260603200000_jar_exchange_danshui_manlisa/migration.sql`
3. `prisma/migrations/20260615170000_sync_jar_exchange_stores/migration.sql`
4. `prisma/migrations/20260710190000_jar_exchange_qimu/migration.sql`
5. `prisma/migrations/20260721180000_zhuwo_consignment_branches/migration.sql`
6. `prisma/migrations/20260721190000_ensure_zhuwo_banqiao/migration.sql`

`docs/migration-evidence/`：**此份 `origin/main` 上沒有任何檔案。** 不臆造其他 PR 的 evidence 路徑。若日後分支才出現這類檔，同樣 `HISTORICAL_PRESERVE`，且不得把歷史值抄進新文件。

### Q7. 下一個最小 code-only gate；哪些需 DB 人工批准？

**下一個唯一小 gate（code-only，單一路徑，且不進入 Step 4）：**

> 維持「缺列才建立」語意（不採 fail closed）。
> 從 `ZHUWO_CONSIGNMENT_BRANCHES` 移除 `storeSecretToken` 固定 literal。
> `ensureZhuwoConsignmentBranches` 缺列建立時，用 **server-side CSPRNG** 產生不可預測的 **legacy placeholder** 寫入必填欄。
> **不使用**現有 6 碼 `Math.random()` `generateSecretToken()`。
> 該 placeholder **不得被描述或使用為 auth credential**（只是滿足 NOT NULL 的遺留欄位填充）。
> 不改 schema、不改 migration、不讀 / 不輪替正式列、不恢復核銷、不設計 POS。

既有列仍只改 `name`。正式庫舊值是否要輪替，屬 Q5 人工案，不是這個 gate。

**需人工批准、本盤點停止處：**

| 項目 | 為什麼不能在 code-only 做完 |
| --- | --- |
| 讀正式 `stores.secret_token` / 對照是否仍是舊值 | 禁止讀正式庫；**唯一 UNKNOWN-STOP** |
| 輪替或清空正式 Token | `DB_ROTATION_REQUIRED` |
| 刪除 / 改為可空 `Store.secretToken` | `SCHEMA_DECISION_REQUIRED` + migration |
| 改寫歷史 migration / evidence | 必須原樣保留 |
| 新 POS 核銷、店家分類、佣金、結算、POS 權限 | **Step 4，本盤點前必須停止** |

---

## 2. 呼叫圖（精簡）

```
公開 GET /store-redeem 或 /store/<一段>
  → middleware.isRetiredPublicStoreRedeemPath（只看 pathname）
  → 307 /pos/login
  → （備援）page redirect('/pos/login')
  → 不讀 Store、不比對 Token

公開 POST /api/coupons
  → 410 JSON，不讀 body

HQ GET /jar-exchange/stores、/admin/store-report
  → listPartnerStoresFromDb（select id, slug, name）
  → buildUnifiedStoreRedeemUrl(slug?)  → 只組 /store-redeem?store=slug
  → HTML 顯示 slug 網址，無 Token 欄位

HQ GET /jar-exchange/flavours
  → prisma.store.findMany() 完整列（只在 server memory）
  → merchantRefillStock include store:true 完整 Store（只在 server memory）
  → JSX / JarShell props / HTML / Server Action 只用 id / name（已證完整物件未序列化出去）
  → RSC Flight 未做真實 smoke = unverified integration surface（不是 disclosure，不是 UNKNOWN）

HQ 建立 / 更新店家
  → syncPartnerStoreForJarExchangeMerchant
  → 缺列則 store.create(secretToken: generateSecretToken())

HQ /api/admin/ensure-zhuwo  或  cron /api/cron/maintain-shipments
  → ensureZhuwoConsignmentBranches
  → 對每個豬窩分店先 syncPartnerStoreForJarExchangeMerchant（可能寫隨機 Token 到 mer_* slug）
  → 再確保 zhuwo_* slug：缺列則 store.create(secretToken: branch.storeSecretToken)  ← 固定 literal
```

已刪、不可達：

- `lib/stores/verify-store-access.ts` / `verifyStoreAccessSegment` / `FALLBACK_STORE_TOKENS`（#118）

仍存在但無 runtime caller：

- `parseStoreAccessSegment`
- `buildStoreRedeemUrl`（忽略 Token 參數）
- `syncAllJarExchangePartnerStores`（無 request-path caller）

---

## 3. 消毒矩陣

欄位說明：

- **role**：definition / read / write / compare / render / historical
- **surface**：public / HQ / merchant / cron / offline / dead
- **writes prod token**：此路徑是否可能對 Production `stores.secret_token` 做 INSERT/UPDATE
- **leaks to response**：是否進 HTML / JSON / header / Client props / Server Action response（RSC Flight 未做 smoke 時記 unverified surface，不稱 disclosure）
- **still auth factor**：現在是否仍用來授權
- **reachability**：REACHABLE / DEAD / HISTORICAL-IMMUTABLE / UNKNOWN-STOP（UNKNOWN 只用於正式庫現況）
- **future treatment**：見任務指定枚舉

| file/symbol | role | direct caller | transitive runtime entry | surface | writes prod token | leaks to response | still auth factor | reachability | future treatment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `prisma/schema.prisma` `Store.secretToken` → `secret_token` | definition | Prisma client 生成 | 任何 `store.create` | HQ / cron / offline | 欄位仍必填 | 否（schema 本身） | 否（欄位還在，但無 compare） | REACHABLE（結構） | SCHEMA_DECISION_REQUIRED |
| `lib/stores/zhuwo-branches.ts` `ZHUWO_CONSIGNMENT_BRANCHES[].storeSecretToken` | definition（**3 個固定 literal，值不寫出**） | `ensureZhuwoConsignmentBranches` | admin ensure、cron maintain-shipments | HQ / cron | 間接（被 ensure create 使用） | 否（非 HTTP；存在於 repo / server bundle） | 否 | REACHABLE | REMOVE_RUNTIME_LITERAL（缺列改 CSPRNG placeholder，非 auth） |
| `lib/stores/ensure-zhuwo-merchants.ts` `ensureZhuwoConsignmentBranches` → `store.create({ secretToken: branch.storeSecretToken })` | write | admin ensure route、cron maintain-shipments | 同上 | HQ / cron | **是（缺 zhuwo_* 列時）** | JSON 不含 Token | 否 | REACHABLE | REMOVE_RUNTIME_LITERAL（缺列仍建立；改 CSPRNG legacy placeholder，非 auth） |
| `lib/stores/ensure-zhuwo-merchants.ts` 既有列 `store.update({ name })` | write（只改名） | 同上 | 同上 | HQ / cron | 否（不寫 Token） | 否 | 否 | REACHABLE | NO_ACTION |
| `lib/stores/sync-merchant-stores.ts` `generateSecretToken` | write helper（6 碼 `Math.random()`，非 literal） | `syncPartnerStoreForJarExchangeMerchant` | HQ merchant create/update、ensure | HQ / cron | 間接 | 否 | 否 | REACHABLE | NO_ACTION（下一 gate **不使用**此函式） |
| `lib/stores/sync-merchant-stores.ts` `syncPartnerStoreForJarExchangeMerchant` → `store.create` | write | createMerchantAction、updateMerchantShipping、ensure、`syncAll…` | HQ / cron | HQ / cron | **是（缺 mer_* 或同名列時）** | 否 | 否 | REACHABLE | NO_ACTION（下一 gate 不改此路徑） |
| `lib/stores/sync-merchant-stores.ts` `syncAllJarExchangePartnerStores` | write orchestrator | **無 request-path caller** | 僅離線 / 誤呼叫 | dead / offline | 若被呼叫則是 | 否 | 否 | DEAD（request） | NO_ACTION（勿從 list 接回） |
| `app/(main)/merchants/create-merchant-action.ts` `createMerchantAction` | write caller | HQ 建立店家表單 | HQ | HQ | 可能（經 sync 缺列） | 否 | 否 | REACHABLE | NO_ACTION（下一 gate 不改此路徑） |
| `app/(main)/merchants/[id]/actions.ts` `updateMerchantShipping` 內 sync | write caller | HQ 更新店家 | HQ | HQ | 可能（經 sync 缺列） | 否 | 否 | REACHABLE | NO_ACTION（下一 gate 不改此路徑） |
| `app/api/admin/ensure-zhuwo/route.ts` GET/POST | write entry | HQ session `getCurrentUser` | HQ | HQ | 可能（ensure） | JSON 無 Token | 否 | REACHABLE | REMOVE_RUNTIME_LITERAL（隨 ensure；CSPRNG placeholder） |
| `app/api/cron/maintain-shipments/route.ts` GET/POST | write entry | `authorizeCronRequest`；`vercel.json` 日排程 | cron | cron | 可能（ensure） | JSON 僅筆數 | 否 | REACHABLE | REMOVE_RUNTIME_LITERAL（隨 ensure；CSPRNG placeholder） |
| `lib/stores/partner-stores.ts` `listPartnerStoresFromDb` | read | HQ stores 頁、store-report | HQ | HQ | 否 | 否（只 select id/slug/name） | 否 | REACHABLE | NO_ACTION |
| `lib/stores/partner-stores.ts` `resolvePartnerStoreBySlug` | read | 開戶 / 折價券店名解析等（不經 Token） | 視呼叫端 | HQ / 其他非公開核銷 | 否 | 否 | 否 | REACHABLE | NO_ACTION |
| `lib/stores/partner-stores.ts` `FALLBACK_PARTNER_STORES` | definition | list/resolve 連線失敗時 | HQ | HQ | 否 | 否（無 Token 欄） | 否 | REACHABLE | NO_ACTION |
| `lib/stores/redeem-url.ts` `parseStoreAccessSegment` | compare/parse（死碼） | **無 caller** | 無 | dead | 否 | 否 | 否 | DEAD | NO_ACTION（可另案刪死碼；非本 gate） |
| `lib/stores/redeem-url.ts` `buildStoreRedeemUrl` | render helper（忽略 Token 參數） | **無 runtime caller** | 無 | dead | 否 | 否 | 否 | DEAD | NO_ACTION |
| `lib/stores/redeem-url.ts` `buildUnifiedStoreRedeemUrl` | render | HQ stores 頁、`StoreRedemptionLinkPanel` | HQ | HQ | 否 | HTML 只有 slug 網址 | 否 | REACHABLE | NO_ACTION |
| `app/(main)/jar-exchange/stores/page.tsx` 核銷連結 UI | render | HQ 已登入頁 | HQ | HQ | 否 | HTML：slug URL，無 Token | 否 | REACHABLE | NO_ACTION |
| `components/admin/store-redemption-report-ui.tsx` `StoreRedemptionLinkPanel` | render | HQ `/admin/store-report` | HQ | HQ | 否 | 同上 | 否 | REACHABLE | NO_ACTION |
| `app/(main)/jar-exchange/flavours/page.tsx` `prisma.store.findMany()` 無 select | read | HQ 口味庫存頁 | HQ | HQ | 否 | **已證**未進 HTML / JSON / Client props / Action response | 否 | REACHABLE | NO_ACTION（RSC Flight = unverified surface，非 disclosure） |
| `app/(main)/jar-exchange/flavours/page.tsx` `include: { store: true }` | read | 同上 | HQ | HQ | 否 | 同上 | 否 | REACHABLE | NO_ACTION（同上） |
| `middleware.ts` `isRetiredPublicStoreRedeemPath` | render/redirect | 每個匹配請求最先執行 | public | public | 否 | 307 Location=`/pos/login`，不複製 query | 否 | REACHABLE | NO_ACTION |
| `middleware.ts` 內 HQ session 變數名 `token` | compare（**HQ cookie，不是 Store Token**） | HQ 路徑 | HQ | HQ | 否 | 否 | 否（與本盤點無關） | REACHABLE | NO_ACTION |
| `app/store-redeem/page.tsx` | render | 僅當 middleware 未攔到 | public（備援） | public | 否 | 不讀 Token | 否 | REACHABLE（備援 redirect） | NO_ACTION |
| `app/store/[access]/page.tsx` | render | 同上 | public（備援） | public | 否 | 不讀 path segment 當授權 | 否 | REACHABLE（備援 redirect） | NO_ACTION |
| `app/store/page.tsx` | render | `GET /store`（**不是** middleware 退役規則） | public | public | 否 | server redirect → `/store-redeem`（再被 middleware 307） | 否 | REACHABLE | NO_ACTION |
| `app/store-redeem/layout.tsx` | render | 理論上退役頁 layout；#119 後不應渲染 | public / dead | public | 否 | 無 Token | 否 | DEAD（被 middleware 擋住） | NO_ACTION |
| `app/store-redeem/error.tsx` | render | 僅錯誤邊界 | public / dead | public | 否 | 可能顯示 `error.message`；現路徑不產生 Token 錯誤 | 否 | DEAD | NO_ACTION |
| `app/api/coupons/route.ts` `POST` | compare（已關閉） | 公開 POST | public | public | 否 | 固定 410 文案，無 Token | 否 | REACHABLE（410） | NO_ACTION |
| merchant / POS coupon routes | — | **本 tree 無** `app/api/merchant/**` 或 POS 路由讀 `secretToken` | — | merchant | 否 | 否 | 否 | DEAD | NO_ACTION（不設計新 POS 核銷） |
| `lib/coupons/**` | — | 折價券服務 / 測試 | HQ / cron expire | HQ / cron | 否 | 否 | 否 | REACHABLE（與 Token 無關） | NO_ACTION |
| `lib/stores/verify-store-access.ts` `verifyStoreAccessSegment` | compare | 已刪（#118） | 無 | dead | 否 | 否 | 否 | HISTORICAL-IMMUTABLE（git） | HISTORICAL_PRESERVE |
| `FALLBACK_STORE_TOKENS` | definition | 已刪；`middleware.test.ts` 斷言原始碼不含此名 | 無 | dead | 否 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `app/store-redeem/retired-access.test.ts` 對已刪 helper 的 trap | historical / test | 測試 | 無 | dead | 否 | 否 | 否 | DEAD | NO_ACTION |
| `middleware.test.ts` 斷言不含 `FALLBACK_STORE_TOKENS` | historical / test | 測試 | 無 | dead | 否 | 否 | 否 | DEAD | NO_ACTION |
| `lib/stores/__tests__/partner-stores-read-only.test.ts` | test | 測試 list 不呼叫 sync | 無 | dead | 否 | 否 | 否 | DEAD | NO_ACTION |
| `prisma/import.ts` `ZHUWO_CONSIGNMENT_BRANCHES` | read（店名/編號，**不讀 storeSecretToken**） | 離線 import script | 無人在 request 呼叫 | offline | 否（此檔無 `store.create`） | 否 | 否 | DEAD（request） | NO_ACTION |
| `prisma/seed.ts`、`scripts/**` | — | **無** `secretToken` / `secret_token` 命中 | — | offline | 否 | 否 | 否 | DEAD | NO_ACTION |
| `prisma/migrations/20260603180000_partner_stores/migration.sql` | historical | 已套用 migration | 無 runtime | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `prisma/migrations/20260603200000_jar_exchange_danshui_manlisa/migration.sql` | historical | 已套用 | 無 | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `prisma/migrations/20260615170000_sync_jar_exchange_stores/migration.sql` | historical | 已套用 | 無 | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `prisma/migrations/20260710190000_jar_exchange_qimu/migration.sql` | historical | 已套用 | 無 | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `prisma/migrations/20260721180000_zhuwo_consignment_branches/migration.sql` | historical | 已套用 | 無 | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `prisma/migrations/20260721190000_ensure_zhuwo_banqiao/migration.sql` | historical | 已套用 | 無 | historical | 歷史曾寫 | 否 | 否 | HISTORICAL-IMMUTABLE | HISTORICAL_PRESERVE |
| `docs/migration-evidence/**` | historical | **此 main 無檔** | — | historical | — | — | — | HISTORICAL-IMMUTABLE（缺席） | HISTORICAL_PRESERVE（若他處出現亦同） |
| `.env.example` / 前端 env | — | **無** Store Token 變數名 | — | — | 否 | 否 | 否 | DEAD | NO_ACTION |

---

## 4. 計數

| 指標 | 數量 | 說明 |
| --- | --- | --- |
| active auth callers | **0** | 無 request path 比對 `Store.secretToken` |
| active token writers | **2** | literal create（ensure 缺 zhuwo_* 列）；random create（sync 缺列，6 碼 `Math.random()`） |
| writer 的 runtime 入口 | 4 | HQ create、HQ update、HQ ensure、cron maintain-shipments |
| proven response disclosures | **0** | 靜態已證：完整 Store 物件未進 Client props / HTML / JSON / Server Action response |
| possible disclosures | **0** | RSC Flight 不稱為 possible disclosure |
| unverified integration surface | **1** | flavours RSC Flight 未做真實 smoke；沒有可證序列化資料流 |
| UNKNOWN-STOP | **1** | 僅 Production DB token 現況 / 是否需人工輪替 |
| BLOCKED（Step 4） | 店家分類、佣金、結算、POS 權限、新核銷設計 | 本盤點停止，不實作 |

---

## 5. UNKNOWN-STOP / BLOCKED（完成其餘盤點後停止）

1. **UNKNOWN-STOP（唯一）：Production `stores.secret_token` 現況 / 是否需人工輪替**
   需讀正式列才能知道是否仍是歷史 / literal / 隨機值，以及是否要輪替。禁止讀。標 `DB_ROTATION_REQUIRED` 給人工。

2. **不是 UNKNOWN：** flavours RSC Flight
   靜態已證完整物件未進 Client props / HTML / JSON / Action response。未做真實 Flight smoke → **unverified integration surface = 1**，不是 disclosure。

3. **不是 UNKNOWN：** `app/(main)/error.tsx` 的 `console.error`
   這是 Client Component 的 `useEffect` **browser console**，不是 server log。收到的是 `Error`，不是 Store 物件。

4. **Step 4（明確停止）**
   不得在本盤點假設或實作：寄賣 / 換罐 / both、佣金、結算、POS 權限、新 POS 核銷。
   下一 gate **維持缺列才建立**，不在此決定 fail closed。

沒有發現「仍在用 Token 授權的 active request path」。若有，會在此停止並標 BLOCKED——**未發現，故 Q1 為 0。**

---

## 6. 靜態掃描（只報檔名，不貼原始輸出）

對工作樹做 `secretToken` / `secret_token` / `storeSecretToken` / `FALLBACK_STORE_TOKENS` 檔名盤點：

| 檔 | 備註 |
| --- | --- |
| `lib/stores/zhuwo-branches.ts` | **唯一 runtime 固定 literal 定義檔**（3 個 symbol） |
| `lib/stores/ensure-zhuwo-merchants.ts` | 寫入上述欄位 |
| `lib/stores/sync-merchant-stores.ts` | 隨機寫入 |
| `lib/stores/redeem-url.ts` | 死碼 parse / 忽略參數 |
| `prisma/schema.prisma` | 欄位定義 |
| 上列 6 個 `prisma/migrations/**/migration.sql` | 歷史 INSERT / 建欄 |
| `middleware.test.ts` | 只斷言**不含**舊常數名 |
| `app/store-redeem/retired-access.test.ts` | 只 trap 已刪模組名 |

未在 `app/store*` 頁、`app/api/coupons`、merchant/POS coupon、seed、scripts、`.env.example`、現有 `docs/**` 發現 Token **值** 或寫入。

PII / project-ref：本文件未加入任何 Supabase project ref、正式連線字串或秘密值。

本遍（延續同一 branch）再掃一次：`secretToken` / `secret_token` / `storeSecretToken` / `FALLBACK_STORE_TOKENS` 命中檔與上表相同，沒有新增 runtime 檔。`app/api/merchant/**` 存在（換罐訂單），但 **0** 次讀 Token。`parseStoreAccessSegment` / `buildStoreRedeemUrl` **0** 個 import caller。

`git diff --check`：僅本文件，無空白錯誤（見 commit 前檢查）。

---

## 7. 本 PR 做了什麼、沒做什麼

**做了：** 新增本文件；依 review 更正 disclosure / UNKNOWN / 下一 gate 用語。單一 commit。Draft PR。

**沒做：** 改程式、改 schema、跑 build / 測試執行期以外的 DB、輪替 Token、Ready、merge、deploy、Step 4。

---

## 8. 待確認（給人，不是給下一個 agent 自行實作）

1. 是否批准下一個唯一 code-only gate：維持缺列才建立；移除豬窩 `storeSecretToken` literal；缺列改寫 server-side CSPRNG legacy placeholder（不用現有 6 碼 `Math.random()`；placeholder 不是 auth credential）。
2. 是否另案批准正式庫 Token 人工輪替 / 清空（唯一 UNKNOWN）。
3. 是否另案批准 schema 拿掉或改可空 `secretToken`。
4. Step 4：店家分類、佣金、POS 權限——未開始，等待決策。
