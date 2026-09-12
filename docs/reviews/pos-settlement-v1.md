# POS 結算 v1 — 凍結 Prompt 與審核紀錄

## 0. 審核結論與基準

| 項目 | 內容 |
|---|---|
| 審核結果 | **v2 審核通過** |
| 審查模型 | Claude Opus 5（本檔作者）；提案原稿由 Grok 產出 |
| Prompt 版本 | v2-R8（＝v2 全文 ＋ R1／R1 補充白名單更正 ＋ R2／R3／R4／R5／R6／R7／R8 規格缺陷修訂；詳見 §0.1–§0.9） |
| 凍結文字 SHA256 | `d47eb926bda644395e56bdf3f91907c5c551a33482587d0cd9363a80328ce244` |
| 雜湊計算方式 | `awk '/^<!-- FROZEN-PROMPT-BEGIN -->$/{f=1;next}/^<!-- FROZEN-PROMPT-END -->$/{f=0}f' docs/reviews/pos-settlement-v1.md \| sha256sum` |
| base commit | `d55164e0670f91a47ff488e177f09a2f46560098`（`origin/main`） |
| 分支 | `cursor/pos-settlement-v1-2033`（自上述 base 建立） |
| 交付方式 | 實作端只推 draft PR。使用者已於第九輪明確授權正式部署，**但部署由 Codex 驗收後執行**；實作端仍不 merge、不部署、不動正式資料、不接觸正式庫存與歷史 |
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

### 0.5 R4 規格缺陷審核紀錄

使用者第九輪（獨立驗收 `97f0210`：101 項指定測試、typecheck，以及隔離 PostgreSQL 五項並行／回滾／撤回／稽核保留實測皆通過）提出三項 R3 剩餘缺口。全部經審核**確認為真實缺陷**，其中第 1 項在審核時發現同一類問題還有第二處。

三項都屬**原規格本身的缺口**：R3 引入了「可用性旗標」與「分類階段 pending」兩個新概念，但沒有規定它們的失敗語意，等於留下沉默失敗的空間。依授權最小幅度修訂 §1.5、§1.8、§1.10、§1.11 對應條文並重新計算凍結雜湊。舊雜湊保留於 §0.1、§0.2、§0.4、本節作為證據。白名單未擴張。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | `loadActiveSourceKeys.available === false` 被當成空鎖集合悄悄繼續 | **確認（審核發現第二處）** | `available: false` 只代表**讀不到**，不代表沒有鎖。當成空集合會算出偏高的暫計，送出才被資料庫擋下。審核另查出 `countVoidedAttempts.available` 有完全相同的問題，而且更嚴重：操作序號讀錯會算出錯的冪等 key，撤回後可能重用已被占用的 key。新增共用 `settlementReadiness()`（`lib/settlements/write-settlement.ts`），預覽與送出都用同一個結論，新增 `LOCK_STATE_UNKNOWN` 代碼與可讀訊息；POS server action 也在建立草稿前檢查，不只擋 UI |
| 2 | 歧義券在分類階段移到 pending 後，同 canonical key 的另一側仍被單獨認列 | **確認** | `COUPON_STORE_AMBIGUOUS` 的券有可靠券號、算得出 canonical key，但已離開可認列清單，`dedupeSources` 再也看不到它，剩下那側就被當成唯一一筆認列——等於用「把一邊藏起來」解掉真實歧義。`PendingSource` 增加 `sourceKey`（算不出時為 null），`dedupeSources` 接受第二參數 `pendingBefore`，同 key 已有 pending 時剩下那側一併轉 `COUPON_MIRROR_AMBIGUOUS`。`COUPON_CODE_MISSING` 沒有券號故 key 為 null，不得因此擋下無關來源 |
| 3 | 讀快照時非法 header 與加總溢位仍會變成 500 | **確認** | R3 只驗了逐列來源。header 的 legacy Float 若非有限，`new Prisma.Decimal()` 會在加總時直接拋例外；`netPayableTwd`／`storeCollected` 若非整數或超出 INT4 也無法比較。更隱蔽的是逐列都合法、加總後才溢位（`originalAmount` 是 DOUBLE PRECISION 而 `netPayableTwd` 是 INTEGER），`assertIntegerTwdRange` 會拋例外冒泡成 500。新增 `validateSnapshotHeader()` 與不丟例外的 `isIntegerTwdInRange()`，並把 `computeLegacyTotals` 包在 try／catch 內轉成可讀錯誤（未知種類與金額錯誤分開） |

R4 修訂前的凍結雜湊：`c75cf101e3964d0c8ac7fdfdcb1ccd4ebb1260c2ba06e83f588727fb98663dd2`（commit `9ca4c46`）。

### 0.6 R5 規格缺陷審核紀錄（POS／HQ 串接）

使用者第十輪以 `f43913d` 逐檔驗收提出五項必修串接錯誤。全部經審核**確認為真實缺陷**並修復。

前四輪（R1–R4）都在修「算得對不對」，R5 修的是「算對了但畫面與入口沒有真的用它」。這是**原規格的缺口**：§1.9／§1.10 規定了暫計與已送出必須分開、付款方式納入 key、送出不得標已付款，卻沒有規定**哪些欄位是畫面唯一數字來源**、**切換付款方式時 key 怎麼換**、以及 **HQ 狀態推進的合法轉移**。依授權最小幅度修訂 §1.8、§1.9、§1.10、§1.11 並重新計算凍結雜湊。舊雜湊保留於 §0.1、§0.2、§0.4、§0.5 與本節。白名單未擴張。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | 上方四張卡、付款方式與主要總額仍取 `ledger.summary`，同畫面兩套金額 | **確認** | `summary = summarizeStoreLedger(entries)`，而 `entries` 少了寄賣銷售（只進 `rawSources`）、又含已被別張結帳單鎖住的券，且進貨款以 `amount: 0` 列入。因此 `summary` 與實際要送出的 `preview` 必然不同；零淨額時 `summary.payer` 還可能指向相反方向而選錯付款方式。新增 `buildSettleOverview()`（`lib/pos/store-settlement.ts`），四張卡、收付方向與主要總額全部改讀**可信且未鎖定 sources 的 Decimal totals**；已結算金額改讀**已送出快照**（同期間且 `countsTowardValidTotals`），不再用 legacy `summary.settledAmount`。legacy 拆解區保留不刪，但改標為「交易流水拆解（參考）」並註明小計不等於結算結果 |
| 2 | 切換付款方式時 preview key／fingerprint 未更新，且會默默 fallback 到別的方式 | **確認** | 付款方式納入冪等 key，但預覽只算一份 key。切換選項後送出的是別的方式的 key；server action 的 `allowed.includes(requested) ? requested : allowed[0]` 又會在不適用時悄悄換方式，等於畫面顯示與實際存下的不符。改為**伺服器端為每個可選方式各算一份** key／fingerprint（`preview.methods[]`），畫面帶該方式自己的那份，切換不需往返；`resolveRequestedPaymentMethod()` 不適用一律擋下並回可讀訊息（`SETTLEMENT_PAYMENT_METHOD_INVALID_ERROR`），**不得 fallback**。傳輸改用穩定代碼，不再送中文標籤 |
| 3 | `submittedMessage` 對已撤回或已撥款的重送一律說待核對；歷史 `paid` 缺 `paidAt` 仍標已撥款 | **確認** | R3#2 的「重送先找原key」會回到原單，而原單可能已 `cancelled` 或 `paid`，訊息卻只看 `duplicate`。`settlementHistoryStatusView()`（`lib/pos/store-ledger.ts`，純函式無相依）依 `status` 與 `paidAt` 決定文字與色票：`paid` 缺 `paidAt` 顯示「撥款待確認（缺撥款時間）」且不得用完成色。`submittedSettlementMessage()` 依實際狀態產生訊息 |
| 4 | HQ `updateSettlementStatus` 只擋 `cancelled`，`paid` 可被改回 `draft` 再由 POS 撤回 | **確認** | 被降回 `draft` 的新版結算會重新符合 `withdrawSettlementDraft` 的條件（`status: 'draft'` ＋ `rulesVersion` ＋ `createdSource: 'pos'`），店家就能撤回一張已撥款的結算並釋放來源鎖。新增 `settlementStatusUpdateCondition()`：新版驗合法下一步（`draft→reviewing→approved→paid`，`cancelled` 與 `paid` 皆為終點）並以**原狀態**當 `updateMany` 條件，競態時整筆不動；legacy（`rulesVersion == null`）條件與訊息完全不變。缺表／缺欄位環境讀不到 `rulesVersion` 時一律當 legacy |
| 5 | HQ `snapshot-detail` 用 `formatCurrency` 把原始 76.5 顯示成 77 | **確認** | `lib/format.ts` 的 `formatCurrency` 用 `maximumFractionDigits: 0`。店家分潤是售價的 20%／30%，半元很常見；四捨五入後畫面數字與快照存下的來源值不符，對帳查不出差額來源。新增 `formatSourceAmount()`（`lib/settlements/read-snapshot.ts`，不截斷小數位）用於來源列與 legacy Float header；只有整數口徑的 `netPayableTwd` 與 `storeCollected` 維持無小數。`lib/format.ts` 不在白名單，未修改 |

