# POS 結算 v1 — 凍結 Prompt 與審核紀錄

## 0. 審核結論與基準

| 項目 | 內容 |
|---|---|
| 審核結果 | **v2 審核通過** |
| 審查模型 | Claude Opus 5（本檔作者）；提案原稿由 Grok 產出 |
| Prompt 版本 | v2-R3（＝v2 全文 ＋ R1／R1 補充白名單更正 ＋ R2／R3 規格缺陷修訂；詳見 §0.1–§0.4） |
| 凍結文字 SHA256 | `c75cf101e3964d0c8ac7fdfdcb1ccd4ebb1260c2ba06e83f588727fb98663dd2` |
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
| 責任歸屬 | 本檔作者（重組 v1 → v2 時抄錄錯誤），非使用者指示錯誤 |

更正範圍**僅限**把該項還原為原核准的三個模組路徑並重新編號；白名單**未擴大**，其他任何條文未變更。R1 前已寫入的實作處置：

- `lib/pos/settlement-sources.ts`（R1 時尚未提交，屬 untracked）移至 `lib/settlements/source-snapshot.ts`，內容不變更語意，僅更新檔頭註解指向的相鄰模組路徑。
- `lib/pos/store-settlement.ts` 於 R1 前的未完成編輯以 `git checkout --` 逐檔還原（**未使用** `git reset --hard`），不影響任何其他工作。
- R1 前的未提交 diff、`git status`、提交紀錄與被移動檔原件已保存為證據（`/tmp/pos-settlement-evidence/`），並在 PR 說明中交代。

### 0.2 R1 補充更正紀錄（測試、元件與可修改清單仍抄錯）

| 項目 | 內容 |
|---|---|
| 提出者 | 使用者第七輪「R1 範圍複查補充」 |
| 錯誤版本 commit | `3cd74d4`（R1 更正版，仍有抄錯，保留不改寫） |
| 錯誤版本凍結文字 SHA256 | `1431ad834b39d1f170c3181926e13556f4dd92c989c00112126112874c4f7efe`（保留為證據） |
| 更正後凍結文字 SHA256 | 見 §0 表格 |
| 責任歸屬 | 本檔作者。**凍結文件不得優先於使用者原指令**；以原 v1／v2 訊息為準 |

| 抄錯項 | 文件原寫（錯） | 原核准（正確） |
|---|---|---|
| 新增測試檔 | `lib/pos/__tests__/settlement-sources.test.ts`、`settlement-persist.test.ts`、`settlement-db-concurrency.test.ts` | `lib/settlements/__tests__/source-snapshot.test.ts`、`write-settlement.test.ts`、`read-snapshot.test.ts`、`postgres-settlement.test.ts`、`lib/pos/__tests__/store-settlement-v1.test.ts` |
| 新增元件 | 抄漏 | `components/settlements/snapshot-detail.tsx` |
| 可修改檔 | 抄漏 | `lib/pos/store-ledger.ts` |

文件原寫的三個 `lib/pos/__tests__/settlement-*.test.ts` **不得建立**。更正僅限清單本身，白名單未擴大到任何未經核准的檔案。

### 0.3 R2 規格缺陷審核紀錄

使用者第七輪以獨立驗收 `a99bb46` 提出六項缺陷，全部經審核**確認為真實缺陷**並修復；審核另發現第 7 項同類缺陷，一併修復。

