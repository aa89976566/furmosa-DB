# POS 結算 v1 — 凍結 Prompt 與審核紀錄

## 0. 審核結論與基準

| 項目 | 內容 |
|---|---|
| 審核結果 | **v2 審核通過** |
| 審查模型 | Claude Opus 5（本檔作者）；提案原稿由 Grok 產出 |
| Prompt 版本 | v2-R1（＝v2 全文 ＋ R1 白名單路徑更正；詳見 §0.1） |
| 凍結文字 SHA256 | `1431ad834b39d1f170c3181926e13556f4dd92c989c00112126112874c4f7efe` |
| 雜湊計算方式 | `awk '/^<!-- FROZEN-PROMPT-BEGIN -->$/{f=1;next}/^<!-- FROZEN-PROMPT-END -->$/{f=0}f' docs/reviews/pos-settlement-v1.md \| sha256sum` |
| base commit | `d55164e0670f91a47ff488e177f09a2f46560098`（`origin/main`） |
| 分支 | `cursor/pos-settlement-v1-2033`（自上述 base 建立） |
| 交付方式 | 僅 draft PR。不 merge、不部署、不動正式資料 |
| 實作者／監督者 | 實作＝Cursor（本代理）；獨立逐檔 diff 驗收＝Codex。實作者不得自我驗收 |

本檔是本工作包的唯一權威規格。實作期間 §1 文字不得變更；需要變更範圍必須另取使用者授權、重新審核並另存新版本，不得覆寫本檔。

### 0.1 R1 更正紀錄（白名單路徑抄錄錯誤）

| 項目 | 內容 |
|---|---|
| 提出者 | 獨立監督（Codex 逐檔 diff）→ 使用者第六輪 R1 指令 |
| 錯誤內容 | 本檔初版 §1.4 新增清單第 2 項抄成單一檔 `lib/pos/settlement-sources.ts` |
| 原核准清單 | `lib/settlements/source-snapshot.ts`、`lib/settlements/write-settlement.ts`、`lib/settlements/read-snapshot.ts` |
| 錯誤版本 commit | `4a641b7`（保留於版本控制，不改寫） |
| 錯誤版本凍結文字 SHA256 | `86c00f33a190d9c20728271aba7806f1fc30251f376362a54cd78a626f2d8acd`（保留為證據） |
| 更正後凍結文字 SHA256 | `1431ad834b39d1f170c3181926e13556f4dd92c989c00112126112874c4f7efe` |
| 責任歸屬 | 本檔作者（重組 v1 → v2 時抄錄錯誤），非使用者指示錯誤 |

更正範圍**僅限**把該項還原為原核准的三個模組路徑並重新編號；白名單**未擴大**，其他任何條文未變更。R1 前已寫入的實作處置：

- `lib/pos/settlement-sources.ts`（R1 時尚未提交，屬 untracked）移至 `lib/settlements/source-snapshot.ts`，內容不變更語意，僅更新檔頭註解指向的相鄰模組路徑。
- `lib/pos/store-settlement.ts` 於 R1 前的未完成編輯以 `git checkout --` 逐檔還原（**未使用** `git reset --hard`），不影響任何其他工作。
- R1 前的未提交 diff、`git status`、提交紀錄與被移動檔原件已保存為證據（`/tmp/pos-settlement-evidence/`），並在 PR 說明中交代。

---

## 1. 凍結 Prompt v2 全文

<!-- FROZEN-PROMPT-BEGIN -->
### 1.1 目標

在 HQ 既有 `Settlement` 之上，讓 POS「對帳 → 確認結帳」能真正寫入一張**待核對草稿**與**來源唯一明細**，並讓 HQ 能以快照讀取同一份帳。保留既有庫存、歷史、登入權限與舊流程行為。只建 draft PR。

### 1.2 本輪例外與硬邊界

- `docs/POS-02-MIGRATION-PLAN.md` §2 規定「Production drift 未 reconcile 不可建 POS expand migration」。該文件的證據句已過期（`origin/main` 最後一筆 migration 已是 `20260907170000_add_outreach`），但正式庫 `_prisma_migrations` 現況未經驗證。本輪為**使用者明確核准的測試版例外**：只產生 migration 檔，**本輪任何資料庫都不套用**，不安裝資料庫。不得宣稱 POS-02 閘門已解除。
- 延伸既有 legacy `Settlement`，**不**啟動 POS-02 規劃的平行 `PosSettlementV2`。此為使用者第一輪明確決定，且 AGENTS.md 禁止另建平行系統。
- 稽核鏡像保留來源原始 Float 值，**不是** POS-01 的新佣金計算，**不引用** `TwdInteger`、不套用 POS-01 `roundPercentCommission`。
- 上線阻擋（必須在 PR 中誠實列出，缺一不可上線）：
  1. 正式 drift 未驗證；
  2. 真實資料庫並行與失敗注入測試未執行。