R5 修訂前的凍結雜湊：`e0d634f2614a6e387e5428f90ec8be7293d84c05d6fb00b5df44c4de9cda7e00`（commit `8878c7c`）。

### 0.7 R6 部署安全缺陷審核紀錄（新表經 Data API 曝險）

使用者第十一輪提出一項已確認的部署安全缺陷：正式庫 `public` schema 的 default privileges 會讓 `postgres`／`supabase_admin` 建立的表自動取得 `anon` 與 `authenticated` 的全部表權限，而本包 `migration.sql` 新建 `SettlementSourceItem` 時既未啟用 RLS 也未收回公用角色權限，逐筆帳務與 `sourceSnapshot` 會經 Data API 曝露。

經逐行核對 `prisma/migrations/20260911160000_pos_settlement_sources/migration.sql`（R6 前 109 行）：**確認為真實缺陷**。該檔完整建立了表、CHECK、partial unique index 與兩個 RESTRICT 外鍵，但**完全沒有 `ENABLE ROW LEVEL SECURITY`，也沒有任何 `REVOKE`**。

這屬**原規格本身的缺口**：§1.6 只要求「一次帶齊全部約束」，把「約束」理解成資料完整性（PK／FK／index／CHECK），完全沒有規定**存取權限**。前五輪 R1–R5 修的都是算得對不對、以及畫面有沒有真的用它，沒有任何一輪檢查過新表在託管 PostgreSQL 上的預設曝險面。依使用者指示最小幅度修訂 §1.6 與 §1.11 並重新計算凍結雜湊。舊雜湊保留於 §0.1、§0.2、§0.4、§0.5、§0.6 與本節。白名單未擴張——修正只落在原第 6 項（`migration.sql`）與原第 10 項（`postgres-settlement.test.ts`）。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | 新表未啟用 RLS、未收回 `PUBLIC`／`anon`／`authenticated` 權限 | **確認（上線阻擋）** | Supabase 的 `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated` 是在 `CREATE TABLE` **當下**套用的，所以新表一建立就帶著公用角色的全表權限；PostgREST 只要角色有權限就會把表放進 schema cache 並公開。在同一份 migration 的 `CREATE TABLE` 之後緊接兩層防護：`REVOKE`（以 `pg_roles` 判存，相容沒有這些角色的隔離測試庫）讓新表從 Data API 的可見面消失；無 policy 的 `ENABLE ROW LEVEL SECURITY` 作為後備層，防止日後誤下 `GRANT`。三個語句都可重複執行 |

審核追加的三項**刻意不處理**（已在 §1.6 與 PR 中誠實列出，不靜默處理）：

1. **不用 `FORCE ROW LEVEL SECURITY`**。表擁有者預設繞過 RLS，而 migration 與應用程式連線是同一個 owner 角色；一旦 FORCE，伺服器自己就讀不到資料。
2. **既有 `Settlement` 表有完全相同的曝險**，而本包 7 個新欄位就加在它上面。使用者明確指示「不可改既有表」，故列為**另一個工作包**，不在本輪動。
3. **不收回 `service_role`**。使用者只指名 `PUBLIC`／`anon`／`authenticated`，且要求保留伺服器合法角色存取；`service_role` 需要伺服器機密才能使用，風險層級不同。

另一項必須列入上線前檢查而非程式修正的風險：RLS 啟用後，**若應用程式的連線角色不是表擁有者、也沒有 `BYPASSRLS`**，讀取會靜默回 0 列。分析結論是這個情況會 fail closed 而不是錯帳——`read-snapshot` 讀不到來源明細會回報快照空／不一致的可讀錯誤，而唯一索引的約束檢查與 RLS 可見性無關，所以並行寫入仍會得到 P2002 而轉成 `SOURCE_CONFLICT`——但這點必須在部署後以唯讀方式實測確認，已加入 §3.3。

R6 修訂前的凍結雜湊：`fe0e5eac9fca5872a83ffffc27f53fb8f714301bc32eb69b94d9578900f762e4`（commit `aa17a22`）。

### 0.8 R7 實際接線缺口審核紀錄（送出順序、撥款事實、卡片語意、migration 交易）