缺陷 4、6 與 §1.7 的讀寫口徑屬**原規格本身的缺口**，不只是實作偏差。使用者在 R2 中已明確指示所需行為，故依授權最小幅度修訂 §1.5、§1.7、§1.8、§1.10 對應條文並重新計算凍結雜湊；舊雜湊全部保留於 §0.1、§0.2 作為證據。其餘條文未變更。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | 撤回後 `activeSources` 為空且原淨額非零即報錯 | **確認** | 撤回會把全部明細標 `voidedAt`，但 header 是送出當時的不可變快照。改為以**保留的全部稽核來源**驗 header；`cancelled` 只從有效統計排除，不清零歷史 |
| 2 | 未知非空版本被接受、`netPayableTwd ?? 0` 捏造金額 | **確認** | `hasSourceSnapshot()` 只檢查非 null。改為未知版本與缺必要欄位一律 fail closed，並加驗 `storeCollected` 與 `payable` |
| 3 | 讀取用 JS 浮點累加、寫入用 `Prisma.Decimal` | **確認** | 半元邊界可得出不同整數淨額，而整數淨額要求完全相等。讀寫改為共用同一個 `Prisma.Decimal` 函式 |
| 4 | `idempotencyKey` 無操作識別 | **確認** | 撤回後同來源永遠命中原 cancelled 列，無法重新結算。加入伺服器端推導的操作序號（該來源集合已作廢的嘗試次數）：同次重送固定、撤回後可再建、舊 key 仍回原 cancelled、付款方式仍在 key 與 fingerprint |
| 5 | `amountsDigest` 漏 `quantity`／`unitPrice`／`companyRevenue` | **確認** | `2×100` 改 `4×50` 時 `originalAmount` 不變即被當成同 payload。補齊三個欄位 |
| 6 | `dedupeSources` 無條件取 `GroomingCoupon` | **確認** | 面額或歸屬衝突被靜默解掉。改為僅在兩邊完全一致時視為同一張券鏡像；衝突則**兩邊都不認列**、產生 `COUPON_SOURCE_CONFLICT` 待確認、不占唯一鍵 |
| 7 | `SettlementSourceItem.merchant` 用 `onDelete: Cascade` | **確認（審核追加）** | 刪店家會連帶刪掉新帳務稽核列。改 `Restrict`；既有 `Settlement.merchant` 不動。同時補上 migration 完整性 CHECK 漏掉的 `storeCollected` |

### 0.4 R3 規格缺陷審核紀錄

使用者第八輪（獨立測試 `81c7ae8`：82／82 通過）提出五項缺陷。全部經審核**確認為真實缺陷**，其中第 3 項在審核時再收緊一層。

五項都屬**原規格本身的缺口**，不只是實作偏差；使用者在 R3 已明確指示所需行為，故依授權最小幅度修訂 §1.5、§1.8、§1.10、§1.11 對應條文並重新計算凍結雜湊。舊雜湊保留於 §0.1、§0.2、本節作為證據。其餘條文未變更，白名單未擴張。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | 預覽未排除已被 active canonical 鎖定的券與付款 | **確認** | 寄賣銷售靠 `MerchantStockTxn.settlementId` 過濾，但券與代收付款沒有欄位鎖，唯一鍵就是它們的鎖。已結過的金額會重複出現在暫計，送出才被資料庫擋下，變成看得到卻永遠送不出去的數字。新增 `loadActiveSourceKeys()`（限定本店）並在預覽排除，另回傳被排除筆數供 UI 說明 |
| 2 | 重送會另建新單 | **確認** | 送出成功會鎖住來源而使新預覽變空、撤回會讓操作序號改變，兩者都算出新 key。原實作先算新 key 再寫，重按一次會得到「沒有可結算項目」或第二張結算。改為**先用預覽當時的 key 查本店原單**，找到即回原單；指紋不符則拒絕；瀏覽器帶回的 key 只用於查詢比對，不參與金額也不用於建立 |
| 3 | 同碼券只比面額與方向 | **確認（審核再收緊）** | 同一券號可能在兩系統綁到不同顧客或不同店。改為面額、方向、顧客與店家**全部一致**才算鏡像。審核追加：兩模型的店家歸屬必須先正規化成 `Merchant.id`，否則 slug／`merchantId`／`Store.id` 會把同一家店判成兩家；且「不一致」與「缺身分」必須分開代碼（`COUPON_SOURCE_CONFLICT`／`COUPON_MIRROR_AMBIGUOUS`），兩者都全列 pending |
| 4 | 快照未驗撤回狀態一致性 | **確認** | 撤回是整張操作。`cancelled` 必須全列已作廢、其他狀態必須全列 active；原測試接受 draft 部分作廢並宣稱「仍以全部稽核來源驗算」，等於允許半套資料照 header 顯示金額。新增 `verifyVoidState()` 並改寫該測試為 fail closed |
| 5 | 未知 `sourceKind`／非法金額／缺必要 sale 欄位會變成 500 | **確認** | `computeLegacyTotals` 的 `else` 分支把未知種類默默當成代收現金加進淨額，`assertIntegerTwdRange` 遇 NaN 直接拋例外。新增 `validateSnapshotSources()` 於任何加總之前擋下並回可讀訊息；`computeLegacyTotals` 對未知種類改拋 `UnknownSourceKindError` 而非沉默錯帳 |

R3 修訂前的凍結雜湊：`c0ea26fc084632914c9676f26b26b36e5c97d48c3d00e88159ce9b0e10935312`（commit `7ed36a1`）。

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
5. `components/settlements/snapshot-detail.tsx` — 新版快照明細呈現元件
6. `prisma/migrations/20260911160000_pos_settlement_sources/migration.sql`
7. `lib/settlements/__tests__/source-snapshot.test.ts`
8. `lib/settlements/__tests__/write-settlement.test.ts`
9. `lib/settlements/__tests__/read-snapshot.test.ts`
10. `lib/settlements/__tests__/postgres-settlement.test.ts`（需真實隔離資料庫，無則標記未執行）
11. `lib/pos/__tests__/store-settlement-v1.test.ts`

