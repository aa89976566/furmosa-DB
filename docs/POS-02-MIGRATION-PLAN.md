# POS-02 Migration Plan

> **地位：** POS-02 以後若要落庫，必須先過的閘門與順序。本輪**零資料庫變更**。
> **版本：** v0.3
> **日期：** 2026-08-17
> **目標 SHA：** 只修 PR #128 head
> `9681a46d8070dee06bbd9e3b972e91ca2f5302d8` 的兩份 docs。
> **承接：** PR #126 head `fc067be26a9df60c94d4e04b6ca9081f42cb9caf`
> **配對：** `docs/POS-02-PERSISTENCE-PROPOSAL.md` v0.3
> **合約：** POS-01 仍是 canonical。本檔不覆蓋 POS-01。
> **本輪硬禁止：** 不改 schema、不新增 `prisma/migrations`、不跑 migrate／db push／
> seed／SQL／Supabase、**不產生可對 Production 執行的 migration SQL**、
> 不讀寫正式資料、不部署。

---

## 0. 用白話說

正式庫的搬家紀錄和 Git 對不齊（drift）。沒對齊之前，不准為 POS 建表。

即使以後建了表：

- 真實店家在 cutover 前**不能**寫新帳（no-real-POS gate）。
- 新帳只在 Preview／shadow 比對。
- 出問題時：停新寫、讀回舊帳；**不刪**已經寫進 V2 的不可變列。
- 建表當天就要有能執行的約束：線上店收必須有明細、退款只能二選一來源、
  冪等必須帶店家、綁定雙向一對一、券規則掛在綁定上、預約跟庫存同一筆交易、
  金額只准 BigInt。

本輪只改這份說明與提案，資料庫一行都不動。

---

## 1. 本輪範圍（零 DB 變更）

| 可以 | 不可以 |
|------|--------|
| 寫這兩份 docs | 改 `schema.prisma`、加 migration |
| 寫「以後 Preview 用」的**查詢規格** | 把規格當成 Production migration 去跑 |
| 把 drift／Store／Float 標成 blocker | 連正式庫或 Preview 執行 |
| 關閉提案 v0.3 的 9 個 gate 文字 | merge、deploy、進 schema／POS-03 |

`git diff` 相對 POS-01 branch **只能多這兩個 docs**。

---

## 2. Prerequisite：drift 未 reconcile 不可建 migration

`origin/main` 最後一筆 migration 仍是 `20260729170000_refill_flavours_stock`。
Draft PR **#112–#115** 記錄 Production `_prisma_migrations` 另有 12 筆 `202608*`，
repo 沒有對應檔。

**未關閉前：禁止建立任何 POS expand migration（含空表）。**

對齊步驟（本輪只定義，不執行；動正式庫要另開人工授權）：

```text
readonly snapshot → repo／schema／ledger 三方 diff
→ missing / applied / divergent / manual
→ 人工核准 → disposable Preview 演練
→ backup／forward-only／validation
→ 通過後才允許 POS expand 的 Preview 演練
```

不可 replay 已套用 ledger、不可 `db push` 正式庫、不可把 #114 證據當 active
migration。

---

## 3. No-real-POS gate

在 **writer 切齊 + shadow 通過 + 人工 cutover** 之前：

- 真實店家 POS／HQ 入口**不得** insert `PosSale`、`PosSaleLine`、
  `MerchantSaleSnapshot`、`MerchantSaleSnapshotLine`、`RefundRequest`、
  `RefundLine`、`InventoryReservation`、`PosInventoryLedger`、
  `PosSettlementV2`
- 程式應有明確 feature flag（以後實作）：`POS_V2_WRITES = preview_only`
- 違反此 gate＝漏結算（新帳有、舊 `Settlement` 沒加到）

Shadow 允許：只讀複製／離線比對，不取代 HQ 月結出口。

---

## 4. Writer-by-writer cutover

與提案 §2、§11 同一套權威。Cutover **不是**「先讓 POS 寫新表、HQ 慢慢改」。

建議順序（每步自己 Preview → 人工 gate）：

1. Drift reconcile
2. Legacy `Order`／`OrderItem` 補 `UNIQUE (id, merchant_id)` 或 raw 對等
   （沒有這步就不建 snapshot composite FK）