Codex 對 `7a7d32b` 的獨立驗收通過（指定純測試 158 案、typecheck、隔離 PostgreSQL 含 RLS 共 17 案），但指出四項實際接線缺口。逐檔核對後**四項全部確認為真實缺陷**，且**都是原規格的缺口**而非實作違規：§1.8 只規定了 writer 內部的重送行為，沒有規定 **action 的呼叫順序**；§1.10 規定了歷史列表不得由 status 宣稱撥款，沒有同時規定**送出訊息**；§1.6 只要求「一次帶齊全部約束」，沒有規定**交易邊界**。白名單未擴張。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | `confirmStoreSettlementAction` 先載入過濾後 sources 並驗付款方向，最後才由 writer 查原 key，導致首次送出成功後無法回原單 | **確認** | 第一次送出成功後來源全部被鎖，重新載入的 `sources` 為空 → `direction` 為 `NONE` → `payer` 為 `NONE` → `allowedPaymentMethods` 只回 `['NONE']`，因此 `BANK_TRANSFER` 先被 `SETTLEMENT_PAYMENT_METHOD_INVALID_ERROR` 擋下，writer 的重送查詢永遠走不到。把順序抽成 `confirmStoreSettlement(input, deps)`：寫入開關 → **本店 + 原 key + 完整 fingerprint** 查既有單並回報其真實狀態 → 只有查不到原單才重算來源、驗就緒狀態與付款方式。相依全部注入，順序本身可在無資料庫環境回歸 |
| 2 | `submittedSettlementMessage` 的 `paid` 分支只看 `status` 就宣稱撥款完成 | **確認** | `status` 只是標記，證明撥款事實的是 `paidAt`。`paidAt` 現在由資料庫 `select` 一路帶到 `SettlementWriteResult`、action 結果與訊息；`paid` 但 `paidAt = null` 改為明說資料不一致、要求聯絡總部、不得當成已收款，與 R5 已套用於歷史列表的 `settlementHistoryStatusView` 同一條規則 |
| 3 | 兩張主卡其實是淨額的正負兩面，說明卻列舉抵扣前的組成項目，且含未實作的「活動返利」 | **確認** | 採使用者選項（a）。改名為「（抵扣後）」並改寫說明；移除永遠成立的相減等式，改為直接說明淨結果。選項（b）被否決：`SettlementLegacyTotals` 只暴露**已進位**的 `storeCollected`，要顯示抵扣前兩邊必須另加精確欄位，且 `round(a) − round(b) ≠ round(a−b)`，會重新引入 R5 才修掉的「畫面等式不精確」問題。既有 `流水拆解` 區塊裡的 legacy `活動返利` 明細列**保留不刪**（AGENTS.md「不要刪除既有功能」），只修正錯誤的區塊註記——`load-store-ledger.ts` 其實把所有券無條件放進 `entries`，只在 `sources` 過濾鎖定來源，因此「已被其他結帳單結過的項目不在這裡」是假陳述 |
| 4 | 整份新 migration 沒有 `BEGIN/COMMIT`，緊接 `REVOKE` 不代表 autocommit 建表沒有曝險空窗 | **確認** | 查證結論：Prisma 的 `render_begin_transaction` **只對 MSSQL 實作**，PostgreSQL 不會自行送出 `BEGIN`；官方指定的 opt-in 就是在 migration 檔內自己寫 `BEGIN;`／`COMMIT;`，因此不存在交易嵌套衝突。以 autocommit 方式套用（例如 §3.4 人工補救路徑的 `psql -f`）時 `CREATE TABLE` 會先 commit，在 `REVOKE` 生效前出現曝險空窗，中途失敗也會留下半套結構。本檔沒有任何不能在交易內執行的語句（無 `INDEX CONCURRENTLY`、無 `VACUUM`）。**不動任何既有 migration** |

R7 修訂前的凍結雜湊：`a78f2f4fb50824a7bfa3e673ea90fee8e89aa54ccbb7c1bd5313d57e1e5fa37c`（commit `7a7d32b`）。

### 0.9 R8 時區審核紀錄（HQ 新版頁面期間少一天）

Codex 對 `e7dda07` 的獨立驗收通過（指定純測試 177 案、隔離 PostgreSQL 19 案、新庫 migration／RLS、雲端 build），並在隔離實機上發現同一張結帳單的期間顯示不一致：POS 顯示 `2026/09/01–09/12`，HQ 同一張的新版頁首與快照摘要卻顯示 `2026/08/31–09/12`。

逐檔核對後**確認為真實缺陷**，且屬**原規格的缺口**：§1.10 規定了「同一畫面不得出現兩套結算金額」與「來源金額必須顯示原始小數」，卻從未規定**日期的時區口徑**。前七輪（R1–R7）修的都是金額與流程，沒有任何一輪檢查過日期顯示。白名單未擴張——修正只落在原第 4、5、9、18 項。

| # | 缺陷 | 判定 | 根因與修法 |
|---|---|---|---|
| 1 | HQ 新版頁首與快照摘要的「期間」少一天 | **確認** | 期間是 `parseTaipeiDateRange` 以 `+08:00` 建出來的，起日 `2026-09-01` 存成 `2026-08-31T16:00:00.000Z`。HQ 走 `lib/format.ts` 的 `formatDate`（date-fns），用的是**執行環境本機時區**；伺服器與 CI 都是 UTC，於是同一個時刻被顯示成 `2026/08/31`。POS 端一直明確指定 `timeZone: 'Asia/Taipei'`，所以兩邊差一天。新增 `formatTaipeiDate()`／`formatTaipeiDateTime()`（`lib/settlements/read-snapshot.ts`），日期沿用既有台北工具 `taipeiDateInput()`（`en-CA`，固定 `YYYY-MM-DD`）只換分隔符號，時間固定 `hourCycle: 'h23'`（午夜為 `00:00` 而非 `24:00`）。已實測其輸出與 POS 既有口徑逐字相同 |
| 2 | 快照摘要的「撥款時間」與來源列的「時間」同樣走本機時區 | **確認** | 同一個 `formatDateTime` 根因。`paidAt` 與 `occurredAt` 都改用 `formatTaipeiDateTime`；`snapshot-detail.tsx` 已不再引用 `formatDate`／`formatDateTime`，以測試斷言鎖住 |
| 3 | POS 歷史 `paidAt` 是否也有同樣問題 | **核對後無缺陷，未修改** | `load-store-ledger.ts` 以 `toISOString()` 序列化，`settle-workspace.tsx` 的 `taipeiDay`／`taipeiDateTime` 都明確帶 `timeZone: 'Asia/Taipei'`，`paidAt` 顯示另有 `status === 'paid'` 守衛。依使用者指示「證實問題才改」，POS 端**一行未動**，僅新增回歸斷言鎖住其台北口徑不被後續改掉 |

三項刻意不處理（誠實列出，不靜默擴張）：

1. **不改 `lib/format.ts`**。使用者明確禁止，且該檔被全站大量引用，改動等於改變所有既有頁面的日期顯示。格式化函式放在白名單模組，與 R5 的 `formatSourceAmount()` 同一處理方式。
2. **不改 legacy 分支**。`app/(main)/merchants/(hub)/settlements/[id]/page.tsx` 的 `calcSettlement` 路徑（頁首、摘要期間、撥款時間、流水時間）維持原 `formatDate`／`formatDateTime` 不變，測試以出現次數斷言鎖住。legacy 路徑同樣有時區偏移，但屬**另一個工作包**。
3. **不加「（台北時間）」字樣**。使用者要求的是統一時區口徑，不是新增標註；POS 端也沒有標註，加了會造成兩邊版面不一致。

不改任何資料庫日期：`Settlement.periodStart`／`periodEnd`／`paidAt` 與 `SettlementSourceItem.occurredAt` 的存值完全未動，本輪只改顯示。

R8 修訂前的凍結雜湊：`7046a154bb150182ee2b6a64932e5a1fa209d6aa224f59768b33c0dc8cfd02af`（commit `e7dda07`）。

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
  2. 真實資料庫並行與失敗注入測試未執行；
  3. 新表曝險防護（RLS ＋ `REVOKE`）未在正式庫以唯讀方式實測確認，見 §1.6 與 §3.3 第 6–7 項；
  4. 本包 migration 的單一交易套用尚未在正式庫實際執行過，只在隔離庫演練，見 §1.6 交易邊界與 §3.3 第 8 項。
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
- **讀不到鎖定狀態不等於沒有鎖。** 缺表環境的 `available: false` 不得當成空的鎖集合繼續：那會算出偏高的暫計。操作序號（已作廢嘗試次數）讀不到時更嚴重，會算出錯的冪等 key、撤回後可能重用已被占用的 key。兩者任一讀不到就必須擋下送出並顯示可讀原因，且預覽與送出必須共用同一個就緒判斷，不得各自解讀。伺服器端擋下，不只隱藏 UI 按鈕。

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

**新表曝險防護（R6）**：正式庫在 `public` schema 設有 default privileges，`postgres`／`supabase_admin` 建立的表會在 `CREATE TABLE` 當下自動把全部表權限授予 `anon` 與 `authenticated`，PostgREST 只要角色有權限就會把表公開。`SettlementSourceItem` 存的是逐筆分潤與整包 `sourceSnapshot`，一旦上線即為匿名可讀。因此同一份 `migration.sql` 必須在 `CREATE TABLE` 之後**緊接著**兩層防護，且只針對這一張新表：

