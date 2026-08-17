# POS-02 Persistence Proposal

> **地位：** POS 帳務／庫存／美容券／結算的**持久化設計稿**（只討論以後怎麼落庫，本輪不改資料庫）
> **版本：** v0.2
> **日期：** 2026-08-17
> **承接：** 已核准 PR #126 head `fc067be26a9df60c94d4e04b6ca9081f42cb9caf`（POS-01 Domain Contract v1.5）
> **基準：** `origin/main` @ `bbe580975af62476d62884813ad8b73bf2984b96`
> **範圍：** 兩份文件。本檔＋`docs/POS-02-MIGRATION-PLAN.md`
> **本輪硬禁止：** 不改 `prisma/schema.prisma`、不新增 migration、不跑 Prisma／SQL／Supabase、不改 API／UI／service／tests／package／env、不部署、不讀寫正式資料
> **合約層級：** **POS-01 仍是 canonical。** POS-02 不得覆蓋、改寫或取代 POS-01。O1 已由使用者確認，必須列為**下一個 POS-01 contract bump**；在 bump 合併前，POS-01 程式的 `UNDECIDED` 標記仍有效，本檔只設計「確認後如何落庫」。
> **下一步：** 三方 review 通過前不得進入 schema／POS-03

---

## 0. 這份文件在做什麼

POS-01 已經用純函式寫死「可以做／不可以做」。
POS-02 只回答：**以後這些事實要存在哪一張表、誰能改、誰是唯一寫入者、怎樣用資料庫約束擋住跨店與壞帳。**

用白話說：

- 店內現金成交，以後由 POS 新帳負責。
- LINE／綠界代收，付款與取貨狀態仍由現有訂單負責；POS 只能做結算投影，不能再當第二個付款系統。
- 真實店家在 cutover 前**不准**寫新帳，只能 Preview／shadow，否則 HQ 舊結算會漏帳。
- 本輪**零資料庫變更**。Prisma／SQL 區塊都是設計規格，不是可執行 migration。

---

## 1. 與 POS-01 的關係（不得覆蓋）

| 項目 | 誰說了算 |
|------|----------|
| R1–R10、狀態機、佣金公式、冪等、24h 未付款 vs 已付款不自動失效 | **POS-01 canonical** |
| O3 豬窩正式 ID | 仍 OPEN，本檔不猜 |
| O1 退款回庫 | **使用者已確認**（見下）。POS-01 文件／`POS_01_OPEN_DECISIONS` 仍寫 UNDECIDED，直到 **下一個 POS-01 contract bump**。本檔不宣稱「POS-02 已覆蓋 POS-01」 |

**下一個 POS-01 contract bump 必須寫入（本輪不改那 3 檔）：**

- O1 從 OPEN 改為 Frozen，內容＝本檔 §1.1
- 退款申請狀態補上 `completed`（決策與副作用分離；見 §5）
- 店內成交 vs 代收成交的擁有者分型（見 §2）

### 1.1 使用者已確認的 O1（待 bump；落庫依此設計）

| 情況 | 誰申請 | 誰核准 | 庫存 |
|------|--------|--------|------|
| 未拆封、良好、可再售 | 店家 | **只有 HQ** | `RESTOCK_SELLABLE` + `UNOPENED_GOOD_RESELLABLE` → 回**該門市**可售 |
| 已拆封／破損／變質／不可售 | 店家 | **只有 HQ** | `WRITE_OFF` + `OPENED`／`DAMAGED`／`SPOILED`／`OTHER_UNSELLABLE`（OTHER 必填說明）。**不加 onHand** |

店家不能自核退款、回庫、改佣金或結算。HQ 核准的財務回沖、disposition、庫存 ledger、`MerchantStock` 餘額、狀態必須**同一 transaction**；任一步失敗全 rollback。已鎖期（approved／paid）只進次期。金額與實物 disposition 分離。

---

## 2. 單一 commerce truth

### 2.1 分型