3. Expand 新表（**建表當下就有**可行 constraints；見 §5.1 與提案 §7）
4. `MerchantStock` nullable `onHand`／`reserved`／`stockReady`（**無 DEFAULT 0**）
5. Float／quantity backfill + quarantine（Preview fixture 驗證後的查詢）
6. Shadow compare（舊 txn 加總 vs 投影 V2；不混 Float+BigInt）
7. 代收：`MerchantSaleSnapshot` + **Line** shadow（Order 仍權威）
8. **同一窗口**切會動同一 stock 列的 writers，或關掉未切的入口
9. 打開真實 POS 寫入（解除 no-real-POS）
10. HQ 月結改讀 `PosSettlementV2`（不再加總 legacy txn 當 POS 成交）
11. 很久以後才 contract（刪 Float、停 quantity 寫入）

| Writer | Cutover 日之前 | Cutover 日 |
|--------|----------------|------------|
| HQ 店內 sale／quick sale | legacy txn | 改 PosSale **或**關閉 |
| HQ adjust／return | legacy | ledger **或**阻擋進 POS available |
| Shipment 入庫 | legacy quantity | 只 delivered → ledger+onHand |
| Refill | 獨立，不進寄賣結算 | 維持獨立 |
| POS 店內 | **阻擋寫新帳** | PosSale + PosSaleLine |
| 退款 | 阻擋 | RefundRequest／RefundLine exactly-one 來源 |
| LINE／ECPay | Order 權威 | Order 權威 + snapshot header **與 line** |

未切齊 → **明確阻擋**該 writer 碰 `onHand`／POS 結算，不准默默雙寫。

---

## 5. Expand／backfill／verify

### 5.1 新表建立即帶可行 constraints

第一個 POS expand migration（**本輪不建立**）必須一次帶齊，禁止裸表：

| 表 | 建表當日必須有 |
|---|---|
| `PosIdempotencyRecord` | `UNIQUE (id, merchant_id)`、`UNIQUE (merchant_id, scope, key)` |
| `PosSale`／`PosSaleLine` | composite parent FK、金額 BigInt、逐 line 欄位、result → 冪等 composite FK |
| `MerchantSaleSnapshot`／`MerchantSaleSnapshotLine` | `source_order_id` unique、`source_order_item_id` unique、Order／OrderItem merchant composite 或 raw 對等、逐 line product／tier／stock／policy／rate／commission／gross |
| `RefundRequest`／`RefundLine` | exactly-one CHECK、兩邊都是真 composite FK、累計 constraint trigger |
| `MerchantStoreBinding` | partial unique active merchant、partial unique active store、期間 CHECK、revoked／effective 一致 |
| `MerchantVoucherPolicy` | `[binding_id, merchant_id]` composite FK、version unique、期間 exclusion／partial、`face_twd IN (200, 250)` |
| `InventoryReservation` | exactly-one source CHECK + composite FK、quantity>0、status allow-list、active partial unique、與 stock／ledger 同交易協定 |
| `PosInventoryLedger` | stock composite FK、冪等 composite FK、金額 BigInt |
| `PosSettlementV2`／adjustment | 金額 BigInt、approved immutability **trigger**（不以 REVOKE 取代） |

普通 CHECK 只放單列規則。跨表規則見提案 §7：composite FK、`FOR UPDATE`、
constraint trigger／DEFERRABLE constraint trigger。

### 5.2 Legacy Order ownership 必須先做

沒有下列其中一項，**不准**建 `MerchantSaleSnapshot` FK：

1. Prisma：`Order @@unique([id, merchantId])`，必要時 `OrderItem` 對等 unique
   或經 Order 的 constraint trigger 保證 merchant 一致。
2. Raw：`UNIQUE (id, merchant_id)` + composite `FOREIGN KEY`，或 precondition
   trigger。

**禁止**先單欄 `source_order_id → Order.id` 以後再補。

### 5.3 MerchantStock 餘額

1. 加 nullable `onHand`、`reserved`、`stockReady`——**禁止 `DEFAULT 0`**
2. `CHECK (on_hand >= reserved)` 在兩欄都非 null 時生效（可用條件 CHECK）
3. backfill 合格列；負數／不明保持 null、`stockReady=false`
4. 讀端沒 ready **不可**當成 0 件
5. `quantity` 只 mirror；cutover 後不可獨立寫
6. reserve／release／fulfill 與 reservation／ledger **同一 transaction**