- `REVOKE ALL ON TABLE "SettlementSourceItem" FROM PUBLIC`，並以 `pg_roles` 判存後 `REVOKE` `anon` 與 `authenticated`（隔離測試庫沒有這兩個角色，缺角色不得讓整份 migration 失敗）。這一層直接讓新表從 Data API 的可見面消失。
- `ALTER TABLE "SettlementSourceItem" ENABLE ROW LEVEL SECURITY` 且**不新增任何 policy**。無 policy 的 RLS 對不繞過 RLS 的角色即為全拒，是後備層：即使日後有人誤下大範圍 `GRANT`，資料仍讀不到。

明確不做（刻意取捨，必須在 PR 誠實列出）：

- **不得** `FORCE ROW LEVEL SECURITY`。表擁有者預設繞過 RLS，而 migration 與伺服器連線是同一個 owner 角色；一旦 FORCE，伺服器自己就讀不到資料。
- **不得**改 `ALTER DEFAULT PRIVILEGES`、schema 層 `USAGE`，或任何既有表。既有 `Settlement` 有同樣的曝險（本包 7 個新欄位就加在它上面），屬**另一個工作包**，本輪不處理。
- **不**收回 `service_role`：它需要伺服器機密才能使用，風險層級不同，不在本輪指示範圍。
- 防護段三個語句全部可重複執行；表已存在（`CREATE TABLE IF NOT EXISTS` 跳過）時重跑仍會補上防護。

**交易邊界（R7）**：整份 `migration.sql` 必須以單一 `BEGIN;` … `COMMIT;` 包住。Prisma 對 PostgreSQL **不會**自行送出 `BEGIN`（`render_begin_transaction` 只對 MSSQL 實作），官方指定的 opt-in 就是在 migration 檔內自己寫，因此不存在交易嵌套衝突。若以 autocommit 方式套用（例如 §3.4 人工補救路徑的 `psql -f`），`CREATE TABLE` 會先 commit，在上述 `REVOKE` 生效前出現曝險空窗；中途失敗也會留下半套結構。本檔不得出現任何無法在交易內執行的語句（`INDEX CONCURRENTLY`、`VACUUM`、`CREATE DATABASE`、`ALTER SYSTEM`）。**不得修改任何既有 migration**。

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
- 付款方式**納入** key 與 fingerprint。送出後付款方式不可改；送出前改選會產生新的操作 key。因此預覽必須為**每一個可選付款方式各算一份** key 與 fingerprint，畫面切換選項時帶該方式自己的那份；不得只提供單一 key 讓畫面在切換後沿用別的方式算出的值。
- 付款方式的合法性由**伺服器端依收付方向**判定，不適用者一律擋下並回可讀訊息，**不得 fallback 成其他方式**：悄悄換方式等於用不同的 key 寫入，且畫面顯示與實際存下的付款方式不符。收付方向必須取自可信且未鎖定來源的 Decimal 淨額，不得取 legacy 對帳摘要（淨額為零時方向可能相反）。
- 瀏覽器送出的付款方式必須是**穩定代碼**，不得是 UI 顯示文字。
- 送出時伺服器必須重新計算來源集合並與預覽摘要比對，改變即拒絕，不得靜默改變整批內容。
- 同 key 同 payload → 回傳既有結算；同 key 不同 payload → 拒絕；部分重疊 → 整批拒絕。
- **重送優先於重算**：送出時必須先用預覽當時的 key 查本店原單，找到就回傳原單。送出成功會鎖住來源而讓它們從新預覽消失，撤回會讓操作序號改變，兩者都會算出不同的新 key；若先算新 key 再寫入，重按一次就會變成「沒有可結算項目」或直接開出第二張結算。原 key 查詢必須限定本店，且找到的原單指紋與預覽不符（含完全沒帶指紋）時拒絕。
- **這個順序必須落在 server action 的入口，不能只落在 writer 裡（R7）**：驗證 session 與期間之後，緊接著就是寫入開關與「本店 + 原 key + 完整 fingerprint」查既有單，只有查不到原單的真正新送出才可以載入來源、驗就緒狀態與付款方式。若先載入過濾後的來源並驗收付方向，首次送出成功後來源全被鎖住，`payer` 變成 `NONE`，重送會先被「結帳方式不適用」擋下，writer 的重送查詢永遠走不到。跨店由查詢限定 `merchantId` 擋下：別家店的 key 查不到原單，落入新送出分支後再由來源／摘要比對拒絕。此順序必須以**注入相依**的方式實作，讓順序本身能在沒有資料庫的環境回歸測試；writer 內部保留自己的重送查詢作為並行情況的第二層防線。
- 瀏覽器帶回的 key 與指紋只用於比對與查詢，永遠不參與金額計算、也不得用來建立新結算。
- **就緒判斷必須在建立草稿之前**：寫入 flag、來源鎖定狀態與操作序號三者任一讀不到，都必須在進入交易前擋下並回傳可讀原因，不得以預設值（空鎖集合、序號 0）繼續。操作序號讀不到尤其不可放行：它會算出錯的冪等 key，撤回後可能重用已被占用的 key。此判斷必須是預覽與送出**共用的同一個函式**，不得兩邊各自解讀；且必須在伺服器端執行，不得只靠 UI 隱藏按鈕。
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
- **HQ 推進新版結算狀態必須驗合法下一步**：只允許 `draft → reviewing → approved → paid`，`paid` 與 `cancelled` 皆為終點，不得往回改。只擋 `cancelled` 是不夠的：被降回 `draft` 的新版結算會重新符合 POS 撤回條件，店家就能撤回一張已撥款的結算並釋放來源鎖。
- 新版狀態更新必須以**原狀態**當資料庫條件（不是「不等於 `cancelled`」）並做筆數斷言，競態時整筆不動並回可讀訊息。legacy（`rulesVersion == null`）條件與訊息完全不變；缺表／缺欄位環境讀不到 `rulesVersion` 時一律視為 legacy。
- 重送若命中的原單已 `cancelled`／`paid`／`reviewing`／`approved`，回應訊息必須說明**實際狀態**，不得一律說「待核對」。
- **送出訊息的撥款事實只能取自 `paidAt`，不得由 `status` 推導（R7）**：`paidAt` 必須從資料庫 `select` 出來，一路帶到寫入結果、action 結果與訊息。`status = 'paid'` 但 `paidAt` 為 null 是資料不一致，訊息必須說明不一致並要求聯絡總部，**不得宣稱撥款完成**。這與 §1.10 對歷史列表的規則是同一條，兩處不得各自解讀。

### 1.10 讀取與 UI