| 成交類型 | 完成交易／付款／履約的權威 | POS 可以做什麼 | POS 不准做什麼 |
|----------|---------------------------|----------------|----------------|
| **店內、店家收款** | `PosSale` + `PosSaleLine` | 擁有 completed 事實、佣金 snapshot、店內庫存 consume | 再寫一筆 `Order` 當結算來源 |
| **LINE／綠界、Furmosa 代收** | 既有 `Order` + Payment + fulfillment | 只建 `MerchantSaleSnapshot`（結算投影） | **不得**自有 `paymentStatus`／`fulfillmentStatus`；不得另建獨立 PosSale 當付款真相 |

`MerchantSaleSnapshot` 硬規則：

- `sourceOrderId` **@unique**（一張訂單最多一筆投影）
- 必須有 **payment reference**（server 從既有付款紀錄解析）
- 佣金／方向由 server 依 POS-01 公式 snapshot
- 付款是否成功、是否 reserved／取貨，**只讀** Order／fulfillment

### 2.2 Source-of-truth matrix

| 事實 | Cutover 前（真實店家） | Cutover 後 | 禁止 |
|------|------------------------|------------|------|
| 店內店收 completed sale | **仍寫 legacy** `MerchantStockTxn`（＋既有 HQ 路徑）。新表只在 Preview／shadow | `PosSale`／`PosSaleLine` | 真實店家先寫新表、HQ 仍只讀舊 txn（會漏結算） |
| 代收 LINE／ECPay | `Order`／Payment／fulfillment | 同上為付款權威；另有 `MerchantSaleSnapshot` | POS 自建 payment／fulfillment 狀態 |
| 退款（店內） | 現行**沒有**寄賣退款 persistence；新鏈只 Preview | `PosRefund*` + ledger | 改寫原 sale／原 txn |
| 庫存事件 | `MerchantStockTxn` + `quantity` | `PosInventoryLedger` + 同交易更新的 `onHand`／`reserved` | 兩套都當權威 |
| 庫存現況 | `MerchantStock.quantity` | materialized `onHand`／`reserved` | `quantity` 獨立亂寫；`onHand` default 0 讓讀端以為沒貨 |
| 月結 | legacy `Settlement` Float + txn | `PosSettlementV2` 只引用 ledger entry | Float 與 Int 混加總 |
| 美容券補貼 | 無結算 line | ledger kind=`voucher_fixed_subsidy` | 店名猜 200／250 |
| Merchant↔Store | 無權威 FK | 僅 `MerchantStoreBinding`（HQ verified） | audit 當權威；name／slug 自動綁 |

### 2.3 Writer／cutover 表（commerce）

| Writer | 現在寫哪 | Cutover 前真實店家 | Shadow／Preview | Cutover 後 |
|--------|----------|--------------------|-----------------|------------|
| HQ 現場售出／快速銷售 | `MerchantStockTxn` ± Order | **繼續 legacy** | 可投影到 shadow Pos*，不取代結算 | 改寫 `PosSale`（店收）或停止此入口 |
| HQ adjust／盤點 | `MerchantStockTxn` adjust | 繼續 legacy | shadow | 改 `PosInventoryLedger` 或明確阻擋進 POS 結算 |
| HQ／POS 叫貨出貨 | Shipment；code 可能 shipped 就入庫 | 繼續 legacy；合約只要 delivered | shadow | 只 `delivered` → ledger `restock_delivered` |
| Refill／換罐 | `RefillOrder`（Int 金額，另一套帳） | **不併入**寄賣 POS 結算 | 不投影成 PosSale | 維持獨立；不可當寄賣佣金 |
| POS 店內成交 | 多數走 HQ 同一套 txn | **禁止寫新帳**（no-real-POS gate） | 只 Preview | `PosSale` |
| POS／HQ 退款 | 無 | 禁止寫新帳 | Preview 完整鏈 | `PosRefund*` |
| LINE／ECPay 付款 | Order／Payment | 維持權威 | snapshot 可 shadow | 仍 Order 權威 + `MerchantSaleSnapshot` |

**漏結算禁令：** 不允許「POS 只寫新表、HQ 結算仍只加總 legacy txn」。真實 go-live 當天，該入口的 writer 必須已切到同一套結算來源，或該入口被關掉。

---