### 5.4 Compatibility projection

- `sourceEventId` unique、非權威
- 可重建；不可當結算來源

### 5.5 Shadow compare

比對項目（只記差異，不改正式出口）：

- 同期間 legacy sale 加總 vs shadow PosSale／snapshot **含 line** 加總
  （**分開**店收與代收）
- 線上部分退款：snapshot line 累計 vs 原 line actual gross／qty
- 佣金 snapshot vs 剩餘淨額公式（exact cumulative，不是 `refund×rate`）
- onHand（ready 列）vs ledger 重算；`onHand >= reserved`
- 不得把 legacy Float 與 V2 BigInt 加在同一個「總應付」

---

## 6. Quarantine

### 6.1 Store 歧義

- 一名對多 slug、一 slug 對多 merchant、只靠中文店名、與偏好 MER 編號不一致
- 只進 audit／quarantine 候選
- **不准**自動寫 `MerchantStoreBinding`
- 未 verified active binding → 券／LINE／POS 開班 fail closed
- Binding 雙向 1:1 的 partial unique 在 expand 當日就在；歧義列不得塞進 active

### 6.2 Float 異常（查詢規格；本輪不執行）

下列是 **Preview fixture／EXPLAIN 驗證後才可用於 gate** 的稽核規格。
用來以後找出不能自動 round 的列。
**不是** Production migration，本輪**不要跑**、不要放進 `prisma/migrations`，
**不可直接對 Production 執行**。

目標表（至少）：`MerchantStockTxn.unitPrice`／`commissionAmount`／
`companyRevenue`，`Settlement.grossSales`／`commissionAmount`／`payable`，
`GroomingCoupon.discountAmount`，`Order.total`／`OrderItem.unitPrice`。

```text
SPEC ONLY — Preview fixture / EXPLAIN first — do not execute this round
— not a production migration — do not run on Production

1) NaN
   禁止：WHERE <float_col> <> <float_col>
   採用：
     WHERE <float_col> = 'NaN'::float8
   若 Preview fixture 證明該環境對 = 'NaN'::float8 不可靠，改用已驗證 text 法：
     WHERE <float_col>::text IN ('NaN', '-NaN')
   x <> x 在 review 中視為未關閉。

2) Infinity / -Infinity
   WHERE <float_col> = 'Infinity'::float8
      OR <float_col> = '-Infinity'::float8
   或 Preview 已驗證：
     WHERE <float_col>::text IN ('Infinity', '-Infinity')

3) 非整數（有小數）
   WHERE <float_col> IS NOT NULL
     AND <float_col> <> trunc(<float_col>)
   先用 1) 2) 排除 NaN／Infinity，或在 fixture 證明 trunc 對那些值的行為。

4) round-trip 失真（float8 ↔ text／numeric）
   WHERE <float_col> IS NOT NULL
     AND <float_col>::text::float8 <> <float_col>
   或 Preview 已驗證的 numeric 寫法。可用性以 fixture／EXPLAIN 為準。

5) 與 POS-01 公式不一致（僅已能解讀為整數者）
   成交與佣金皆通過 1–4 後：
   commission 應等於 round(gross * rate / 100)
   對不上 → quarantine，禁止 Math.round 硬塞進 BigInt 欄
```

不合格列：**不得**自動四捨五入進 V2。

---

## 7. 金額型別遷移規則

唯一方案：`BIGINT`／Prisma `BigInt`（見提案 §8）。遷移階段也不得再寫
「BigInt 或 Decimal」。

| 步驟 | 規則 |
|---|---|
| Expand | V2 金額欄建出來就是 `BIGINT`。禁止 Int line + BigInt header |
| Backfill | 只搬通過 §6.2 的整數列；以字串或 bigint 進程式，禁止 IEEE Number 中轉 |
| API | JSON 金額用十進位字串；POS-01 adapter 顯式檢查 safe-integer 後才轉 Number |
| Shadow | 舊 Float 與新 BigInt **分開**列印，不在同一加總 |

---

## 8. Rollback 定義

Rollback **不是**刪 V2、也不是倒回 Production schema。

允許：

- 關掉 `POS_V2_WRITES`（停新寫）
- HQ 結算讀回 legacy txn／舊 `Settlement`（若尚未切出口）
- 修規則後 roll-forward