- 新版身份**只按 `rulesVersion`** 判定，不得以「有沒有明細」猜測。
- 新版結算缺明細或版本未知 → 顯示可讀的完整性錯誤，不得 fallback、不得 500 白畫面。**未知的非空版本必須 fail closed**，不得套用本版公式解讀；缺必要欄位（`netPayableTwd`、`storeCollected`）同樣 fail closed，不得以 0 代替。
- 已撤回（`cancelled`）的結算必須仍可查閱其送出當時的快照：header 以**保留的全部稽核來源**驗證，不因明細被標 `voidedAt` 而判為損毀，也不得把歷史金額清零。
- 撤回是**整張**的操作，不是逐筆的：`cancelled` 必須每一列都已作廢，其他狀態必須每一列都仍在 active。部分作廢代表資料被半套改動，必須 fail closed，不得照 header 顯示金額。
- 來源列本身無法解讀時同樣必須是可讀錯誤而非 500：未知 `sourceKind`／`direction`、非有限金額，以及寄賣銷售缺 `quantity`／`unitPrice`／`commissionAmount`，都必須在任何加總之前擋下。未知 `sourceKind` **不得**被默默當成代收現金加進淨額。
- **header 本身也必須先驗**：legacy Float 欄位非有限、整數欄位非整數或超出 INT4 範圍時，必須是可讀錯誤而非 500。另必須處理「逐列都合法、加總後才溢位」的情況（來源原值是 DOUBLE PRECISION，淨額是 INTEGER），加總過程拋出的範圍與未知種類錯誤都要轉成可讀訊息，兩者代碼分開。範圍檢查必須另備**不丟例外**的版本供讀取端使用。
- HQ 新版分支讀逐筆來源快照與共用淨額；legacy `calcSettlement` 路徑完全不變。
- POS 必須把**暫計**、**待確認**、**已送出紀錄**分開呈現，已送出者顯示同一編號與狀態。
- **同一個畫面不得出現兩套結算金額。** POS 總覽的應收應付卡、收付方向與主要總額只能有一個來源：本次可結算來源的 Decimal totals。legacy `summarizeStoreLedger(entries)` 不得用於這些欄位——`entries` 少了寄賣銷售、含已被別張結帳單鎖住的券、且進貨款以 0 列入，必然與要送出的金額不同。已結算金額改讀**已送出快照**（同期間且計入有效統計者），不得用 legacy 摘要的已結清欄位。
- legacy 流水拆解區可保留（不刪除既有功能），但標題與說明必須讓人看得出它是**流水分類參考**而非結算金額，且小計不等於本期結算結果。**區塊註記必須與 `load-store-ledger.ts` 的實際行為一致（R7）**：券無論是否已被別張結帳單鎖定都會進 `entries`，只有 `sources` 會過濾鎖定來源，因此不得聲稱「已被其他結帳單結過的項目不在這裡」；正確說法是寄賣銷售不在流水裡、已結過的券仍會列出。
- **兩張應收應付卡的說明必須與它們實際顯示的數字一致（R7）**：它們是同一個淨額的正負兩面（抵扣後），不是抵扣前的兩邊，其中一張永遠是 0。標題必須寫明「抵扣後」，說明不得列舉抵扣前的組成項目，也不得提及尚未實作的科目。不得顯示「一邊 − 另一邊 = 淨額」這種永遠成立且無資訊的等式；若要改為顯示抵扣前兩邊，必須另提供**未進位**的精確欄位，不可用已進位的 `storeCollected` 相減（`round(a) − round(b) ≠ round(a−b)`）。既有 legacy 流水拆解裡的明細列不因此刪除。
- 只有 `status = 'paid'` 且有 `paidAt` 才可顯示已撥款字樣。`paid` 但缺 `paidAt` 是資料不一致，必須顯示成待確認並且不得使用完成色；未知狀態原樣顯示，不得猜成已撥款。
- **來源原值與店家分潤必須顯示原始小數**，不得四捨五入：分潤是售價的 20%／30%，半元很常見，四捨五入後畫面數字與快照存下的來源值不符，對帳查不出差額來源。只有整數口徑的欄位（`netPayableTwd`、`storeCollected`）才可無小數顯示。此格式化函式必須放在白名單內模組，不得修改白名單外的 `lib/format.ts`。
- **所有日期與時間都必須以 `Asia/Taipei` 顯示（R8）**：期間是由 `parseTaipeiDateRange` 以 `+08:00` 建立的，`lib/format.ts` 的 `formatDate`／`formatDateTime` 走 date-fns 本機時區，在 UTC 伺服器上會把台北 9/1 00:00 顯示成 8/31，與 POS 差一天。新版頁首、快照摘要期間、撥款時間與來源列時間都必須用白名單模組內的台北格式化函式，日期優先沿用既有台北工具（`lib/taipei-date.ts` 的 `taipeiDateInput`），輸出必須與 POS 既有口徑逐字相同。時間固定 h23，午夜顯示 `00:00`。空值與無法解讀的時間顯示破折號，不得出現 `Invalid Date`。**不得修改 `lib/format.ts`、不得改動資料庫存的日期值、不得改動 legacy `calcSettlement` 分支的既有日期顯示。**
- 沿用既有 UI 元件與樣式，手機與桌機都必須可用。
- 新版伺服器寫入 flag 預設關閉；關閉時 UI 必須顯示可讀提示且**不得假裝成功**。flag 關閉不得讓任何已存在的新版紀錄從讀取面消失。
- 缺 schema 的環境同樣必須顯示可讀提示。無法送出的原因必須由伺服器提供、UI 原樣顯示，不得在前端寫死成單一句子（否則鎖定狀態讀不到會被說成 flag 關閉）。手機版固定底欄也必須看得到該原因，不得只放在桌機側欄。
- 無法送出時送出按鈕必須同時改變文字，不得維持可送出的外觀。
- 不得改動正式環境 flag。

### 1.11 測試

必須涵蓋：76.5 半元保留；正負半元；兩端同值一致；缺價與歸屬不可靠的券不鎖定；跨店拒絕；同 key／不同 payload／部分重疊／編號碰撞分類；零來源／零淨額；撤回競態／不復活；新舊分支與完整性錯誤；已鎖來源不入暫計；重送依原 key 回原單；同碼券顧客／店家不符與歧義；撤回狀態與明細不一致；未知來源種類與非法金額。

R4 追加必測：鎖定狀態或操作序號讀不到時預覽與送出都被擋下並回同一個可讀原因（含 flag 關閉仍優先回報 flag）；歧義券在分類階段轉 pending 後同 canonical key 的另一鏡像也全列 pending，而無券號的 pending 不得擋下無關來源；非法 header 與逐列合法但加總溢位都回可讀錯誤。加總溢位必須在真實 PostgreSQL 上驗（逐列 DOUBLE PRECISION 寫入後讀取），不得只用單元測試模擬。

R5 追加必測（畫面與入口串接，全部為純函式測試，不需資料庫）：收付方向由 Decimal 淨額推導且零淨額只允許「本期無需付款」；不適用的付款方式被擋下而非 fallback，且 UI 文字不被當成合法輸入；每個可選方式的 key 與 fingerprint 互不相同而金額相同；重送命中 `cancelled`／`paid`／`reviewing`／`approved` 的訊息各自正確；`paid` 缺 `paidAt` 不顯示已撥款且不用完成色；總覽四張卡只有一方有數字、零淨額顯示相抵、已送出金額只計同期間且排除已撤回、舊流程缺 `netPayableTwd` 時退回 `merchantOwesUs`；HQ 新版狀態只允許逐步推進並以原狀態當條件，legacy 條件與行為完全不變；來源金額格式化保留半元與多位小數、非有限值不顯示成金額。

R6 追加必測（新表曝險防護，需隔離 PostgreSQL）：測試必須從**實際出貨的 `migration.sql`** 以標記擷取防護段來執行，不得抄寫副本，否則 migration 被改掉時測試還會通過。內容需涵蓋：出貨的防護段含三個語句且不含 `FORCE ROW LEVEL SECURITY`、`CREATE POLICY`、`ALTER DEFAULT PRIVILEGES` 與 schema 層授權；在隔離庫建立 `anon`／`authenticated` 並 `GRANT ALL` ＋ 關閉 RLS 以**重現** Supabase 預設授權（必須先斷言漏洞真的被重現，否則後續通過沒有意義）；套用防護段後 `relrowsecurity` 為真、`relforcerowsecurity` 為假、policy 數為 0、兩個角色的 SELECT／INSERT／UPDATE／DELETE `has_table_privilege` 皆為假，且實際 `SET LOCAL ROLE` 後讀寫都被權限擋下；伺服器（表擁有者）交易在 RLS 啟用後仍可寫入並讀回自己的來源明細；以及在可回滾的交易內臨時 `GRANT SELECT` 給 `anon` 時，無 policy 的 RLS 仍讓它讀到 0 列。測試只改這一張新表的權限，不改全域 default privileges，結束時隔離庫停在「已防護」狀態。