## 3. 單一 inventory truth

- **未來 event 真相：** `PosInventoryLedger`（不可變）。fingerprint＝`inventoryAggregateId + op + qty + 必要 reference`，不含當下餘額。
- **未來餘額真相：** `MerchantStock.onHand`／`reserved`，與 ledger **同一 transaction** 更新。`available = onHand - reserved ≥ 0`。
- **Cutover 前：** `MerchantStockTxn` + `quantity` 仍是 legacy 真相。
- `inventoryAggregateId`＝server 解析的 `MerchantStock.id`（merchant+product+tier）。client 值不可信。

### 3.1 每個 writer 何時切 canonical

| Writer | Legacy | 切到 canonical 的條件 | 未切齊時 |
|--------|--------|----------------------|----------|
| HQ sale（扣庫） | txn `sale` + `quantity--` | 與店內 PosSale consume 同日切，或停用 HQ 扣店庫 | **阻擋**新 POS 讀 onHand |
| HQ adjust／return | txn adjust／return | 改 ledger `write_off`／`release` 等，或阻擋進 POS available | 阻擋 |
| HQ restock 入庫 | txn restock（可能 shipped 就入） | 只認 shipment `delivered` + ledger | 阻擋 |
| Shipment delivered | 改 `quantity` | 同交易寫 ledger + onHand | 阻擋 |
| Refill 店庫 | 若有動店庫，維持獨立並文件化 | 不併 POS available，除非明確 binding | 預設不碰 POS 餘額 |
| POS reserve／consume | 無 reserved | Preview only → cutover 當日全開 | 真實店家不可 reserve |
| 退款回庫／損耗 | 無 | 與 refund `completed` 同交易 | Preview only |

**真實 POS go-live 前：** 上表所有會改同一 `MerchantStock` 列的 writer 必須切齊，或被硬擋。不允許一半寫 `quantity`、一半寫 `onHand`。

### 3.2 onHand／reserved expand（不得 default 0）

1. 加 **nullable** `onHand`、`reserved`（**沒有** `DEFAULT 0`）
2. 加 `stockReady`（或同等 readiness flag），預設 false
3. backfill：僅 `quantity >= 0` 的列寫入 `onHand=quantity`、`reserved=0`；負數／不明進 quarantine，保持 null
4. verify
5. 對已 ready 的列設 `NOT NULL` + flag=true
6. 讀端：**flag 未真則不得把 null 當 0 庫存**

`quantity` 只是過渡 mirror。Cutover 後**不可獨立寫** `quantity`；若仍更新，只能由 onHand 同步，且有 CHECK／trigger 保證相等或停用 quantity 寫入。

### 3.3 Compatibility projection

若 HQ 畫面仍要看到「一筆 txn」：

- 從 `PosInventoryLedger` **投影**到非權威列／表
- `sourceEventId` **unique**，指向 ledger id
- 投影可刪／可重建；**ledger 不可刪**
- 結算與 available **不讀**投影

---

## 4. DB merchant 隔離（必須落在資料庫，不只 service）

模式（每個 parent／child）：

```prisma
// DRAFT ONLY — 說明複合 FK，不是可套用 schema
model PosSale {
  id         String
  merchantId String
  @@id([id])
  @@unique([id, merchantId])
}

model PosSaleLine {
  id         String
  merchantId String
  saleId     String
  sale       PosSale @relation(fields: [saleId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}

model MerchantStock {
  id         String
  merchantId String
  @@unique([id, merchantId]) // 供 child composite FK
  @@unique([merchantId, productId, tierId])
}
```

**必須用 `[parentId, merchantId] → [id, merchantId]` 的對象：**

- `PosSaleLine` → `PosSale`、`MerchantStock`
- `PosRefundRequest` → `PosSale`
- `PosRefundLine` → request、`PosSale`、`PosSaleLine`
- `PosRefundDisposition` → request、refundLine、saleLine、`MerchantStock`
- `PosFinancialLedgerEntry` → 恰好一個來源（見 §7）
- `PosSettlementV2`／`PosSettlementLine`／`PosSettlementAdjustment`
- `PosReservation` → sale 或 order-snapshot、`MerchantStock`
- `MerchantSaleSnapshot` → `Merchant`（`sourceOrderId` unique；訂單本身可另 FK）