修改：

12. `prisma/schema.prisma`
13. `lib/pos/store-ledger.ts`
14. `lib/pos/store-settlement.ts`
15. `lib/pos/load-store-ledger.ts`
16. `app/pos/settle/actions.ts`
17. `components/pos/settle-workspace.tsx`
18. `app/(main)/merchants/(hub)/settlements/[id]/page.tsx`
19. `app/(main)/settlements/actions.ts`
20. `lib/labels.ts` — 只加 `cancelled`
21. `components/shared/status-badge.tsx` — 只加 `cancelled`
22. `lib/settlement-list-query.ts` — 只加 `cancelled` 篩選
23. `app/(main)/merchants/(hub)/settlements/page.tsx` — 只處理 `cancelled` 顯示與從財務有效總計排除
24. `lib/pos/__tests__/store-ledger.test.ts` — **只**把原 `SCHEMA_MISSING` 單一案例改為「寫入 flag 關閉時拒寫」，其餘 15 個案例不刪、不放寬
25. `docs/POS-02-MIGRATION-PLAN.md`、`docs/POS-02-PERSISTENCE-PROPOSAL.md` — **只**加本包例外註記，不重寫舊規則

新增檔案**只有上列第 2–11 項**。明確禁止建立：`lib/pos/settlement-sources.ts`、`lib/pos/__tests__/settlement-sources.test.ts`、`lib/pos/__tests__/settlement-persist.test.ts`、`lib/pos/__tests__/settlement-db-concurrency.test.ts`。

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
- 同一正規化券號在兩模型同時出現時：**只有**面額、方向、顧客與店家歸屬**全部一致**才視為同一張券的鏡像，以 `GroomingCoupon` 為準、`RewardRedemption` 不重複計列。面額或方向只是必要條件，**不得只比面額與方向**就認定是同一張券。任一項不一致時**兩邊都不認列**，產生 `COUPON_SOURCE_CONFLICT` 待確認。任一邊缺少可比對的顧客或店家歸屬時同樣**兩邊都不認列**，產生 `COUPON_MIRROR_AMBIGUOUS` 待確認。兩者都不占唯一鍵，不得自行選一邊。
- 比對用的店家歸屬必須先正規化成同一個穩定 key（`Merchant.id`）；`GroomingCoupon.storeId` 可能存 slug、`merchantId` 或 `Store.id`，直接比對原值會把同一家店判成兩家。

**已被鎖定的來源（不列入暫計）**

- 預覽必須排除**已被 active canonical 唯一鍵占用**的來源。寄賣銷售可靠 `MerchantStockTxn.settlementId` 過濾，但券與代收付款沒有欄位鎖，它們的鎖就是該唯一鍵；不排除會讓已結過的金額重複出現在暫計，送出時才被資料庫擋下。
- 排除是「已結過」，不是「待確認」：這些來源只出現在已送出紀錄，不得混進待確認清單。UI 可顯示被排除筆數。
- 跨店不得互相影響：唯一鍵是 `(merchantId, sourceKey)`，查詢必須限定本店。

**待確認（pending，不計金額、不鎖定、不占唯一鍵）**

- 缺可信成交價的進貨（`RestockRequest`／`RestockRequestItem` 無價格欄，核准時建立的 Order 行 `unitPrice = 0`）。
- 盤點減損（`type = 'adjust'` 且 `quantity < 0`）。
- 券號缺失／歸屬不可靠的券。
- 缺價或 `companyRevenue` 不符的銷售流水。

寄賣進貨**不是**買斷應付款。團購下單、可變抽成設定、補價流程**不在本包**，不得宣稱三模式已完成。

### 1.6 Schema 增量

新增 `SettlementSourceItem`：

- `id`、`settlementId`、`merchantId`、`sourceKind`、`sourceKey`、`direction`、`originalAmount`（Float，保留原值）、`quantity`、`unitPrice`、`commissionAmount`、`companyRevenue`、`occurredAt`、`relatedOrderId`、`sourceSnapshot`（Json）、`rulesVersion`、`voidedAt`、`createdAt`。
- `settlement` 與 `merchant` 關聯**都**使用 `onDelete: Restrict`。刪店家不得連帶刪掉新帳務稽核列。既有 `Settlement.merchant` 關聯維持原樣不動。
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