禁止：

- DELETE snapshot line、completed 退款、ledger、已核准 V2
- 為了「乾淨」truncate V2
- 把已套用的 drift ledger replay 掉

若 cutover 後發現錯：用 **下一期 adjustment** 或新 reversal，不改已核准 V2
金額。approved immutability 靠 trigger；不要指望 REVOKE。

---

## 9. Production 人工 gate（本輪不得觸發）

1. Drift #112–#115（或核准替代）已關
2. POS-01 contract bump（O1＋completed＋分型）已合併，或明確豁免紀錄
3. Preview 演練必須涵蓋：
   - snapshot line 部分退款與佣金 exact cumulative
   - composite idempotency（含先驗 session 再查 key）
   - Order `[id, merchantId]` unique 或 raw 對等
   - binding 雙向 active unique
   - voucher policy exclusion + faceTwd 200／250 + 無 policy fail closed
   - reservation exactly-one、未付不建、與 stock 同交易
   - constraint trigger（退款累計、佣金、stock identity、approved 不可變）
   - BigInt JSON string round-trip
   - Float 規格用 Preview fixture 驗證後才當 gate
4. 所有同 stock writer 切齊或阻擋清單已簽
5. no-real-POS 解除授權
6. backup、監控、roll-forward 負責人

本文件不附正式庫 SQL。

---

## 10. 監控

負庫存、`onHand < reserved`、同 key 不同 fingerprint、跨店 FK 失敗、
ledger 不平衡、超額退款、佣金公式不符、已鎖期被改、quarantine 增加、
bindings 被非 verified 路徑寫成 active、同一 merchant／store 出現第二個
active binding、無 policy 仍發券、未付款出現 reservation、
`_prisma_migrations` 再分岔、真實店家在 flag 關閉時寫入 V2、
API 金額不是字串。

---

## 11. Acceptance checklist（要有證據才 PASS）

| 項 | 結果 | 證據 |
|----|------|------|
| 本輪零 DB／零正式 migration SQL | **PASS** | 僅 2 docs；§6.2 標 SPEC ONLY、不跑 Production |
| drift 未 reconcile 不可建 migration | **PASS** | §2 |
| writer-by-writer cutover | **PASS** | §4；線上 cutover 含 snapshot **line** |
| shadow compare、不混 Float+BigInt | **PASS** | §5.5、§7 |
| no-real-POS gate | **PASS** | §3 含 snapshot line／reservation |
| onHand 不 default 0 | **PASS** | §5.3 |
| Store／Float quarantine、不自動綁、不自動 round | **PASS** | §6 |
| rollback＝停寫／回舊讀，不刪 V2 | **PASS** | §8 |
| 豬窩 ID 未猜 | **PASS** | 無正式 ID backfill；O3 不 seed |
| POS-01 未被本檔覆蓋 | **PASS** | 開頭＋提案 §1 |
| 線上 line snapshot + 統一退款來源 | **PASS** | 提案 §2；本檔 §5.1／§5.2／§4 代收列 |
| composite idempotency + Order ownership | **PASS** | 提案 §3；本檔 §5.1／§5.2 |
| Binding 雙向 1:1 active | **PASS** | 提案 §4；本檔 §5.1／§6.1 |
| Voucher policy 可落地 | **PASS** | 提案 §5；本檔 §5.1 |
| Reservation 完整 invariant | **PASS** | 提案 §6；本檔 §5.1／§5.3 |
| Constraint ownership 改正 | **PASS** | 提案 §7；本檔 §5.1 禁止裸表、approved 用 trigger 不用 REVOKE 取代 |
| 唯一 money type BigInt | **PASS** | 提案 §8；本檔 §7 |
| Float NaN 不用 `x <> x` | **PASS** | §6.2 改 `= 'NaN'::float8` 或 Preview 驗證 text 法；Infinity／非整數／round-trip 標 fixture／EXPLAIN |

---

## 12. 仍未決／停止點

- O3 豬窩三店正式 immutable IDs
- POS-01 contract bump（O1 凍結）未開
- Drift #112–#115 未關
- Order／OrderItem composite unique 要到 schema 階段才加；本輪只規定沒有就不建 snapshot

不進 schema、不進 POS-03、不執行任何 SQL、等待 review。