Prisma **不能**表達、必須在 **建新表當下**用 Postgres 寫入的（見 §9 矩陣）：

| 不變量 | 機制 | 何時生效 |
|--------|------|----------|
| 跨表金額／佣金公式 | CHECK 或 trigger + transaction assert | 新表 CREATE 當時 |
| ledger 恰好一個來源 | CHECK `(a IS NOT NULL)::int + … = 1` | 建表當時 |
| 已核准結算不可改 line | trigger 或 REVOKE／column privilege | 建表當時 |
| 佣金政策期間不重疊 | `btree_gist` EXCLUDE | 建表當時 |
| 同時只有一條 active binding | partial unique | 建表當時 |
| O1 action／reason 配對 | CHECK | 建表當時 |

**只有 legacy backfill** 可用 `NOT VALID` 再 `VALIDATE`。新 POS 表不准「先裸表、以後再補約束」。
Checklist **不可**只寫「service 會檢查」。

---

## 5. 退款／O1 完整鏈

### 5.1 狀態（決策 ≠ 副作用）

```text
requested → approved | rejected
approved → completed
rejected → （終態）
```

- **HQ decision**＝`approved`／`rejected`（只改申請狀態、寫 actor／reason）。
- **Side-effect execution**＝`completed`：財務 line、disposition、ledger、庫存餘額。
- **優先保留 `completed`**，以便執行失敗可重試、冪等重送，而不把「已核准但庫存沒動」假裝做完。
- 不採用「approved 必須等於 completed」的原子合併，除非下一個 POS-01 bump 明確改合約。本設計**不同步改 POS-01 狀態機**；bump 時再把 `completed` 寫進合約。

### 5.2 FK

- `PosRefundLine.originalSaleId`＋`merchantId` → `PosSale(id, merchantId)`（真 FK）
- `PosRefundLine.originalSaleLineId`＋`merchantId` → `PosSaleLine(id, merchantId)`（真 FK，**必填**）
- `PosRefundDisposition` **必須**同時有：`refundLineId`、`originalSaleLineId`、`merchantStockId`（皆＋ merchant composite FK）
- 禁止「A 商品退款寫進 B 庫存」：disposition.stock 必須等於該 sale line 的 `inventoryAggregateId`

另存：

- `originalSettlementId`（原 sale 已進哪一期；可空＝尚未結）
- `settlementRouting`：`current_open_period`｜`next_period_adjustment`
- `effectivePeriod`／`nextPeriod` 真 reference（指向 `PosSettlementV2` 或期間列）

### 5.3 數量與鎖

- disposition.quantity ≤ 該 sale line 剩餘可處置數量（不是財務 amount）
- 同一 sale line 的累計 disposition ≤ 原 quantity
- 執行時 `SELECT … FOR UPDATE` 鎖 sale line、stock 列、既有 refund lines
- 財務 `amountTwd` 仍是 `fully_reversed` 的唯一條件（POS-01）

### 5.4 HQ 核准後的 execution transaction（`approved → completed`）

同一 transaction、同一冪等 claim：

1. 再驗 HQ
2. 驗 sale／line／stock 同 merchant
3. 寫 `PosRefundLine`（佣金精準公式）
4. 寫 `PosFinancialLedgerEntry`（相反方向）
5. 寫 disposition
6. 寫 `PosInventoryLedger`
7. 更新 `MerchantStock` 餘額：可售才 `onHand += q`；**不可售只 loss，onHand 不變**
8. request → `completed`

任一步失敗 → 全 rollback。重試走同一 idempotency record。

---

## 6. 唯一 financial ledger 與結算 V2

```text
business fact（sale line／refund line／voucher／adjustment）
    → 不可變 PosFinancialLedgerEntry
        → PosSettlementLine 只 FK 到 entry
```