- 禁止：正式 migration、`db push`、seed、reset、資料更動、部署、正式 cron、正式環境變數操作。
- 禁止讀取或輸出密碼、金鑰、環境秘密與無關個資。

### 1.3 基準與分支

- base＝`origin/main` `d55164e0670f91a47ff488e177f09a2f46560098`，不得用落後的本地 HEAD。
- 分支＝`cursor/pos-settlement-v1-2033`，自 base 建立，工作樹必須乾淨，不得覆蓋他人既有變更。

### 1.4 白名單（只准改這些檔案）

新增：

1. `docs/reviews/pos-settlement-v1.md`
2. `lib/settlements/source-snapshot.ts` — 來源分類、canonical key、精度與 legacy 公式（純函式）
3. `lib/settlements/write-settlement.ts` — 交易寫入、來源鎖定、撤回與刪除守衛
4. `lib/settlements/read-snapshot.ts` — 新版身份判定、快照讀取與漂移不變條件
5. `prisma/migrations/20260911160000_pos_settlement_sources/migration.sql`
6. `lib/pos/__tests__/settlement-sources.test.ts`
7. `lib/pos/__tests__/settlement-persist.test.ts`
8. `lib/pos/__tests__/settlement-db-concurrency.test.ts`（需真實隔離資料庫，無則標記未執行）

修改：

9. `prisma/schema.prisma`
10. `lib/pos/store-settlement.ts`
11. `lib/pos/load-store-ledger.ts`
12. `app/pos/settle/actions.ts`
13. `components/pos/settle-workspace.tsx`
14. `app/(main)/merchants/(hub)/settlements/[id]/page.tsx`
15. `app/(main)/settlements/actions.ts`
16. `lib/labels.ts` — 只加 `cancelled`
17. `components/shared/status-badge.tsx` — 只加 `cancelled`
18. `lib/settlement-list-query.ts` — 只加 `cancelled` 篩選
19. `app/(main)/merchants/(hub)/settlements/page.tsx` — 只處理 `cancelled` 顯示與從財務有效總計排除
20. `lib/pos/__tests__/store-ledger.test.ts` — **只**把原 `SCHEMA_MISSING` 單一案例改為「寫入 flag 關閉時拒寫」，其餘 15 個案例不刪、不放寬
21. `docs/POS-02-MIGRATION-PLAN.md`、`docs/POS-02-PERSISTENCE-PROPOSAL.md` — **只**加本包例外註記，不重寫舊規則

新增模組**只有上列三個 `lib/settlements/*`**。不得另建 `lib/pos/settlement-sources.ts` 或任何其他新模組檔。

白名單外一律不得修改，包含 `lib/settlement-calc.ts`、`lib/merchant-settlement-sales.ts`、`middleware.ts`、`lib/auth*`、`lib/merchant-auth`、OMS、webhook、LINE、金流、點數、券面額、櫃檯售價、庫存寫入路徑。禁止順手 refactor、改樣式、改命名、升套件、改無關檔案。必須越界時立即停止並回報原因與影響，不得自行放寬。

### 1.5 來源規則

**寄賣銷售（consignment sale）**

- 只認 `MerchantStockTxn` 中 `type = 'sale'` 且 `unitPrice` 與 `commissionAmount` **皆已存值**的流水。
- 不得以現價、`Product.cost`、`MerchantWholesalePrice` 或 20%／30% 回推任何金額。
- 若 `companyRevenue` 已存值且與 `qty × unitPrice − commissionAmount` 差異超過 0.01，該筆列為**待確認**，不計金額、不鎖定、不靜默更正。
- canonical key：`consignment_sale:<txnId>`。

**店家代收現金（store collected）**

- 只認已付款且收款方為店家的現金（`paymentCollector = 'STORE'` 且 `fundDirection = 'STORE_TO_FURMOSA'` 且 `settlementStatus = 'UNSETTLED'`）。
- 不得與寄賣銷售現金重複計算。
- canonical key：`store_collection:<paymentId>`。