因為整數淨額要求完全相等，**讀取與寫入必須共用同一個 `Prisma.Decimal` 加總函式**，不得一邊用 Decimal、另一邊用 JS 浮點累加。

### 1.8 寫入規則

- 伺服器端必須驗證 POS session（`requireMerchantSession()`），逐筆來源驗證店家歸屬與金額，不得信任瀏覽器傳入金額。
- `idempotencyKey = sha256(rulesVersion | merchantId | periodStart | periodEnd | sorted sourceKeys | intendedPaymentMethod | operationSeq)`。
- `operationSeq` 必須由**伺服器推導**，不得由瀏覽器提供：取本來源集合在本店已作廢（`voidedAt` 非 null）的明細嘗試次數。效果：同一次送出重送得到同一個 key（冪等）；撤回後同來源可用新 key 重新結算；舊 key 重送仍回到原本那張 `cancelled`，不復活。
- `payloadFingerprint = sha256(idempotencyKey | sorted 來源原值 | legacy 合計)`。來源原值必須含 `originalAmount`、`quantity`、`unitPrice`、`commissionAmount`、`companyRevenue` 與方向，使任何來源原值變更都必定改變 fingerprint。
- 付款方式**納入** key 與 fingerprint。送出後付款方式不可改；送出前改選會產生新的操作 key。
- 送出時伺服器必須重新計算來源集合並與預覽摘要比對，改變即拒絕，不得靜默改變整批內容。
- 同 key 同 payload → 回傳既有結算；同 key 不同 payload → 拒絕；部分重疊 → 整批拒絕。
- **重送優先於重算**：送出時必須先用預覽當時的 key 查本店原單，找到就回傳原單。送出成功會鎖住來源而讓它們從新預覽消失，撤回會讓操作序號改變，兩者都會算出不同的新 key；若先算新 key 再寫入，重按一次就會變成「沒有可結算項目」或直接開出第二張結算。原 key 查詢必須限定本店，且找到的原單指紋與預覽不符時拒絕。
- 瀏覽器帶回的 key 與指紋只用於比對與查詢，永遠不參與金額計算、也不得用來建立新結算。
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
- 新版結算缺明細或版本未知 → 顯示可讀的完整性錯誤，不得 fallback、不得 500 白畫面。**未知的非空版本必須 fail closed**，不得套用本版公式解讀；缺必要欄位（`netPayableTwd`、`storeCollected`）同樣 fail closed，不得以 0 代替。
- 已撤回（`cancelled`）的結算必須仍可查閱其送出當時的快照：header 以**保留的全部稽核來源**驗證，不因明細被標 `voidedAt` 而判為損毀，也不得把歷史金額清零。
- 撤回是**整張**的操作，不是逐筆的：`cancelled` 必須每一列都已作廢，其他狀態必須每一列都仍在 active。部分作廢代表資料被半套改動，必須 fail closed，不得照 header 顯示金額。
- 來源列本身無法解讀時同樣必須是可讀錯誤而非 500：未知 `sourceKind`／`direction`、非有限金額，以及寄賣銷售缺 `quantity`／`unitPrice`／`commissionAmount`，都必須在任何加總之前擋下。未知 `sourceKind` **不得**被默默當成代收現金加進淨額。
- HQ 新版分支讀逐筆來源快照與共用淨額；legacy `calcSettlement` 路徑完全不變。
- POS 必須把**暫計**、**待確認**、**已送出紀錄**分開呈現，已送出者顯示同一編號與狀態。
- 只有 `status = 'paid'` 且有 `paidAt` 才可顯示已撥款字樣。
- 沿用既有 UI 元件與樣式，手機與桌機都必須可用。
- 新版伺服器寫入 flag 預設關閉；關閉時 UI 必須顯示可讀提示且**不得假裝成功**。flag 關閉不得讓任何已存在的新版紀錄從讀取面消失。
- 缺 schema 的環境同樣必須顯示可讀提示。
- 不得改動正式環境 flag。

### 1.11 測試

必須涵蓋：76.5 半元保留；正負半元；兩端同值一致；缺價與歸屬不可靠的券不鎖定；跨店拒絕；同 key／不同 payload／部分重疊／編號碰撞分類；零來源／零淨額；撤回競態／不復活；新舊分支與完整性錯誤；已鎖來源不入暫計；重送依原 key 回原單；同碼券顧客／店家不符與歧義；撤回狀態與明細不一致；未知來源種類與非法金額。

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