- Settlement line **不要複製**一份會漂的 amount。若為查詢方便存 snapshot，必須有 **DB CHECK** `line.amountTwd = entry.amountTwd`（且 direction／kind 相同）。
- `PosSettlementLine`、`PosSettlementAdjustment`、`PosFinancialLedgerEntry` 彼此與 `PosSettlementV2` 都有真 relation + merchant composite FK。

### 6.1 禁止與 legacy Float 混算

- **新建 `PosSettlementV2`**（或同等表＋`source/version` discriminator＝`pos_v2_int`）。
- **禁止**在同一加總裡把 legacy `Settlement.grossSales`（Float）和 V2 Int／BigInt 相加。
- 舊 `Settlement` 維持 HQ 舊帳，直到 cutover。不在舊表上「加幾個 Int 欄就當 V2」。

### 6.2 鎖定

`approved` 之後（raw SQL trigger 與／或 REVOKE）：

- 禁止 settlement **line** insert／update／delete
- 禁止 header 金額欄改寫
- `paid` **只**能新增付款 metadata（`paidAt`、付款參考）
- 已鎖期的 reversal／adjustment 只能指向 **next open V2 period**

Prisma 權限模型不夠，必須在 constraint 矩陣標 raw SQL。

### 6.3 整數上限與序列化

Postgres `Int`＝32-bit，約 ±21.47 億。

| 欄位 | 推薦 | 上限證明／邊界 |
|------|------|----------------|
| 單筆 sale／refund／券／佣金 line | `Int` | 單筆成交實務遠低於 2×10⁹ TWD；應用層沿用 POS-01 safe integer。超過 Int 必須 throw，不准默默變 Float |
| ledger entry／settlement header／期間加總 | **`BigInt` 或 `Decimal(18,0)`** | 多年多店加總可能接近或超過 2×10⁹；不推薦 header 用 Int |
| 費率 | `Int` 0–100 | CHECK |

**Next.js／JSON 邊界：**

- JS `number` 安全整數到 2⁵³−1。`BigInt` 不能直接 `JSON.stringify`。
- API 對 BigInt／Decimal **一律字串**進出；server 再解析並用 POS-01 helper 驗安全整數（若仍在 number 範圍）或專用 BigInt 路徑。
- 本輪不改程式；只規定以後不可把 BigInt 當普通 number 傳進 React。

---

## 7. 單一冪等權威

**不採用**「業務表全域 `@unique(idempotencyKey)` 又加中央 registry」雙軌。

**採用：**

- 唯一 key 空間：`PosIdempotencyRecord @@unique([merchantId, scope, key])`
- 欄位：`fingerprint`、`resultRef`（或結果列回指）
- 每筆業務結果有 `idempotencyRecordId @unique` → 該 record
- **claim 與寫入結果必須同一 transaction**（先插入 record，再插業務列；衝突則比 fingerprint）

Scope 例：`in_store_sale`、`merchant_sale_snapshot`、`refund_request`、`refund_complete`、`inventory`、`voucher_cancel`、`adjustment`。

### 7.1 Ledger 來源 exactly-one

`PosFinancialLedgerEntry` 多個 optional 來源 ID 必須：

- Postgres CHECK：非空來源欄位數＝1
- 每一個來源都是 **真 FK**（＋ merchant composite）
- 禁止 orphan（有 id 無關聯列）與 multi-source

---

## 8. Merchant↔Store 權威與券政策

### 8.1 Audit 仍非權威

`MerchantStoreLinkAudit` 只做觀察／quarantine。**不能**讓 POS 核銷或結算讀它當對應。

### 8.2 `MerchantStoreBinding`（擬議權威）

- `merchantId`、`storeId` 皆真 FK，`onDelete: Restrict`
- **同時只有一條 active**（partial unique：`WHERE revokedAt IS NULL`）
- `effectiveFrom`／`effectiveTo`
- `verifiedByActor`、`verifiedAt`、`source`（只允許 `hq_manual` 一類；**禁止** name／slug／heuristic）
- 未綁定 → **fail closed**

POS 範圍＝`Merchant.id`（session）。
LINE／券的 `Store.id` **只能**經 verified binding 找到 merchant。反向亦然。

### 8.3 GroomingCoupon slug