**優惠券補貼（coupon subsidy）**

- 只認已核銷且店家歸屬可靠者。歸屬可靠＝券的 `storeId` 命中 store slug、`merchant.merchantId` 或 `Store.id`。**只靠中文店名比對不算可靠**，列待確認。
- 面額例外規則保留：標準 200、豬窩 250，依既有資料，不重算。
- 兩個來源模型（`GroomingCoupon`、`RewardRedemption`）都必須有可靠 canonical key：`coupon:<正規化券號>`。券號缺失或空白 → 待確認。**禁止以資料列 id 充當券號再宣稱已去重。**
- 同一正規化券號在兩模型同時出現時，以 `GroomingCoupon` 為準，`RewardRedemption` 不重複計列。

**待確認（pending，不計金額、不鎖定、不占唯一鍵）**

- 缺可信成交價的進貨（`RestockRequest`／`RestockRequestItem` 無價格欄，核准時建立的 Order 行 `unitPrice = 0`）。
- 盤點減損（`type = 'adjust'` 且 `quantity < 0`）。
- 券號缺失／歸屬不可靠的券。
- 缺價或 `companyRevenue` 不符的銷售流水。

寄賣進貨**不是**買斷應付款。團購下單、可變抽成設定、補價流程**不在本包**，不得宣稱三模式已完成。

### 1.6 Schema 增量

新增 `SettlementSourceItem`：

- `id`、`settlementId`、`merchantId`、`sourceKind`、`sourceKey`、`direction`、`originalAmount`（Float，保留原值）、`quantity`、`unitPrice`、`commissionAmount`、`companyRevenue`、`occurredAt`、`relatedOrderId`、`sourceSnapshot`（Json）、`rulesVersion`、`voidedAt`、`createdAt`。
- `settlement` 關聯 `onDelete: Restrict`（稽核外鍵）；`merchant` 關聯沿用 `Cascade` 以免改變既有店家語意。
- **active canonical partial unique index**：`(merchantId, sourceKey) WHERE "voidedAt" IS NULL`。Prisma schema 無法表達，必須在同一份 `migration.sql` 手寫。

`Settlement` 新增（全部 nullable，不 backfill）：

- `rulesVersion String?`、`idempotencyKey String? @unique`、`payloadFingerprint String?`、`createdSource String?`
- `netPayableTwd Int?`、`storeCollected Int?`（新增金額欄一律整數台幣並驗範圍，不得用 Float）
- `intendedPaymentMethod String?`
- `sourceItems SettlementSourceItem[]`

legacy 欄位型別與語意**完全不變**（`grossSales`、`commissionRate`、`commissionAmount`、`rewardPayout`、`shippingFee`、`merchantOwesUs`、`payable` 仍為 Float）。

`migration.sql` 必須一次帶齊全部約束（PK、FK、index、partial unique、unique），**禁止先建裸表下一輪再補**。不得刪欄、不得改既有欄位型別、不得 cascade 刪稽核。

### 1.7 精度與 legacy 公式

- 來源原值逐欄保留，**不以容差抹掉半元**（例如 255 × 30% = 76.5 必須原樣存）。
- 加總使用 `Prisma.Decimal`（Prisma 5.20 內建），**不得新增任何 npm 套件**。
- 只在最後淨額四捨五入一次，採 half-away-from-zero。

公式（`G`＝寄賣銷售額、`C`＝已存分潤、`R`＝核銷券補貼、`S`＝運費、`K`＝店家代收現金）：

| 欄位 | 公式 |
|---|---|
| `grossSales` | `G = Σ(|quantity| × unitPrice)`，僅本次鎖定的寄賣銷售 |
| `commissionAmount` | `C = Σ(已存 commissionAmount)`，同一批流水，不重算 |
| `commissionRate` | `G > 0 ? C / G : 0` |
| `rewardPayout` | `R = Σ(核銷券面額)` |
| `shippingFee` | `S = 0`（POS v1 固定） |
| `storeCollected` | `K = Σ(店家代收現金)`，不重複含寄賣銷售現金 |
| `payable` | `C + R + S` |
| `merchantOwesUs` | `G − C − R − S + K` |
| `netPayableTwd` | 唯一一次 `halfAwayFromZero(merchantOwesUs)` |

`netPayableTwd` 為正＝店家應付公司；為負＝公司應付店家；為零＝相抵。