R7 追加必測：

- **送出順序回歸（純函式，不需資料庫）**：以注入相依驗「首次送出成功後來源全鎖、重送同 key 仍回原單，且回原單的路徑完全不讀來源、不驗付款方式、不寫入」；查不到原單才載入來源並驗付款方式；指紋不符拒絕；別家店的 key 查不到原單而不得沿用別人的結算；寫入開關關閉時連原單都不查；鎖定狀態或操作序號讀不到時擋在收付方向判斷之前；操作序號一路傳進草稿。**不得只測 writer**——R7#1 的缺陷正在 action 的呼叫順序，writer 本身是對的。
- **撥款事實**：新建草稿帶出 `paidAt = null`；重送回原單帶出資料庫裡真實的 `paidAt`；`paid` 但缺 `paidAt` 時照實帶出 null 且訊息不得宣稱撥款完成；撤回結果同樣帶出 `paidAt`；本店查得到原單、別家店查不到；缺表時查詢回 null 而不讓送出流程 500。
- **畫面文字回歸**：以讀取元件原始碼並斷言文字的既有慣例，驗兩張卡已標明「抵扣後」、卡片說明不再列舉抵扣前組成與未實作科目、永遠成立的相減等式已移除、流水註記不再聲稱已鎖定的券不在流水裡。
- **migration 交易邊界**：靜態檢查（不需資料庫，因此必須放在 skip 閘門外）驗整份 migration 第一個語句是 `BEGIN`、最後一個是 `COMMIT`、只有一組交易、無 `ROLLBACK`、防護段排在 `CREATE TABLE` 之後且在 `COMMIT` 之前，且沒有任何無法在交易內執行的語句。真實資料庫演練：過濾掉 `BEGIN`／`COMMIT`（`$transaction` 已管理交易）後把全部語句送進單一交易並整包回滾，證明每個語句都能在交易內執行、整份可重複套用（P3009 補救路徑需要），回滾後既有結構與 RLS 狀態完好。

R8 追加必測（日期時區，純函式，不需資料庫）：台北期間起日的邊界時刻 `2026-08-31T16:00:00.000Z` 必須顯示成 `2026/09/01` 與台北時間 `00:00`（同時斷言該時刻的 UTC 日曆確實是 8/31，證明缺陷會少一天）；迄日 `23:59:59.999` 仍留在同一個台北日曆日；整段期間顯示為 `2026/09/01 ~ 2026/09/12`；與 POS 既有台北口徑逐字相同；**必須在 `TZ=UTC` 與至少一個非台北時區下各執行一次**，並在測試內以會算出不同日曆日的時區（如 `America/New_York` 與 `Pacific/Kiritimati`）證明結果不受執行環境時區影響；空值與無法解讀的時間回破折號；午夜不得顯示 `24:00`。另以讀取原始碼斷言：新版快照元件已不再引用 `formatDate`／`formatDateTime`、HQ 明細頁只有新版頁首改台北而 legacy 分支的既有 `formatDate`／`formatDateTime` 出現次數不變、POS 歷史的期間與撥款時間仍明確帶 `Asia/Taipei`。

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