現行 `coupons.store_id` 存的是 **Store.slug 字串**，不是 `Store.id` PK。

- 必須 **轉接／隔離**：查詢時 slug → `Store.id` → binding → `Merchant.id`
- **不可**把 slug 當 `Store` PK，也不可把 slug 寫進 `MerchantStoreBinding.storeId`
- 轉接失敗（找不到 store、未 verified）→ fail closed，不 fallback 店名

禁止任何 job 用名稱／slug 自動 insert binding。

### 8.4 `MerchantVoucherPolicy`（通用，不是豬窩特例表）

- 掛在 **verified binding** 或 merchant（設計選 merchant + 可選 storeId，但 store 必須已 binding）
- 面額 200／250 由**資料列**設定，不是 runtime `if 豬窩`
- 無 policy、IDs 未核對、binding 無效 → **fail closed**，不准 default 200
- 豬窩三店正式 ID＝**O3 OPEN**，不填、不猜。不建 `Zhuwo*` 權威表

### 8.5 Commission policy

- `PosMerchantCommissionPolicy`：`ratePercent`、`effectiveFrom`／`effectiveTo`、version
- **期間不得重疊**（同一 merchant）：`EXCLUDE USING gist (merchantId WITH =, tstzrange(from,to) WITH &&)` 或同等 partial unique + transaction 規則
- `PosSaleLine` 存 snapshot **並** FK 到 `policyId`／version
- 代收 snapshot 同樣引用 policy version

---

## 9. Constraint 矩陣

| 約束 | Prisma 能表達？ | 必須 raw SQL？ | 新表何時有 |
|------|-----------------|----------------|------------|
| parent `@@unique([id,merchantId])` | 能 | 否 | CREATE |
| child composite FK | 能 | 否 | CREATE |
| `idempotencyRecordId @unique` | 能 | 否 | CREATE |
| `sourceOrderId @unique` | 能 | 否 | CREATE |
| amount > 0、rate 0–100 | 否（無 CHECK） | CHECK | CREATE |
| ledger exactly-one source | 否 | CHECK | CREATE |
| settlement line amount＝entry | 否 | CHECK | CREATE |
| O1 action／reason／OTHER note | 否 | CHECK | CREATE |
| 佣金期間不重疊 | 否 | EXCLUDE | CREATE |
| 一 merchant 一 active binding | 部分（unique 不夠表達時間） | partial unique／EXCLUDE | CREATE |
| approved 後禁改 line | 否 | trigger／REVOKE | CREATE |
| 跨表佣金公式 | 否 | trigger + tx assert | CREATE |
| 負庫存 | 否 | CHECK `onHand>=0 AND reserved>=0 AND onHand>=reserved`（僅 ready 列） | ready 後 VALIDATE |

### 9.1 O1 CHECK 清單

- `RESTOCK_SELLABLE` ⇒ reason＝`UNOPENED_GOOD_RESELLABLE`，且 `onHand` 增加＝qty
- `WRITE_OFF` ⇒ reason ∈ `OPENED|DAMAGED|SPOILED|OTHER_UNSELLABLE`，且 **onHand 不變**
- `OTHER_UNSELLABLE` ⇒ `reasonNote` 非空、非空白
- `quantity` ≥ 1、≤ 原 sale line 剩餘可處置
- `amountTwd` ≥ 1
- `originalCommissionRateSnapshot` 0–100 且等於原 line snapshot
- stock 列＝該 sale line 的 aggregate
- `completedAt` ≥ `approvedAt` ≥ `requestedAt`（時間單調）

---

## 10. Prisma 草稿（節錄；不可套用）

完整欄位以本檔各節為準。下列只示範複合 FK、單一冪等、exactly-one、V2 結算。**不是 Production SQL。**