驗算範例：`G=1000, C=200, R=400, S=0, K=120` → `payable = 600`、`merchantOwesUs = 520`、`netPayableTwd = +520`。店家手上 1120，留 600，匯回 520。

比較容差：**只有** legacy Float 合計比較允許 0.01（與 HQ 既有漂移判斷一致）；新存的整數淨額必須完全相等。

### 1.8 寫入規則

- 伺服器端必須驗證 POS session（`requireMerchantSession()`），逐筆來源驗證店家歸屬與金額，不得信任瀏覽器傳入金額。
- `idempotencyKey = sha256(rulesVersion | merchantId | periodStart | periodEnd | sorted sourceKeys | intendedPaymentMethod)`。
- `payloadFingerprint = sha256(idempotencyKey | sorted 來源金額與方向 | legacy 合計)`。
- 付款方式**納入** key 與 fingerprint。送出後付款方式不可改；送出前改選會產生新的操作 key。
- 送出時伺服器必須重新計算來源集合並與預覽摘要比對，改變即拒絕，不得靜默改變整批內容。
- 同 key 同 payload → 回傳既有結算；同 key 不同 payload → 拒絕；部分重疊 → 整批拒絕。
- header、明細、來源鎖必須在**同一個交易**內完成。
- 真正的防線是資料庫唯一約束，不是先讀後寫。
- 寄賣銷售鎖 `MerchantStockTxn.settlementId` 時必須帶 `settlementId: null` 條件並做**筆數斷言**；筆數不符即回滾（修復既有搶鎖缺陷，屬本測試版必要修復）。
- 結算編號碰撞可有上限重試；**來源衝突不得被當成編號碰撞**處理。
- 並行同 key 必須回到同一張結算。
- HQ legacy 建立路徑保留自己的商業計算，只共用安全鎖定 helper；不得把人工補貼硬塞成券來源，不得宣稱 HQ legacy 建立已完全同源。

### 1.9 草稿與撤回規則

- POS 只建立 `status = 'draft'`，不寫 `paidAt`，不得標記已付款。
- 有來源時即可建立，即使淨額為零；完全沒有來源則不建立。
- POS 只能撤回**自己建立的新版草稿**：以交易內條件轉移至 `cancelled`、把自己的明細標 `voidedAt` 以釋放唯一鍵，保留稽核，之後可用新 key 重新結算。
- 必須以資料庫條件（`status = 'draft'`）與筆數斷言防止與 HQ 推進狀態競態。
- 不得撤回 `reviewing`／`approved`／`paid`。
- HQ 新版：伺服器與 UI 都禁止刪除帶有來源明細的結算；legacy 結算的刪除行為保留不變。
- 原 key 重送不得讓已撤回的結算復活。

### 1.10 讀取與 UI

- 新版身份**只按 `rulesVersion`** 判定，不得以「有沒有明細」猜測。
- 新版結算缺明細或版本未知 → 顯示可讀的完整性錯誤，不得 fallback、不得 500 白畫面。
- HQ 新版分支讀逐筆來源快照與共用淨額；legacy `calcSettlement` 路徑完全不變。
- POS 必須把**暫計**、**待確認**、**已送出紀錄**分開呈現，已送出者顯示同一編號與狀態。
- 只有 `status = 'paid'` 且有 `paidAt` 才可顯示已撥款字樣。
- 沿用既有 UI 元件與樣式，手機與桌機都必須可用。
- 新版伺服器寫入 flag 預設關閉；關閉時 UI 必須顯示可讀提示且**不得假裝成功**。flag 關閉不得讓任何已存在的新版紀錄從讀取面消失。
- 缺 schema 的環境同樣必須顯示可讀提示。
- 不得改動正式環境 flag。

### 1.11 測試

必須涵蓋：76.5 半元保留；正負半元；兩端同值一致；缺價與歸屬不可靠的券不鎖定；跨店拒絕；同 key／不同 payload／部分重疊／編號碰撞分類；零來源／零淨額；撤回競態／不復活；新舊分支與完整性錯誤。