### 3.1 已執行（實作端，未連任何資料庫）

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit` | 通過（R8 後重跑） |
| `lib/settlements/__tests__/source-snapshot.test.ts` | 33／33 通過（R4#2 追加 3 案） |
| `lib/settlements/__tests__/read-snapshot.test.ts` | 47／47 通過（R4#3 追加 4 案、R5#5 追加 6 案、R8 追加 10 案）。`TZ=UTC`、`TZ=America/New_York`、`TZ=Pacific/Kiritimati` 三種時區下各跑一次都是 47／47 |
| R8 負面對照（證明測試有效） | 把 `formatTaipeiDate` 暫時換成本機時區實作後，`TZ=UTC` 下 47 案中 4 案失敗（期間起日、整段期間、與 POS 逐字比對、時區獨立性），還原後恢復全綠。證明這批斷言真的能擋住本機時區實作，不是恆真斷言 |
| `lib/settlements/__tests__/write-settlement.test.ts` | 47／47 通過（R4#1 追加 5 案、R5#4 追加 6 案、R7#1–#2 追加 8 案） |
| `lib/pos/__tests__/store-ledger.test.ts` | 16／16 通過（既有 15 案不變，第 16 案依 §1.11 改寫為寫入 flag 關閉；R5／R7 未在此檔加案，遵守白名單第 24 項） |
| `lib/pos/__tests__/store-settlement-v1.test.ts` | 44／44 通過（R5#1–#3 追加 18 案；R7 追加 11 案：送出順序 7、`paid` 缺 `paidAt` 訊息 1、畫面文字回歸 3） |
| `lib/settlements/__tests__/postgres-settlement.test.ts`（靜態部分） | 1／1 通過。R7 新增的 migration 交易邊界靜態檢查刻意放在 skip 閘門**外**，因此不需要資料庫也會執行 |
| `lib/settlements/__tests__/postgres-settlement.test.ts`（真 DB 部分） | **本端未執行**：白名單閘門未通過，整個 suite 如實 SKIP 並印出理由「未設定 `SETTLEMENT_TEST_DATABASE_URL`」。共 18 個真 DB 案例待獨立驗收者執行（R4#3 追加 1 案；R6 追加曝險防護 3 案；R7 追加整包交易演練 1 案） |
| `lib/settlements/__tests__` ＋ `lib/pos/__tests__` 全量 | 381／381 通過、0 失敗（含本包以外的既有測試，確認未造成回歸）。`TZ=UTC` 與 `TZ=America/New_York` 各跑一次都是 381／381 |
| `npm test`（全量，R8 後重跑） | 1051／1051 ＋ 18／18 通過、0 失敗、0 skipped |
| R6 防護段純文字驗證（不連資料庫） | 以臨時腳本確認：標記可正確擷取防護段、dollar-quote 切分得到恰好 3 個語句且 `DO $guard$` 區塊完整、`migration.sql` 通過全部必含與必不含的斷言。R7 之後整份 migration 的語句數由 20 變為 22（新增 `BEGIN`／`COMMIT`），交易邊界改由測試內的靜態檢查斷言，不再依賴臨時腳本 |

白名單指定測試合計 188 項通過（原 158 ＋ R7 的 19 案 ＋ migration 靜態檢查 1 案 ＋ R8 的 10 案）。

`npm test` 本輪已執行一次：R5 動到了 `lib/pos/store-ledger.ts`（新增純顯示函式）與 HQ server action，必須確認沒有回歸。指令只跑 `node --import tsx --test`，實測未建立任何資料庫連線、未寫入任何資料；原先「禁止 `npm test`」的理由（`lib/jar-exchange` 會寫資料庫）在本次執行中未出現寫入行為。實作端全程未連任何資料庫、未套用 migration。

以上為實作端自跑結果，**不等於獨立驗收**。真 DB 行為與畫面操作仍須由 Codex 在自己的隔離庫與環境確認。

### 3.2 未執行項目

| 項目 | 狀態 | 原因 |
|---|---|---|
| 正式庫 migration 套用 | **未執行** | 本輪明確禁止；任何資料庫都不套用 |
| 真 DB 測試（實作端執行） | **未執行** | 實作端不連資料庫；測試程式已備，由獨立驗收者在自己的隔離庫執行 |
| 正式 drift reconcile 驗證 | **未執行** | 需讀正式庫，未授權 |
| `npm run build` | **未執行** | 可能觸發資料庫遷移，未授權 |
| `package.json` 的 `test` script 補上 `lib/settlements/__tests__/*` | **未執行** | `package.json` 不在白名單。目前 `npm test` 不會跑本包的 `lib/settlements` 測試，必須另行手動指定路徑；需使用者授權才能補上 |
| POS／HQ 畫面實機操作 | **未執行** | 需要可登入的執行環境與資料庫。R5 的畫面行為以純函式測試覆蓋（`buildSettleOverview`、`settlementHistoryStatusView`、`resolveRequestedPaymentMethod`、`submittedSettlementMessage`、`formatSourceAmount`），R8 的日期以 `formatTaipeiDate`／`formatTaipeiDateTime` 純函式測試加原始碼斷言覆蓋，但**都不等於**實機點擊驗收。R8 的缺陷本身正是由 Codex 在隔離實機上發現的，修正後的 HQ 頁面必須再回到實機確認期間顯示為 `2026/09/01 ~ 2026/09/12` |

### 3.3 上線前必須完成的檢查

1. **正式 drift**：`docs/POS-02-MIGRATION-PLAN.md` §2 的閘門必須先關閉，才可在正式庫建立
   `20260911160000_pos_settlement_sources`。文件內的證據句已過期，閘門本身未失效。
   使用者第十輪已提供唯讀 drift 證據，分析與最小處理方案見 §3.4。
2. **隔離庫並行／回滾驗收**：以 `SETTLEMENT_TEST_DATABASE_URL` 執行
   `postgres-settlement.test.ts`，確認 partial unique index、完整性 CHECK、
   `ON DELETE RESTRICT`、同 key 並行收斂、來源衝突與鎖定衝突的零殘留回滾，
   以及 R6 的新表曝險防護三案。該隔離庫的連線角色需要 superuser 或 `CREATEROLE`
   才能建立 `anon`／`authenticated` 來重現 Supabase 預設授權。
3. **migration 增量與回復**：本包 migration 只 `ADD COLUMN IF NOT EXISTS` 與 `CREATE TABLE IF NOT EXISTS`，
   全部新欄位 nullable 且不 backfill。回復＝關閉寫入 flag，不刪表、不清欄位、不重算歷史。
4. **部署先後次序**：先套 migration（讀取端此時全走 legacy 分支，行為不變）→ 再部署程式
   （寫入 flag 仍關閉，POS 只顯示暫計並說明尚未啟用）→ 最後才開 flag。
   反序（先開 flag 後套 migration）會讓店家看到 `SCHEMA_MISSING`。
5. **writer flag**：`POS_SETTLEMENT_WRITE_ENABLED` 預設關閉，只讀伺服器環境變數。
   先在 Preview 開啟驗收，正式環境另行授權後才開。
6. **新表曝險防護實測（R6，上線阻擋）**：套用 migration 後，以**唯讀**方式確認三件事——
   `has_table_privilege('anon', 'public."SettlementSourceItem"', 'SELECT')` 與
   `authenticated` 同項皆為 `false`；`pg_class.relrowsecurity` 為 `true` 且
   `relforcerowsecurity` 為 `false`；`pg_policies` 對該表為 0 筆。
   若 migration 是以 `prisma db push` 而非 `migrate deploy` 套用，防護段**不會**被執行，
   必須單獨補跑防護段那三個語句後再驗。
7. **應用程式連線角色（R6 衍生）**：唯讀確認執行期連線角色是該表的擁有者
   （`SELECT tableowner FROM pg_tables WHERE tablename = 'SettlementSourceItem'` 與
   `SELECT current_user` 一致），或具備 `BYPASSRLS`。
   若兩者都不成立，RLS 會讓讀取靜默回 0 列。此情況會 fail closed（快照讀不到來源會回
   可讀錯誤，而唯一索引與 RLS 可見性無關，並行寫入仍得到 P2002 轉 `SOURCE_CONFLICT`），
   但仍必須在開 flag 前確認，不可事後才發現。
8. **migration 以單一交易套用（R7，上線阻擋）**：本包 migration 已自帶 `BEGIN;`／`COMMIT;`，
   必須以會照原文送出整份檔案的方式套用（`prisma migrate deploy`，或 §3.4 人工路徑的
   `psql -f`）。**不得**逐句拆開送出或以只送單句的 client 套用，否則交易邊界失效、
   建表與收權之間會出現曝險空窗。套用後以 §3.3 第 6 項唯讀驗證防護確實生效。
   隔離庫已演練整包在單一交易內執行並整包回滾，但**正式庫尚未實際套用過**。

### 3.4 正式庫 migration drift：唯讀證據與最小處理方案

本節只做風險分析與方案建議。**未恢復任何舊 migration、未修改任何 migration 檔案、未修改 `_prisma_migrations`、未動 ledger、未啟用其他功能、未接觸正式資料。**

#### 使用者提供的唯讀證據（Production `ukjjopridghvwzobrsus`）

| 項目 | 數值 |
|---|---|
| `_prisma_migrations` 紀錄數 | 76 |
| repo migration 數 | 55（含本包 1 個未套用） |
| 正式名稱無對應檔案 | 19 |
| checksum 不一致 | 3：`ensure_zhuwo_banqiao`、`shopify_order_review_gate`、`shipment_received_fields` |
| 未完成紀錄 | 無 |
| 本包結構 | `SettlementSourceItem` 與 `Settlement` 7 個新欄位皆未建立 |

「7 個欄位」與本包 migration 內容一致：`rulesVersion`、`idempotencyKey`、`payloadFingerprint`、`createdSource`、`intendedPaymentMethod`、`netPayableTwd`、`storeCollected`。

#### 本包補充查證（全部為 repo 唯讀，未連任何資料庫）

1. **現行部署不會跑 migration。** `package.json` 的 `build` 是 `prisma generate && next build`；`vercel.json` 無 `buildCommand` override。commit `7452746 security: remove build-time database mutations` 明確把 `prisma migrate deploy`、`migrate resolve` 與 `ensure-demo-admin` 從 build 移除。`DEPLOY.md` Step 4 仍寫 build 會跑 `migrate deploy`，**該段已過期**，依 AGENTS.md 不得照舊文件操作。
   → 部署程式碼與 drift **完全解耦**：drift 不會讓部署失敗，但本包 migration 也不會被自動套用。
   → 仍須唯讀確認 Vercel 專案設定沒有在 Dashboard 覆寫 Build Command（`vercel.json` 看不到這層）。

2. **`prisma migrate deploy` 不檢查 drift。** 5.22.0 的 CLI 實作只呼叫 `listMigrationDirectories()` 與 `applyMigrations()`，**不呼叫** `diagnoseMigrationHistory()`。「已套用但本地缺檔」與「套用後被修改」兩段訊息都位於引擎的 `diagnose_migration_history.rs`（`migrate status`／`migrate dev` 才用）；`apply_migrations.rs` 只有「檢查失敗的 migration」（P3009）。
   → 19 個缺檔與 3 個 checksum 不一致**都不會**擋下套用；「沒有未完成紀錄」也排除了 P3009。

3. **3 個 checksum 不一致中有 2 個檔案從未被編輯過。** `shopify_order_review_gate` 只有 commit `8b866ae`、`shipment_received_fields` 只有 commit `c41f53a`；只有 `ensure_zhuwo_banqiao` 有兩次（`2f591d0` → `fc535c6`「改純 SQL」），屬檔案端的真實改動。
   `shopify_order_review_gate` 檔案實際 SHA-256 為 `c272853eee75584e28d7ab1f29bcf44828508174c05e738661648f549c2f4ee0`，與 `docs/SHOPIFY-OMS-PREVIEW-MIGRATION.md` 記錄的值相同；該文件載明當時「使用實際 SQL 檔 SHA-256，於同一交易寫入 `_prisma_migrations` 完成紀錄；未全面執行 migrate deploy」。
   → 這 2 筆的不一致指向**紀錄端（人工寫入）**而非檔案端。不需要、也不應該改檔案去迎合紀錄。

4. **證據有一處算不通，需補一個唯讀數字。** 76 − 19 = 57 筆紀錄有對應檔，但 repo 扣掉本包只有 54 個既有檔案，多出的 3 筆只能是**同名重複列**。歷史上 build 曾長期執行 `migrate resolve --rolled-back` 後接 `--applied`（commit `b4cd2c8` 至 `7452746`），正是會產生同名多列的操作。
   決定安全性的數字不是 76，而是「**repo 內有幾個 migration 在 `_prisma_migrations` 沒有已套用紀錄**」：
   - 若為 1（只有本包）→ `migrate deploy` 剛好只套用本包，安全。
   - 若 > 1 → `migrate deploy` 會嘗試重跑舊 migration。舊檔並非全部冪等（例如 `20260512102047_init`），中途失敗會留下未完成紀錄，此後**所有** `migrate deploy` 都被 P3009 擋死，必須人工 `migrate resolve` 才能恢復。
   唯讀取得方式：`npx prisma migrate status`，或 `SELECT migration_name, count(*) FROM _prisma_migrations WHERE rolled_back_at IS NULL GROUP BY 1 ORDER BY 2 DESC`。

#### 使用者第十三輪補充的 drift 證據（R7）

| 項目 | 結果 | 對本節結論的影響 |
|---|---|---|
| repo 有檔但正式庫無已套用紀錄（repoOnly） | **只有本包一筆** | 直接回答了查證 4 的未知數字。落在「若為 1」的分支：`migrate deploy` 剛好只套用本包，不會重跑任何舊 migration。§3.4 處理方案第 2 步可用，第 3 步（單筆交易 ＋ `migrate resolve`）降為備援 |
| 從所有 Git 物件找回的原始 SQL | 17 份精確 checksum，含 3 筆 mismatch | 只作為存證，**未啟用、未恢復任何舊 migration** |
| 因此得到的方法論修正 | 不能只靠路徑 log 認定檔案從未被改或紀錄造假 | 上面查證 3 的推論（「2 筆不一致指向紀錄端」）是**依 commit 路徑歷史**得出的，強度不足：檔案可能以 Git 物件存在而不出現在該路徑的 log。故查證 3 降級為「與 `docs/SHOPIFY-OMS-PREVIEW-MIGRATION.md` 記載一致的一種解釋」，不再作為判斷依據。**這不影響本包決策**——處理方案第 5 步本來就是「這 3 筆與 19 筆缺檔本包一律不處理」 |
| 正式庫角色／owner 與部署目標確認 | 由 Codex 後續驗收 | §3.3 第 7 項（連線角色是否為表擁有者或具 `BYPASSRLS`）的執行者已明確為 Codex，實作端不連任何資料庫 |

#### 部署風險評估

| 風險 | 等級 | 依據 |
|---|---|---|
| drift 擋下程式部署 | **無** | build 不跑 migration（查證 1） |
| checksum 不一致擋下套用 | **無** | `migrate deploy` 不做該檢查（查證 2） |
| 未完成紀錄造成 P3009 | **無** | 使用者已確認沒有未完成紀錄 |
| 全量 `migrate deploy` 重跑舊 migration | **低** | 使用者第十三輪已確認 repoOnly 只有本包一筆，故 deploy 只會套用本包（見上表）。仍須在執行當下以 `migrate status` 再確認一次 |
| 19 筆缺檔代表的結構落差 | **未知，本包不處理** | 正式庫有 repo 不知道的結構。本包不依賴那 19 筆，且已確認本包自有物件皆不存在 |
| 本包 migration 自身 | **低** | 全部 `IF NOT EXISTS` 或 `DO $$ ... EXCEPTION WHEN duplicate_object`，可重複執行；新欄位全 nullable、不 backfill；取 ACCESS EXCLUSIVE 鎖的只有 `Settlement`（月結表，列數小）。`datasource` 已設 `directUrl`，migrate 走 `DIRECT_URL`，不受 pooler 對 `DO $$` 的限制 |

#### 最小處理方案：只套用本包一筆，不碰歷史

1. **先唯讀確認 pending 筆數**：`npx prisma migrate status`。預期「只有 `20260911160000_pos_settlement_sources` 未套用」——使用者第十三輪的 repoOnly 證據已指向這個結果，但執行當下仍須再確認一次。
2. **若 pending 只有本包一筆** → 直接 `npx prisma migrate deploy`（需 `DIRECT_URL`）。它只會套用本包，歷史 drift 原樣保留。本包 migration 自帶 `BEGIN;`／`COMMIT;`，`migrate deploy` 會照原文送出，因此建表與收權在同一個交易內完成。
3. **若 pending 超過一筆** → **不要**跑全量 deploy。改為只執行本包 SQL（`psql -f` 整份檔案，交易邊界由檔案內的 `BEGIN;`／`COMMIT;` 提供；先設 `lock_timeout`／`statement_timeout`），再用 `npx prisma migrate resolve --applied 20260911160000_pos_settlement_sources` 寫入紀錄。**不得逐句拆開送出**，否則交易失效。**用 `migrate resolve` 而不要手寫 `INSERT`**：Prisma 會自行從檔案算出正確 checksum，手寫紀錄正是造成目前 drift 的成因，不應再增加一筆。
4. **若套用中途失敗** → 本包 SQL 全部冪等，修正成因後可安全重跑；但必須先 `npx prisma migrate resolve --rolled-back 20260911160000_pos_settlement_sources` 清掉未完成紀錄，否則後續 deploy 會被 P3009 擋死。
5. **3 個 checksum 不一致與 19 筆缺檔：本包不處理。** 不恢復舊 migration、不改檔案、不改既有紀錄。理由是本包不依賴它們，而動它們會把一個可控的新增動作擴大成歷史資料風險。留給獨立的 drift reconcile 工作包依 `docs/POS-02-MIGRATION-PLAN.md` §2 程序處理（readonly snapshot → 三方 diff → 人工核准 → Preview 演練 → backup／forward-only／validation）。
6. **若決定完全不套用 migration** → 程式仍可安全部署：讀取端對缺表 fail closed、寫入 flag 預設關閉，POS 會顯示缺表的可讀提示，不會假裝成功。

**結論：程式端已完成，上線與否取決於 §3.3 八項檢查。** 使用者已授權正式部署，故「只准測試」的舊限制不再適用；但 §3.3 第 1 項（正式 drift，見 §3.4）、第 6–8 項（新表曝險防護、連線角色、單一交易套用）與 §3.2 的實機操作驗收仍未完成，且實作端無權執行。部署必須由 Codex 完成獨立驗收後依 §3.3 第 4 項次序執行。