```prisma
// DRAFT ONLY — POS-02 v0.2. Do not apply. Do not migrate.

model PosIdempotencyRecord {
  id             String   @id @default(cuid())
  merchantId     String
  scope          String
  idempotencyKey String
  fingerprint    String
  createdAt      DateTime @default(now())
  merchant       Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  @@unique([merchantId, scope, idempotencyKey])
  @@unique([id, merchantId])
}

model PosSale {
  id                   String @id @default(cuid())
  merchantId           String
  collectionChannel    String // 僅 merchant_collected
  idempotencyRecordId  String @unique
  merchant             Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  idempotency          PosIdempotencyRecord @relation(fields: [idempotencyRecordId], references: [id], onDelete: Restrict)
  @@unique([id, merchantId])
}

model MerchantSaleSnapshot {
  id                   String @id @default(cuid())
  merchantId           String
  sourceOrderId        String @unique
  paymentReference     String
  // 不准有 paymentStatus / fulfillmentStatus
  actualGrossTwd       Int
  commissionRateSnapshot Int
  commissionAmountSnapshot Int
  commissionPolicyId   String
  idempotencyRecordId  String @unique
  @@unique([id, merchantId])
}

model PosRefundRequest {
  id         String @id @default(cuid())
  merchantId String
  saleId     String
  status     String // requested | approved | rejected | completed
  sale       PosSale @relation(fields: [saleId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}

model PosRefundLine {
  id                 String @id @default(cuid())
  merchantId         String
  requestId          String
  originalSaleId     String
  originalSaleLineId String
  amountTwd          Int
  commissionReversalSnapshot Int
  originalSettlementId String?
  settlementRouting  String
  idempotencyRecordId String @unique
  request            PosRefundRequest @relation(fields: [requestId, merchantId], references: [id, merchantId])
  originalSale       PosSale @relation(fields: [originalSaleId, merchantId], references: [id, merchantId])
  originalSaleLine   PosSaleLine @relation(fields: [originalSaleLineId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}

model PosRefundDisposition {
  id                 String @id @default(cuid())
  merchantId         String
  requestId          String
  refundLineId       String
  originalSaleLineId String
  merchantStockId    String
  quantity           Int
  action             String
  reasonCode         String
  reasonNote         String?
  request            PosRefundRequest @relation(fields: [requestId, merchantId], references: [id, merchantId])
  refundLine         PosRefundLine @relation(fields: [refundLineId, merchantId], references: [id, merchantId])
  saleLine           PosSaleLine @relation(fields: [originalSaleLineId, merchantId], references: [id, merchantId])
  stock              MerchantStock @relation(fields: [merchantStockId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}

model PosFinancialLedgerEntry {
  id                  String @id @default(cuid())
  merchantId          String
  amountTwd           BigInt // 或 Decimal(18,0)；正整數
  direction           String
  kind                String
  saleLineId          String?
  refundLineId        String?
  voucherRedemptionId String?
  adjustmentId        String?
  idempotencyRecordId String @unique
  @@unique([id, merchantId])
}

model PosSettlementV2 {
  id         String @id @default(cuid())
  merchantId String
  version    String @default("pos_v2_int")
  status     String // draft | reviewing | approved | paid | cancelled
  @@unique([id, merchantId])
}

model PosSettlementLine {
  id            String @id @default(cuid())
  merchantId    String
  settlementId  String
  ledgerEntryId String @unique
  settlement    PosSettlementV2 @relation(fields: [settlementId, merchantId], references: [id, merchantId])
  entry         PosFinancialLedgerEntry @relation(fields: [ledgerEntryId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}

model MerchantStoreBinding {
  id              String    @id @default(cuid())
  merchantId      String
  storeId         String    // Store.id PK，不是 slug
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  revokedAt       DateTime?
  verifiedByActor String
  verifiedAt      DateTime
  source          String    // 只允許 hq_manual
  merchant        Merchant  @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Restrict)
}

model MerchantVoucherPolicy {
  id         String @id @default(cuid())
  merchantId String
  faceTwd    Int    // 200 | 250，資料列設定
  bindingId  String? // 若按店，必須已 verified
}

model PosReservation {
  id                 String @id @default(cuid())
  merchantId         String
  merchantStockId    String
  saleId             String? // 店內不用；代收投影可空，改 sourceOrderId
  sourceOrderId      String?
  quantity           Int
  status             String
  stock              MerchantStock @relation(fields: [merchantStockId, merchantId], references: [id, merchantId])
  @@unique([id, merchantId])
}
```