- 保留 `lib/pos/__tests__/store-ledger.test.ts` 既有 15 個案例不變；第 16 個 `SCHEMA_MISSING` 案例改寫為「寫入 flag 關閉時拒寫並回傳明確 code」，並在 PR 說明改寫原因。
- 允許：`npx prisma generate`（純程式碼產生，**不得連資料庫**）、`npx tsc --noEmit`、`git diff --check`、以 `node --import tsx --test` 執行指定的 `lib/pos/__tests__/*.test.ts`。
- 禁止：直接 `npm test`（會連帶跑會寫資料庫的 `lib/jar-exchange` 測試）、`npm run build`、`prisma migrate`、`db push`、`seed`、`db:reset`。
- 需要資料庫的測試只能走專用 `SETTLEMENT_TEST_DATABASE_URL`，並以**正向白名單**檢查（loopback 主機＋專用測試資料庫名＋明確隔離確認）。不得 fallback 到 `DATABASE_URL`／`DIRECT_URL`，不得只用黑名單。
- 沒有隔離 PostgreSQL 時：測試碼照寫，並如實標記「未執行」。不安裝資料庫、不跑 migration。
- 資料庫測試碼必須涵蓋 HQ／POS 並行、失敗注入零殘留、撤回與狀態競態、重新結算歷史。

### 1.12 回復與交付

- 回復＝關閉新版寫入 flag，保留新版讀取與稽核。revert 不得讓 legacy 刪除路徑破壞已寫入的新版結算。
- 禁止降級、刪表、重算歷史。
- 每階段回報修改的檔案與原因。
- PR 必須誠實載明未執行項目；缺真實資料庫驗證即不可上線。
- Codex 負責獨立逐檔 diff 驗收。
<!-- FROZEN-PROMPT-END -->

---

## 2. Claude 三題與追問採用紀錄

審查模型：Claude Opus 5。提案原稿：Grok。以下為三題各自的結論與採用分類；每題都有至少一輪追問。

### 第 1 題 — 架構／資料來源／長期維護

問：延伸既有 HQ `Settlement` ＋ 來源唯一明細是否最小可靠？如何兼容舊 `settlementId` 與 HQ 刪草稿，避免兩套鎖重複結算？

| 項目 | 分類 | 說明 |
|---|---|---|
| 延伸既有 `Settlement`，不建平行系統 | **採用** | 符合使用者決定與 AGENTS.md；POS-02 的 `PosSettlementV2` 本包暫緩並加註記 |
| Grok 的「先讀後寫」並行防護 | **不採用** | READ COMMITTED 下會放行重複結算。改為資料庫唯一索引＋條件 `updateMany` ＋筆數斷言 |
| Grok 把 `calcSettlement` 納入白名單 | **不採用** | 會改動全部歷史結算顯示與漂移結果。改為唯讀 |
| Grok 的「待確認也寫 0 元明細」 | **不採用** | 會永久占用唯一鍵。改為待確認來源不寫入、不鎖定 |
| 兩套鎖共存設計 | **採用** | 新明細表為權威，`settlementId` 為相容鏡像，同一交易寫入、同時釋放 |
| 修復 `createSettlement` 搶鎖缺陷 | **採用** | 缺 `settlementId: null` 條件與筆數斷言，屬測試版必要修復 |

追問（使用者）：若禁止改 HQ 讀取頁，新結算多來源明細如何避免舊 `calcSettlement` 重算漂移？
結論：導出漂移不變量 —— 只要 `grossSales` 與 `commissionAmount` 僅取自本次鎖定且價格可信的寄賣銷售流水，HQ 既有 `|差異| > 0.01` 判斷就不會誤報。並修正白名單矛盾，把 HQ 明細頁納入白名單。

### 第 2 題 — UX／營運

問：如何呈現暫計金額、待確認項、draft／reviewing／paid 與重送返回既有結算，使 HQ／POS 一致且不誤認已付款？

| 項目 | 分類 | 說明 |
|---|---|---|
| 暫計／已送出快照／待確認三段分離 | **採用** | POS 畫面必須分開，避免暫計被當成已成立 |
| POS 只建 draft、不寫 `paidAt` | **採用** | 現行 `app/pos/settle/actions.ts` 的「結帳已完成。」是主要誤認風險，必須改 |
| 同 key 同 payload 返回原單 | **採用** | 重送不產生第二張 |
| 部分重疊整批拒絕 | **採用** | 不做部分成功 |
| 我原先建議的「明細層整數 half-up」 | **撤回（自我修正）** | 與 `lockedCommission` 相等要求在 76.5 例子下矛盾。改為只在最終淨額進位一次 |
| 我原先建議的「零頁面修改」 | **撤回（自我修正）** | 使用者指出不應為白名單犧牲正確性。改為最小 HQ 新版快照讀取分支 |