對應 raw SQL **規格**（建表時一併有；本輪不執行、不進 `prisma/migrations`）：ledger exactly-one CHECK、settlement line＝entry CHECK、O1 CHECK、commission EXCLUDE、binding partial unique、approved lock trigger。

---

## 11. 帳務方向範例（仍依 POS-01）

原成交 1000、30%、佣金 snapshot＝300。

| 情境 | 權威 | 方向 |
|------|------|------|
| 店收 1000 | `PosSale` | `merchant_owes_hq`，店欠 700 |
| 代收 1000 | Order 付款權威 + `MerchantSaleSnapshot` | `hq_owes_merchant`，欠店 300 |
| 兩者退 400 | 剩餘 600→應得 180→回沖 120 | 店收反方向回 280；代收回沖佣金 120 |
| 已鎖期再退 | 原 V2 不改 | `next_period_adjustment` |
| 可售回庫 | disposition + ledger | onHand+1 |
| 不可售 | WRITE_OFF | onHand 不變 |

---

## 12. RLS／auth

Repo 無 RLS。跨店 **Prisma 複合 FK + CHECK／trigger + session merchantId** 三層都要。
HQ／POS cookie 仍分離。client 不可指定 merchantId、aggregateId、佣金、routing。

---

## 13. Reuse vs new

**沿用：** Merchant／session、`MerchantStock`（加 composite unique 與 nullable 餘額）、Shipment／RestockRequest、Order／Payment（代收權威）、GroomingCoupon 本體（slug 轉接）、MemberPointsLedger、legacy Settlement／txn（cutover 前）。

**新建：** PosSale*（僅店收）、MerchantSaleSnapshot、PosRefund*、PosFinancialLedgerEntry、PosInventoryLedger、PosReservation、PosSettlementV2／Line／Adjustment、PosIdempotencyRecord、MerchantStoreBinding、MerchantStoreLinkAudit、MerchantVoucherPolicy、PosMerchantCommissionPolicy。

**刪除／不建：** Zhuwo 特例權威表；業務表與中央 registry 雙重 `@unique(idempotencyKey)`。

---

## 14. Acceptance checklist（要有證據才 PASS）

| 項 | 結果 | 證據 |
|----|------|------|
| POS-01 仍 canonical、未宣稱覆蓋 | **PASS** | §1；O1 列為下一 bump |
| 店內 vs 代收分型 | **PASS** | §2.1；snapshot 無 payment／fulfillment 狀態 |
| 不漏結算／no-real-POS | **PASS** | §2.2–2.3；migration plan writer 表 |
| 單一庫存＋cutover writers | **PASS** | §3 |
| onHand 不 default 0 | **PASS** | §3.2 |
| 投影 sourceEventId、非權威 | **PASS** | §3.3 |
| 複合 FK 覆蓋所列 child | **PASS** | §4、§10 |
| Prisma 不能表達者已標 raw SQL | **PASS** | §9 |
| 退款 requested→…→completed | **PASS** | §5.1 |
| Refund／disposition 真 FK | **PASS** | §5.2 |
| O1 同交易 rollback、不可售不加 onHand | **PASS** | §5.4、§9.1 |
| Ledger→settlement 只引用 | **PASS** | §6 |
| V2 不與 Float 混算 | **PASS** | §6.1 |
| 單一冪等＋ exactly-one | **PASS** | §7 |
| Binding 權威、slug 轉接、不自動綁 | **PASS** | §8 |
| 通用券政策、佣金不重疊、O3 未猜 | **PASS** | §8.4–8.5 |
| 本輪零 schema／零正式 SQL | **PASS** | 僅 2 docs |

---

## 15. 仍未決

- **O3** 豬窩三店正式 immutable IDs
- POS-01 **contract bump**（O1 凍結＋ refund `completed`＋ commerce 分型）尚未開 PR
- Production migration drift（#112–#115）未 reconcile → 不可建 migration

## 16. 本輪不做

不進 schema、不進 POS-03、不 merge、不 deploy、不讀寫正式資料、不執行 §9 的 SQL 規格。