追問（使用者）：`note` 不足以構成完整共用帳務，且 HQ 舊頁仍提供刪除重算。
結論：HQ 新版伺服器與 UI 都禁止刪除帶明細的結算，legacy 刪除保留；並以 `onDelete: Restrict` 作為最後防線（先前建議的 `Cascade` 已撤回，稽核不得連帶刪除）。

### 第 3 題 — 風險／邊界／測試／回復

問：並行唯一約束、舊鎖條件與筆數斷言、同 key 不同 payload、券跨來源去重與店家隔離、取消是否本包先禁用、零額／負淨額、隔離 PostgreSQL 並行與失敗注入回滾。

| 項目 | 分類 | 說明 |
|---|---|---|
| 取消／撤回納入本包 | **採用**（使用者選 A） | 需手寫 partial unique index；並補齊 `cancelled` 標籤、樣式、篩選與總計排除 |
| 券 canonical key 必須可靠 | **採用** | 禁止以 id 充當券號宣稱去重；只靠店名歸屬列待確認 |
| 零來源不建立、零淨額可建立 | **採用** | |
| 隔離 PostgreSQL 並行與失敗注入測試 | **部分採用** | 本環境無 `psql`、無可用 docker、`DATABASE_URL`／`DIRECT_URL` 未設。測試碼照寫並標記未執行，列為上線阻擋 |
| 付款方式排除 fingerprint | **不採用**（使用者裁決） | 維持同 key 不同 payload 拒絕；送出後不可改，送出前改選產生新 key |

追問（使用者）：76.5 例子下明細 half-up 與 `lockedCommission` 完全相等矛盾；請比較最小 HQ 快照讀取分支與零頁面修改，不要為白名單犧牲正確性。
結論：兩項自我修正如上。另發現並回報 `Math.round(-76.5) = -76` 與 `Intl.NumberFormat` halfExpand `-77` 的負半元不一致，故明定 half-away-from-zero 並只進位一次。

### 使用者第五輪裁決（併入 v2）

1. drift 走更保守的 A：只產生 migration 檔，本輪任何資料庫都不套用，不安裝資料庫；正式 drift 未驗證與真實資料庫並行未執行都是上線阻擋。
2. 撤回走 A，並補齊 §1.4 第 14–18 項白名單。
3. 缺價不計、HQ 新版禁刪、無真實資料庫只寫測試碼並標記未執行，維持 v1。
4. 採用完整 legacy 公式（§1.7）；新增 `netPayableTwd`／`storeCollected` 為 nullable `Int` 並驗範圍。
5. 付款方式保留在 fingerprint。HQ 儀表板因新 draft 增加待核對筆數與 payable 屬預期；已作廢者排除有效總計。
6. 缺 schema 或 flag 關閉都必須可讀提示、不得假成功；新版身份只按 `rulesVersion`。

### 過期文件回報（AGENTS.md「文件判斷」）

- `docs/POS-02-MIGRATION-PLAN.md` §2 的證據句「`origin/main` 最後一筆 migration 仍是 `20260729170000_refill_flavours_stock`」已過期：base 上另有 `20260818233000` 至 `20260907170000` 共 8 筆。
- 文件過期不等於閘門已關。正式庫 `_prisma_migrations` 現況未經驗證，本輪不讀正式庫。
- POS-02 提案 §8 的「新表金額一律 BigInt」與 §11.2 的「新月結只讀 V2 整數列」與本包延伸 legacy `Settlement` 的決定衝突，已在該兩份文件加註本包例外，未重寫舊規則。

---

## 3. 未執行項目與上線阻擋

| 項目 | 狀態 | 原因 |
|---|---|---|
| 正式庫 migration 套用 | **未執行** | 本輪明確禁止；任何資料庫都不套用 |
| 真實 PostgreSQL 並行測試 | **未執行** | 環境無 `psql`、無可用 docker、無 `SETTLEMENT_TEST_DATABASE_URL` |
| 失敗注入回滾零殘留測試 | **未執行** | 同上 |
| 撤回與狀態競態的資料庫層測試 | **未執行** | 同上 |
| 正式 drift reconcile 驗證 | **未執行** | 需讀正式庫，未授權 |
| `npm run build` | **未執行** | 可能觸發資料庫遷移，未授權 |
| `npm test`（全量） | **未執行** | 會連帶執行會寫資料庫的 `lib/jar-exchange` 測試 |

**結論：本 PR 不具備上線條件。** 上線前必須補齊正式 drift 驗證與真實資料庫並行／回滾驗收。
