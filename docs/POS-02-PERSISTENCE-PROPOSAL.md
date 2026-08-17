# POS-02 Persistence Proposal

> **文件狀態：** 提案 v0.4 — 關閉 snapshot↔Order 一致性、refund header/line
> 同一來源、fact 保存 authoritative binding，並修正 O1 回庫文字。
> **本輪禁止：** 修改 `schema.prisma`、建立 migration、執行 `db push` /
> `migrate` / seed、改 runtime、操作正式資料庫或部署。
> **本輪允許：** 只改本檔與 `docs/POS-02-MIGRATION-PLAN.md`。
> **權威來源：** POS-01 Domain Contract v1.5
> （`docs/POS-01-DOMAIN-CONTRACT.md` + `lib/pos/domain-contract.ts`）。
> 本文件不得覆蓋 POS-01 規則。POS-01 未凍結的事項不得在此假裝已決。
> **Stacked PR：** 本提案疊在 POS-01 PR #126
> （`cursor/pos-01-domain-contract-aa87` @ `fc067be`），不是 `main`。
> **目標 SHA：** 本輪只修 PR #128 head
> `6dcb013b83d6a0553539aad6f31ba4269e004d65` 的兩份 docs。

---

## 0. 給非工程師的一句話

店內帳用 POS 自己的「店收＋店收明細」當真相。LINE／綠界帳仍以原本訂單、
付款、履約當真相；POS 只建立「線上店收快照＋快照明細」，讓退款、回庫、
佣金回沖、鎖帳都能逐行追溯。金額一律用整數元（BigInt），不再寫「或」。
店與店家必須雙向一對一綁定；每筆店收／快照要記下當時那筆已驗證綁定。
未履約取消只釋放預約、不加可售庫存；已履約且實物退回、HQ 核准且可再售
才加回 onHand。本輪只改這兩份文件，不建表、不搬資料。

---

## 1. 範圍與非範圍

### 1.1 本輪做什麼

只修兩份文件，關閉最後 4 項（v0.3 的 9 項仍成立）：

1. Snapshot↔Order 一致性：line 自帶 `sourceOrderId`，必須等於 header 與
   `OrderItem.orderId`；product／qty／price 來自該 OrderItem。
2. Refund header／line 同一來源：kind 一致、parent sale／snapshot 一致；
   禁止 header POS + line snapshot，也禁止同店不同單。
3. Fact 保存 authoritative `bindingId`；reservation／refund 從 fact 追溯，
   不接受 client 另傳 `storeId`。
4. 修正 O1 文字：未履約取消只 release reserved；已履約且實物退回才可能
   加回 onHand（可再售）或只記 loss（不可售）。

### 1.2 本輪不做什麼

- 不改 `prisma/schema.prisma`。
- 不建立 `prisma/migrations/**`。
- 不執行任何資料庫指令、Preview SQL、Production SQL。
- 不改 runtime、API、UI、seed、測試程式。
- 不進 POS-03。
- 不把 O1 寫進 POS-01 程式；O1 仍要下一個 POS-01 contract bump。
- 不把 O3 未確認的豬窩店 ID 寫死或 seed。

### 1.3 POS-01 仍是權威

下列規則本提案只能落地，不能改寫：

| POS-01 規則 | Persistence 必須遵守 |
|---|---|
| 店內店收是 POS 權威 | `PosSale` + `PosSaleLine` 是店內 fact |
| LINE／ECPay 是既有權威 | Order／Payment／Fulfillment 仍是線上權威 |
| 佣金同店單一％＋永久 snapshot | line 必須存 rate／commission／actual gross |
| 退款回沖用剩餘淨額公式 | 可從原 line snapshot 重算，不可每筆 `refund×rate` |
| `amountTwd` 才是財務 fully reversed | quantity 只表實物／庫存 |
| 庫存真正冪等含 server-resolved aggregateId | ledger／reservation 不可只看當下 onHand |
| 未付款 24h 失效且不 reserve | 未付款不建 reservation |
| 已付款不自動 expire | paid reserve 不自動過期 |
| HQ／POS 登入分離 | 每筆 duplicate lookup 先驗 session merchant／HQ |
| O3 未確認 | 不 seed 豬窩正式 ID |

O1（使用者已確認，見 §11.1.1）仍**不是** POS-01 程式真相，必須另開
POS-01 contract bump 才進 `domain-contract.ts`。本提案只把正確文字與
欄位／trigger 路徑寫清楚；POS-02 **不得宣稱覆蓋 POS-01**。

O1 正確規則：

- **未履約取消：** 只 `release reserved`，**不**新增 `onHand`。
- **已履約且實物退回：** HQ 核准後，未拆封／良好／可再售才
  `onHand += qty`；不可售只寫 loss，不加可售庫存。

---

## 2. Channel-neutral sale fact／line

### 2.1 兩個權威，一個可退款介面

| 通路 | 權威 | POS 可讀投影 | 可退款 line |
|---|---|---|---|
| 店內 POS | `PosSale` + `PosSaleLine` | 無（自己就是 fact） | `PosSaleLine` |
| LINE／ECPay | `Order` + `Payment` + fulfillment | `MerchantSaleSnapshot` + `MerchantSaleSnapshotLine` | `MerchantSaleSnapshotLine` |

POS **不得**為線上單另建獨立 payment／fulfillment 狀態機。
Snapshot 只投影已成立的線上事實，讓退款、回庫、佣金、鎖帳有穩定 line id。

### 2.2 店內：`PosSale` + `PosSaleLine`

```prisma
model PosSale {
  id                  String   @id @default(cuid())
  merchantId          String
  storeId             String
  bindingId           String
  soldAt              DateTime
  status              String
  subtotalTwd         BigInt
  discountTwd         BigInt
  totalTwd            BigInt
  commissionRateBps   Int
  commissionTwd       BigInt
  idempotencyRecordId String   @unique
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id])
  store    Store    @relation(fields: [storeId], references: [id])
  binding  MerchantStoreBinding @relation(
    fields: [bindingId, merchantId],
    references: [id, merchantId]
  )
  lines    PosSaleLine[]
  idempotencyRecord PosIdempotencyRecord @relation(
    fields: [idempotencyRecordId, merchantId],
    references: [id, merchantId]
  )

  @@unique([id, merchantId])
  @@index([merchantId, storeId, soldAt])
}

model PosSaleLine {
  id                         String @id @default(cuid())
  merchantId                 String
  saleId                     String
  productId                  String
  productNameSnapshot        String
  merchantStockId            String
  quantity                   Int
  unitPriceTwd               BigInt
  lineGrossTwd               BigInt
  discountTwd                BigInt
  actualGrossTwd             BigInt
  commissionRateBpsSnapshot  Int
  commissionTwdSnapshot      BigInt
  policyVersion              Int?
  createdAt                  DateTime @default(now())

  sale          PosSale       @relation(fields: [saleId, merchantId], references: [id, merchantId])
  merchantStock MerchantStock @relation(fields: [merchantStockId, merchantId], references: [id, merchantId])

  @@unique([id, merchantId])
  @@index([saleId])
}
```

店內 rounding：每個 `PosSaleLine` 先算自己的 `actualGrossTwd` 與
`commissionTwdSnapshot`；header 是各 line 加總。禁止先加總再一次四捨五入。

### 2.3 線上：`MerchantSaleSnapshot` + `MerchantSaleSnapshotLine`

```prisma
model MerchantSaleSnapshot {
  id                  String   @id @default(cuid())
  merchantId          String
  storeId             String
  bindingId           String
  sourceOrderId       String   @unique
  soldAt              DateTime
  status              String
  subtotalTwd         BigInt
  discountTwd         BigInt
  totalTwd            BigInt
  commissionRateBps   Int
  commissionTwd       BigInt
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id])
  store    Store    @relation(fields: [storeId], references: [id])
  binding  MerchantStoreBinding @relation(
    fields: [bindingId, merchantId],
    references: [id, merchantId]
  )
  sourceOrder Order @relation(
    fields: [sourceOrderId, merchantId],
    references: [id, merchantId]
  )
  lines MerchantSaleSnapshotLine[]

  @@unique([id, merchantId])
  @@unique([sourceOrderId, merchantId])
  @@index([merchantId, storeId, soldAt])
}

model MerchantSaleSnapshotLine {
  id                         String @id @default(cuid())
  merchantId                 String
  snapshotId                 String
  sourceOrderId              String
  sourceOrderItemId          String @unique
  productId                  String
  productNameSnapshot        String
  tierSnapshot               String?
  merchantStockId            String
  policyId                   String?
  policyVersion              Int
  quantity                   Int
  unitPriceTwd               BigInt
  lineGrossTwd               BigInt
  discountTwd                BigInt
  actualGrossTwd             BigInt
  commissionRateBpsSnapshot  Int
  commissionTwdSnapshot      BigInt
  createdAt                  DateTime @default(now())

  snapshot      MerchantSaleSnapshot @relation(
    fields: [snapshotId, merchantId],
    references: [id, merchantId]
  )
  sourceOrder Order @relation(
    fields: [sourceOrderId, merchantId],
    references: [id, merchantId]
  )
  merchantStock MerchantStock @relation(
    fields: [merchantStockId, merchantId],
    references: [id, merchantId]
  )

  @@unique([id, merchantId])
  @@unique([sourceOrderItemId, merchantId])
  @@index([snapshotId])
}
```

強制規則：

- header `sourceOrderId` unique：一張線上訂單最多一個 snapshot header。
- 每條 `sourceOrderItemId` unique：一個訂單項最多一條 snapshot line。
- line **必須自帶** `sourceOrderId`（或等價 key），不可只靠 header 推。
- line **必須**含 product、tier、merchantStock、policy version、rate、
  commission、actual gross。缺一不可建立。
- rounding **逐 line**：`commissionTwdSnapshot = round(actualGrossTwd × rate)`；
  header `commissionTwd` / `totalTwd` 是 line 加總，不是再 round 一次。
- snapshot **不是**第二套 payment／fulfillment 狀態。付款與履約仍讀 Order。

### 2.3.1 Snapshot↔Order 一致性（強制）

寫入與後續 UPDATE 都必須滿足：

```text
line.snapshot.sourceOrderId
  = line.sourceOrderId
  = OrderItem.orderId   -- 該 line.sourceOrderItemId 所指的那一列
```

`sourceOrderItemId` unique **保留**。

product／qty／price snapshot **必須來源於該 OrderItem**：

| 欄位 | 來源 | 落地方式 |
|---|---|---|
| `sourceOrderId` + `merchantId` | header 與 Order | composite FK → `Order[id, merchantId]`（能做就先 FK） |
| `sourceOrderItemId` + `merchantId` | 該 OrderItem | unique + 能做的 composite／經 Order 的 FK |
| `line.sourceOrderId = snapshot.sourceOrderId` | 同單 | 能刪冗餘就靠 FK 路徑；否則 DEFERRABLE constraint trigger |
| `line.sourceOrderId = OrderItem.orderId` | 同單 | DEFERRABLE constraint trigger（OrderItem 若無 merchant 欄） |
| `productId`／`quantity`／`unitPriceTwd` | 該 OrderItem | DEFERRABLE constraint trigger：必須等於該 item 當下權威值（或 item 自己的 snapshot 欄）。禁止手填另一張單的商品／數量／單價 |

Preview **negative test**（只定義，本輪不執行；以後 Preview fixture）：

- 同 merchant 的 Order B 的 item，掛到 Order A 的 snapshot → **必須失敗**。
- line.`sourceOrderId` ≠ header.`sourceOrderId` → 失敗。
- line.`sourceOrderId` ≠ 該 `sourceOrderItemId` 的 `OrderItem.orderId` → 失敗。
- product／qty／price 與該 OrderItem 不符 → 失敗。

### 2.4 Legacy Order 必須先有 merchant composite

`MerchantSaleSnapshot.sourceOrder` **不可**只做單欄 `sourceOrderId → Order.id`。

現況 `Order` 只有 `id` PK，沒有 `@@unique([id, merchantId])`。落庫前必須二選一：

1. **首選：** 在 `Order` 新增 `@@unique([id, merchantId])`，讓 Prisma composite
   relation 成立。這不改 Order 語意，只宣告「同一列的 id 與 merchantId 成對」。
2. **若 Prisma 無法改 legacy model：** 用 raw SQL 建
   `UNIQUE (id, merchant_id)` 與 `FOREIGN KEY (source_order_id, merchant_id)
   REFERENCES "Order"(id, merchant_id)`，或 DEFERRABLE constraint trigger
   當 precondition。

**禁止**「先單 FK，以後再補 composite」。沒有 merchant composite 就不建
`MerchantSaleSnapshot`。

`OrderItem` 同樣需要 `@@unique([id, merchantId])` 或對等 raw unique，才能讓
`sourceOrderItemId + merchantId` 成為真 FK。若 `OrderItem` 本身沒有
`merchantId`，必須經 `Order` 做 constraint trigger：snapshot line 的
`merchantId` 必須等於該 item 所屬 Order 的 `merchantId`。

### 2.5 統一可退款來源

```prisma
model RefundRequest {
  id                  String   @id @default(cuid())
  merchantId          String
  sourceKind          String
  posSaleId           String?
  saleSnapshotId      String?
  status              String
  reason              String
  refundDisposition   String
  requestedAmountTwd  BigInt
  approvedAmountTwd   BigInt?
  idempotencyRecordId String   @unique
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  posSale      PosSale?               @relation(fields: [posSaleId, merchantId], references: [id, merchantId])
  saleSnapshot MerchantSaleSnapshot?  @relation(fields: [saleSnapshotId, merchantId], references: [id, merchantId])
  lines        RefundLine[]
  idempotencyRecord PosIdempotencyRecord @relation(
    fields: [idempotencyRecordId, merchantId],
    references: [id, merchantId]
  )

  @@unique([id, merchantId])
}

model RefundLine {
  id                         String  @id @default(cuid())
  merchantId                 String
  refundRequestId            String
  sourceKind                 String
  posSaleLineId              String?
  saleSnapshotLineId         String?
  quantity                   Int
  amountTwd                  BigInt
  commissionReversalSnapshot BigInt
  refundDisposition          String
  createdAt                  DateTime @default(now())

  refundRequest    RefundRequest             @relation(fields: [refundRequestId, merchantId], references: [id, merchantId])
  posSaleLine      PosSaleLine?              @relation(fields: [posSaleLineId, merchantId], references: [id, merchantId])
  saleSnapshotLine MerchantSaleSnapshotLine? @relation(fields: [saleSnapshotLineId, merchantId], references: [id, merchantId])

  @@unique([id, merchantId])
}
```

Exactly-one CHECK（header 與 line 都要）：

```sql
-- RefundRequest
CHECK (
  (source_kind = 'pos_sale'
    AND pos_sale_id IS NOT NULL
    AND sale_snapshot_id IS NULL)
  OR
  (source_kind = 'sale_snapshot'
    AND sale_snapshot_id IS NOT NULL
    AND pos_sale_id IS NULL)
)

-- RefundLine
CHECK (
  (source_kind = 'pos_sale_line'
    AND pos_sale_line_id IS NOT NULL
    AND sale_snapshot_line_id IS NULL)
  OR
  (source_kind = 'sale_snapshot_line'
    AND sale_snapshot_line_id IS NOT NULL
    AND pos_sale_line_id IS NULL)
)
```

兩個來源都是**真 FK + merchant composite FK**，不是只存字串 id。

### 2.5.1 Refund header／line 必須同一來源

exactly-one CHECK 不夠。還要 DEFERRABLE constraint trigger（或重構 FK
讓 line 經 header 走到同一 parent，禁止交叉指向）。必須同時保證：

1. **kind 一致**
   - request `source_kind = 'pos_sale'` ↔ 每條 line `source_kind = 'pos_sale_line'`
   - request `source_kind = 'sale_snapshot'` ↔ 每條 line `source_kind = 'sale_snapshot_line'`
2. **parent 同一張單**
   - POS：`PosSaleLine.saleId = RefundRequest.posSaleId`
   - 線上：`MerchantSaleSnapshotLine.snapshotId = RefundRequest.saleSnapshotId`
3. **禁止交叉與同店不同單**
   - header POS + line snapshot → 失敗
   - header snapshot + line POS → 失敗
   - 同 merchant 但 line 屬於另一張 sale／另一張 snapshot → 失敗

累計退款金額／數量、佣金 exact cumulative、庫存 identity 的
`SELECT ... FOR UPDATE` **都鎖該真正來源 line**
（`PosSaleLine` 或 `MerchantSaleSnapshotLine`），不是只鎖 header、
也不是鎖 client 傳來的另一個 id。

線上部分退款、disposition、回庫、佣金回沖、locked-period routing **全部**
必須從 `MerchantSaleSnapshotLine` 追溯：

| 動作 | 追溯欄位 |
|---|---|
| 部分退款累計 | lock 該 `saleSnapshotLineId`；`SUM(amountTwd)` / `SUM(quantity)` |
| disposition | line 自己的 `refundDisposition`；依 §11.1.1 O1 決定是否加 onHand |
| 回庫 | `merchantStockId` on 該來源 line；未履約取消只 release reserved；已履約且實物退回見 §11.1.1 |
| 佣金回沖 | lock 同一來源 line 的 `commissionTwdSnapshot` + `actualGrossTwd` + rate |
| locked-period | 來源 line → 其 header `soldAt` → 該 binding／店該期 settlement |
| binding | 從 fact header 的 `bindingId` 追溯，不接受 client `storeId` |

沒有 snapshot line 就不允許線上退款寫入 POS 新表。

Preview **negative tests**（只定義，本輪不執行）：

- header `pos_sale` + 任一 line `sale_snapshot_line` → 失敗。
- header `sale_snapshot` + 任一 line `pos_sale_line` → 失敗。
- line 的 `PosSaleLine.saleId` ≠ request.`posSaleId` → 失敗。
- line 的 `SnapshotLine.snapshotId` ≠ request.`saleSnapshotId` → 失敗。
- 同 merchant、兩張不同 PosSale／Snapshot 交叉掛在同一 RefundRequest → 失敗。
- 累計超過來源 line 的 amount／qty，或佣金不等於剩餘淨額公式 → 失敗。

---

## 3. 所有 idempotency／result 必須 merchant-safe

### 3.1 唯一冪等表

```prisma
model PosIdempotencyRecord {
  id         String   @id @default(cuid())
  merchantId String
  scope      String
  key        String
  fingerprint String
  status     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id])

  @@unique([id, merchantId])
  @@unique([merchantId, scope, key])
}
```

業務表**不得**再自建 `idempotencyKey` 字串欄。只存 `idempotencyRecordId`。

### 3.2 每個 business result 的 relation

下列每一張 result 表都必須：

1. `idempotencyRecordId String @unique`
2. composite FK
   `[idempotencyRecordId, merchantId] → PosIdempotencyRecord[id, merchantId]`
3. 該 result 自己的 `@@unique([id, merchantId])`

覆蓋範圍（全部，不可漏）：

- `PosSale`
- `RefundRequest`
- `PosInventoryLedger`
- `InventoryReservation`
- `PosSettlementV2` 與 `PosSettlementAdjustment`
- 未來任何 POS business result（補貨轉換、券取消副作用列）

**禁止**只寫：

```prisma
idempotencyRecord PosIdempotencyRecord @relation(fields: [idempotencyRecordId], references: [id])
```

那會讓 A 店的 result 指到 B 店的冪等列。

### 3.3 Duplicate lookup 順序

每次、含 retry，固定：

1. 驗 session merchant 或 HQ auth。HQ 必須通過 POS-01 allow-list。
   未通過直接拒絕，**不得**先查 key。
2. 用 **該次已驗證** 的 `merchantId + scope + key` 查 `PosIdempotencyRecord`。
3. 比對 fingerprint。不同 fingerprint → throw。
4. 讀 result 時也走 composite：`result.idempotencyRecordId + merchantId`。

跨店同一把 key 必須當成兩筆。不得做 global key lookup。

### 3.4 Order／reservation／refund／ledger／settlement ownership

| 關係 | 必要 composite |
|---|---|
| Snapshot → Order | `[sourceOrderId, merchantId] → Order[id, merchantId]` |
| SnapshotLine → OrderItem | unique `sourceOrderItemId` + merchant 對等檢查 |
| SnapshotLine → Order | line 自帶 `[sourceOrderId, merchantId]`；且 = header 與 `OrderItem.orderId` |
| Reservation → PosSale 或 Snapshot | exactly-one + composite FK；binding 從 fact 追溯 |
| RefundRequest → PosSale 或 Snapshot | exactly-one + composite FK |
| RefundLine → PosSaleLine 或 SnapshotLine | exactly-one + 與 header 同一 parent（§2.5.1） |
| Ledger → MerchantStock | `[merchantStockId, merchantId]` |
| Settlement → Merchant + period | merchant 必填；approved 後不可改 merchant |

Legacy `Order` 若還沒有 `[id, merchantId]` unique，見 §2.4，**不可只單 FK**。

---

## 4. MerchantStoreBinding 雙向 1:1 active

### 4.1 擬議模型

```prisma
model MerchantStoreBinding {
  id            String    @id @default(cuid())
  merchantId    String
  storeId       String
  status        String
  effectiveFrom DateTime
  effectiveTo   DateTime?
  verifiedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id])
  store    Store    @relation(fields: [storeId], references: [id])
  policies MerchantVoucherPolicy[]

  @@unique([id, merchantId])
  @@index([merchantId, status])
  @@index([storeId, status])
}
```

### 4.2 必須落地的 invariant

| 規則 | 實作 |
|---|---|
| 同一時間一個 merchant 最多一個 active binding | partial unique：`UNIQUE (merchant_id) WHERE status = 'active'` |
| 同一時間一個 store 最多一個 active binding | partial unique：`UNIQUE (store_id) WHERE status = 'active'` |
| 期間方向 | `CHECK (effective_to IS NULL OR effective_to > effective_from)` |
| revoked 與 effective 一致 | `CHECK (status <> 'revoked' OR effective_to IS NOT NULL)`；active 列 `effective_to IS NULL` 或 `effective_to > now()` 由寫入交易與 constraint trigger 維持 |
| 狀態 allow-list | `CHECK (status IN ('pending_verify', 'active', 'revoked'))` |

「雙向 1:1 active」意思是：一個有效店家不能同時綁兩家店，一家有效店也不能
同時綁兩個店家。歷史 revoked 列可以很多，不佔 active unique。

### 4.3 權威與 fail closed

- `StoreMerchantBindingAudit` **只是候選**，不是 runtime 權威。
- 只有 `status = 'active'` 且 `verifiedAt IS NOT NULL` 的 binding 才是
  runtime 權威。
- 未綁、pending、revoked、verifiedAt 為空 → **fail closed**。
- POS 開班、寫店收、發券、建 reservation 之前都必須讀到 verified active
  binding。找不到就拒絕，不得 fallback 店名或 audit 列。

### 4.4 Fact 必須保存 authoritative binding

`PosSale` 與 `MerchantSaleSnapshot` **寫入當下**就要存 `bindingId` snapshot：

- composite FK `[bindingId, merchantId] → MerchantStoreBinding[id, merchantId]`。
- DEFERRABLE constraint trigger 再驗：
  1. `binding.storeId = fact.storeId`
  2. 成交／快照時間 `soldAt` 落在該 binding 的 verified／effective 有效期
     （`verifiedAt IS NOT NULL`、`soldAt >= effectiveFrom`、
     `effectiveTo IS NULL OR soldAt < effectiveTo`）。
  3. 寫入當下該 binding 必須是 verified；**保存後即使後來 revoked，歷史
     fact 仍指向那一列**，不得改寫或改掛新 binding。
- Reservation／Refund **只從 fact header 的 `bindingId` 追溯**。
  API **不接受** client 另傳 `storeId` 或 `bindingId` 覆寫。
- 之後的 locked-period routing、券政策、佣金店別，都以 fact 上那筆
  歷史 binding 為準，不是「現在 active 的那一筆」。

Preview **negative tests**（只定義，本輪不執行）：

- A merchant + B store／B 的 binding → 失敗。
- binding `verifiedAt` 為空或 `pending_verify` → 失敗。
- `soldAt` 早於 `effectiveFrom`，或已過 `effectiveTo` → 失敗。
- reservation／refund 帶與 fact 不同的 client `storeId` → 失敗（忽略或拒絕）。

---

## 5. MerchantVoucherPolicy 可落地

### 5.1 擬議模型

```prisma
model MerchantVoucherPolicy {
  id            String    @id @default(cuid())
  merchantId    String
  bindingId     String
  version       Int
  faceTwd       BigInt
  status        String
  effectiveFrom DateTime
  effectiveTo   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  binding MerchantStoreBinding @relation(
    fields: [bindingId, merchantId],
    references: [id, merchantId]
  )

  @@unique([id, merchantId])
  @@unique([bindingId, version])
}
```

### 5.2 必須落地的 invariant

| 規則 | 實作 |
|---|---|
| 掛在 binding 上 | composite FK `[bindingId, merchantId] → Binding[id, merchantId]` |
| version | 同一 binding 內遞增；`@@unique([bindingId, version])` |
| 期間 | `CHECK (effective_to IS NULL OR effective_to > effective_from)` |
| 期間不重疊 | GiST exclusion `tstzrange(effective_from, effective_to, '[)')` per `binding_id`，或 partial unique + constraint trigger。普通 CHECK **不夠** |
| active | `CHECK (status IN ('draft', 'active', 'retired'))`；runtime 只接受 active |
| faceTwd | `CHECK (face_twd IN (200, 250))`。決策固定只允許這兩個面額 |
| 無 policy | fail closed，不得用程式寫死 200／250 當預設 |

### 5.3 普通店與豬窩都資料驅動

兩種店都讀 `MerchantVoucherPolicy`。差別只在列的 `faceTwd` 與 binding。
O3 未確認 → **不 seed** 任何豬窩正式 ID，也不寫中文店名當 key。

發券／核銷／取消前：

1. 先通過 verified active binding gate。
2. 再讀該 binding 當下 active policy。
3. 沒有 policy → 拒絕。

---

## 6. Reservation 完整 DB invariant

### 6.1 擬議模型

```prisma
model InventoryReservation {
  id                  String    @id @default(cuid())
  merchantId          String
  merchantStockId     String
  sourceKind          String
  posSaleId           String?
  saleSnapshotId      String?
  quantity            Int
  status              String
  reservedAt          DateTime
  releasedAt          DateTime?
  fulfilledAt         DateTime?
  idempotencyRecordId String    @unique
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  merchantStock MerchantStock @relation(
    fields: [merchantStockId, merchantId],
    references: [id, merchantId]
  )
  posSale      PosSale?              @relation(fields: [posSaleId, merchantId], references: [id, merchantId])
  saleSnapshot MerchantSaleSnapshot? @relation(fields: [saleSnapshotId, merchantId], references: [id, merchantId])
  idempotencyRecord PosIdempotencyRecord @relation(
    fields: [idempotencyRecordId, merchantId],
    references: [id, merchantId]
  )

  @@unique([id, merchantId])
}
```

### 6.2 DB invariant

| 規則 | 實作 |
|---|---|
| exactly-one source | CHECK：`pos_sale` XOR `sale_snapshot`；兩者皆真 composite FK |
| quantity > 0 | `CHECK (quantity > 0)` |
| status allow-list | `CHECK (status IN ('paid_reserved', 'released', 'fulfilled'))`。**沒有** `unpaid_hold` |
| active uniqueness | partial unique：同一 `(merchant_stock_id, pos_sale_id)` 或 `(merchant_stock_id, sale_snapshot_id)` 最多一列 `status = 'paid_reserved'` |
| 未付款不建 reservation | 寫入交易 precondition：店內必須已付款；線上必須 Order／Payment 已付。DB 用 constraint trigger 再擋一次 |
| paid reserve 不自動 expire | 沒有 expire job 可把 `paid_reserved` 改成 released。只有明確 release／fulfill／人工 HQ 流程 |
| 與庫存同交易 | `reserve` / `release` / `fulfill` 必須與 `MerchantStock.reserved` / `onHand` 及 `PosInventoryLedger` **同一 transaction** |
| onHand >= reserved | `CHECK (on_hand >= reserved)` 在 `MerchantStock`；跨表累計用 lock + constraint trigger |
| binding 從 fact 來 | reservation 的 store／binding 只讀 `PosSale.bindingId` 或 `MerchantSaleSnapshot.bindingId`，不接受 client `storeId` |
| 未履約取消 | 只把 `paid_reserved` → `released` 並減少 `reserved`；**不** `onHand += qty`（O1） |
| 已履約回庫 | 見 §11.1.1：實物退回 + HQ 核准 + 可再售才 `onHand += qty` |

### 6.3 同交易順序

1. `SELECT ... FOR UPDATE` lock `MerchantStock`。
2. 驗證付款已成立；未付 → 不建 reservation。
3. 插入／更新 `InventoryReservation`。
4. 更新 `reserved`；**未履約取消到此為止，不增加 `onHand`**。
5. 插入 `PosInventoryLedger`（release 事件；不是 restock 事件）。
6. 提交。任何一步失敗整筆回滾。

`onHand`／`reserved` **不可 DEFAULT 0**。新列必須由這筆交易寫入真實數字。

已履約後的實物退回不是 reservation 的自動動作，走 Refund + HQ 核准 +
§11.1.1 條件後，另開 ledger restock 或 loss。

---

## 7. Constraint matrix（改正版）

### 7.1 普通 CHECK 不能跨表

v0.2 若讀起來像「CHECK 能保證跨表累計」，那是錯的。改正如下：

| 不變量 | 普通 CHECK 夠嗎 | 正確擁有者 |
|---|---|---|
| 單列 allow-list、quantity>0、exactly-one null pair、faceTwd ∈ {200,250}、onHand>=reserved、effectiveTo>effectiveFrom | 夠 | column CHECK |
| 同表單列 unique、partial unique | 夠 | UNIQUE / partial UNIQUE |
| parent／child 同 merchant | 普通 CHECK 不夠 | composite FK；能刪冗餘複製 merchantId 的地方就刪，改由 FK 帶 |
| 跨表加總（退款累計 ≤ 原 line、佣金 exact cumulative） | 普通 CHECK 不夠 | transaction 中 `SELECT ... FOR UPDATE` 原 line + constraint trigger |
| 跨表 stock identity（ledger／reservation 的 stock 必須等於 sale line 的 stock） | 普通 CHECK 不夠 | composite FK 能連就連；不能連就 constraint trigger |
| approved settlement 不可變 | 普通 CHECK 不夠；**也不准只用 REVOKE 取代** | BEFORE UPDATE／DELETE trigger 擋 `status = 'approved'`；permission 可當額外防護，但 app owner 可能與執行 role 相同，REVOKE 不可當唯一控制 |
| 期間不重疊 | 普通 CHECK 不夠 | GiST exclusion 或 constraint trigger |
| 跨表付款 precondition（未付款不建 reservation） | 普通 CHECK 不夠 | 寫入交易 + DEFERRABLE constraint trigger |
| snapshot line 與 Order／OrderItem 同單 | 普通 CHECK 不夠 | line.`sourceOrderId` composite FK + DEFERRABLE trigger（§2.3.1） |
| refund header／line 同一張單 | 普通 CHECK 不夠 | DEFERRABLE trigger 或經 header 重構 FK（§2.5.1） |
| fact.binding.storeId 與有效期 | 普通 CHECK 不夠 | composite FK + DEFERRABLE trigger（§4.4） |

能刪的冗餘值：若 child 的 `merchantId` 只是為了 CHECK 對上 parent，且已有
`FOREIGN KEY (parent_id, merchant_id) REFERENCES parent(id, merchant_id)`，
不要再加第二份「複製 merchantId 再 CHECK 相等」除非 Prisma 需要該欄做
composite relation。本提案各 child 保留 `merchantId` 是因為 Prisma composite
FK **需要**該欄，不是為了假裝 CHECK 能跨表。

### 7.2 必須用 lock + constraint trigger 的三項

1. **Refund amount／qty 累計**
   - 交易內 lock 原 `PosSaleLine` 或 `MerchantSaleSnapshotLine`。
   - trigger：`SUM(refund_line.amount_twd) <= source.actual_gross_twd`
   - trigger：`SUM(refund_line.quantity) <= source.quantity`
   - 財務 fully reversed 只看 amount；quantity 只約束實物。

2. **Commission exact cumulative**
   - 同一把 lock。
   - trigger：既有回沖加總必須 **精準等於**
     `originalCommission - round(remainingNet × originalRate) - alreadyReversed`
     的累計結果，不得只檢查 `<=`。
   - 少回沖或多回沖都失敗。

3. **Stock identity**
   - reservation／ledger／refund-restock 的 `merchantStockId` 必須等於來源
     sale line 或 snapshot line 的 `merchantStockId`。
   - 能 FK 就 FK；跨兩跳（RefundLine → SaleLine → Stock）用 constraint trigger。

### 7.3 新表建立即帶可行 constraints

V2 表第一個 migration 就必須帶：

- PK、`@@unique([id, merchantId])`
- 需要的 composite FK
- 單列 CHECK
- partial unique（binding active、reservation active、idempotency key）
- exactly-one CHECK
- 跨表 constraint trigger 與 lock 協定寫在同一份 migration 註解與 SQL

**禁止**「先建裸表、下一輪再補 constraint」。

### 7.4 不要用 REVOKE 取代 immutability

`Settlement.approved` 與未來 `PosSettlementV2.approved`：

- 用 `BEFORE UPDATE OR DELETE` trigger：若舊列已 approved → `RAISE`。
- 可用獨立 DB role 做額外權限，但**不得宣稱 REVOKE 已足夠**。
- 應用程式連線若是 table owner，REVOKE 對自己無效。

---

## 8. 唯一金額型別：BigInt 整數 TWD

### 8.1 選定，不再寫「或」

**唯一方案：PostgreSQL `BIGINT` ↔ Prisma `BigInt` ↔ 領域整數 TWD。**

不採用 `Decimal(18,0)`。理由：

- POS-01 已凍結「新月結只接受整數 TWD」。沒有小數位需求。
- `Decimal(18,0)` 在 Prisma／JS 仍是物件，JSON 與 BigInt 一樣要自訂序列化，
  沒有比較省事，卻多一種與 POS-01 `number` 對照的轉換路徑。
- `BIGINT` 與整數 TWD 一一對應，ledger／settlement／line 可用同一型別。
- 範圍 ±9.22e18，遠大於任何店月結。

### 8.2 全層 mapping

| 層 | 型別 | 規則 |
|---|---|---|
| PostgreSQL | `BIGINT` | 金額欄一律 `BIGINT NOT NULL`（允許 0 的欄才寫 0，不 DEFAULT 造假） |
| Prisma schema | `BigInt` | 不得用 `Int`、`Float`、`Decimal`、`String` 存金額 |
| Prisma Client | `bigint` | 查詢結果是 JS `bigint` |
| Domain／POS-01 | `number`（safe integer） | Persistence adapter **顯式** `Number(value)` 前必須檢查 `value >= 0n && value <= 9007199254740991n`；超出 throw。禁止隱式 `+value`、`value * 1`、JSON 自動降成 Number |
| API／Next.js JSON | **string** | `JSON.stringify` 預設不能安全處理 bigint。response 必須把金額輸出成十進位字串，例如 `"250"`。request 只接受十進位整數字串，伺服器再 `BigInt(s)` |
| 前端 | parse／format | parse：只接受 `/^[0-9]+$/` 字串 → 顯示用十進位。format：不得先轉 IEEE Number 再顯示大額。POS 畫面金額在 safe integer 內可用 Number 做 UI，但送回 API 仍是字串 |
| 測試 | string 或 bigint | fixture 不得用 Float |

### 8.3 一致範圍

下列欄位全部是 BigInt，禁止 line 用 Int、header 用 BigInt 混用：

- sale／snapshot header：`subtotalTwd`、`discountTwd`、`totalTwd`、`commissionTwd`
- sale／snapshot line：`unitPriceTwd`、`lineGrossTwd`、`discountTwd`、`actualGrossTwd`、`commissionTwdSnapshot`
- refund：`requestedAmountTwd`、`approvedAmountTwd`、`amountTwd`、`commissionReversalSnapshot`
- ledger：`unitCostTwd` 若有、adjustment 金額
- settlement／adjustment：所有 TWD 欄
- voucher policy：`faceTwd`

`quantity` 仍是 `Int`（件數，不是金額）。`commissionRateBps` 是 `Int`（basis points）。

### 8.4 禁止隱式 Number 轉換

Persistence adapter 必須提供唯一函式，例如 `twdBigIntToPos01Number(value: bigint): number`：

1. 拒絕負數（POS-01 金額 ≥ 0）。
2. 拒絕 `> Number.MAX_SAFE_INTEGER`。
3. 用 `Number(value)` 且 round-trip `BigInt(number) === value`。
4. 失敗 throw，不得靜默截斷。

API route、Server Action、client fetch **不得**直接 `JSON.parse` 後把金額當
Number 做加減。必須走字串 → BigInt（伺服器）或字串 → 顯示（前端）。

---

## 9. 現況落差（只讀，供文件對照）

| 對象 | 現況 | 本提案 |
|---|---|---|
| 店內店收 | 無 POS 表 | `PosSale` + `PosSaleLine` |
| 線上店收 | Order 是權威；無 POS 投影 | Snapshot header + **line** |
| 退款 | 無統一 line 來源 | exactly-one PosSaleLine XOR SnapshotLine |
| 冪等 | 無 | composite `[id, merchantId]` + result unique |
| Order ownership | 只有 `id` PK | 必須先加 `@@unique([id, merchantId])` 或 raw 對等 |
| Binding | 只有 audit | 雙向 1:1 active + verified 才權威 |
| 美容券政策 | 無 | 掛 binding、faceTwd 200／250、不重疊 |
| Reservation | 無 | exactly-one、未付不建、paid 不自動過期 |
| 金額 | 混用 Int／Float／「或 Decimal」 | **只有 BigInt** |
| Settlement | 可刪 approved | trigger，不是只靠 REVOKE |

完整現況表見 v0.2 已列項目；本節只補 gate 相關落差。Drift #112–#115 仍是
建 migration 的 prerequisite blocker，本輪不建 migration。

---

## 10. Float audit 寫法（文件 only）

本輪**不執行**任何 SQL。下列語句只能在 **Preview fixture** 用 EXPLAIN／
實際列驗證後，才可以成為後續 gate。**不可直接對 Production 執行。**

### 10.1 NaN — 禁止 `x <> x`

`x <> x` 不是可靠、可審查的 NaN 寫法。改用：

```sql
-- Preview fixture 驗證用，不在本輪執行
SELECT id, value
FROM some_float_column_table
WHERE value = 'NaN'::float8;
```

若某環境對 `= 'NaN'::float8` 行為有疑義，改用 **Preview 已驗證** 的 text 法：

```sql
WHERE value::text IN ('NaN', '-NaN')
```

**不要**用 `x <> x`。`x <> x` 在文件與 review 中視為未關閉。

### 10.2 Infinity／非整數／round-trip

同樣標成 Preview fixture／EXPLAIN 驗證後才可用於 gate：

```sql
-- Infinity
WHERE value = 'Infinity'::float8 OR value = '-Infinity'::float8
-- 或 text：value::text IN ('Infinity', '-Infinity')

-- 非整數（財務欄不該有小數）
WHERE value <> trunc(value)

-- IEEE round-trip 可疑列
WHERE value::text::float8 <> value
```

這些語句的可用性以 Preview 實際結果為準。本文件只定寫法，不宣稱已在
Production 數過列數。

---

## 11. 庫存、結算、cutover（沿用並收斂）

### 11.1 庫存

- `PosInventoryLedger` 是未來 event 真相。
- `MerchantStock.onHand` / `reserved` 是同交易 materialized view。
- 不可 `DEFAULT 0`。
- `quantity` 只當過渡 mirror，cutover 後不再當權威。
- ledger 與 reservation 的冪等走 §3 composite FK。

### 11.1.1 O1 回庫（正確文字；全文以此為準）

正確規則：

| 情境 | 庫存動作 |
|---|---|
| 未履約取消（已付款但尚未 fulfill） | 只 `release reserved`（`reserved -= qty`）。**不**新增 `onHand`。 |
| 已履約，且實物退回，HQ 核准，狀態為未拆封／良好／可再售 | `onHand += qty`，並寫 restock ledger。 |
| 已履約，且實物退回，HQ 核准，但不可售（拆封／損壞／污染等） | 只寫 **loss** ledger。**不加**可售 `onHand`。 |
| 已履約但沒有實物退回 | 不增加 `onHand`，也不假裝 restock。 |

`refundDisposition` 必須能區分：`release_only`、`restock_sellable`、
`loss_unsellable`。未履約取消不得選 `restock_sellable`。
POS-01 程式仍未凍結此規則；本節只修正文件，不覆蓋 POS-01 程式。

### 11.2 結算

- 新月結只讀 V2 整數列（BigInt）。
- 不與 legacy Float 混算。
- approved 後不可變：trigger，不是只靠 REVOKE。
- locked period 的線上退款從 snapshot line → header `soldAt` routing。

### 11.3 Cutover

- 真實店家在 writer cutover 前不准寫新帳（no-real-POS）。
- 禁止「POS 寫新表、HQ 仍只讀 legacy」造成漏結算。
- writer-by-writer 順序與 rollback（停新寫、回 legacy 讀、不刪 V2 不可變列）
  見 `docs/POS-02-MIGRATION-PLAN.md`。

---

## 12. Acceptance checklist 與證據

| # | Gate | 本文件證據 |
|---|---|---|
| 1 | 線上 line snapshot + 統一退款來源 | §2.3 `MerchantSaleSnapshotLine`（header／line `sourceOrderId`、`sourceOrderItemId` unique、逐 line rounding、必含 product／tier／stock／policy／rate／commission／gross）；§2.5 RefundRequest／RefundLine exactly-one CHECK + 雙真 composite FK；部分退款／disposition／回庫／佣金／鎖帳都從 snapshot line 追溯 |
| 2 | Composite idempotency | §3.2 所有 result 皆 `[idempotencyRecordId, merchantId] → PosIdempotencyRecord[id, merchantId]` 且 `idempotencyRecordId` unique；§3.3 lookup 先驗 session 再查 merchant+scope+key；§2.4／§3.4 Order 必須 `@@unique([id, merchantId])` 或 raw 對等，不可只單 FK |
| 3 | Binding 雙向 1:1 | §4.2 partial unique active merchantId 與 active storeId；`effectiveTo > effectiveFrom`；revoked／effective 一致；§4.3 audit 只是候選，verified active 才權威，未綁 fail closed |
| 4 | Voucher policy | §5 composite FK `[bindingId, merchantId]`；version／effective／active；exclusion 不重疊；`faceTwd IN (200, 250)`；verified binding gate；無 policy fail closed；O3 不 seed |
| 5 | Reservation | §6 exactly-one + composite FK；quantity>0；status allow-list；active uniqueness；與 stock／ledger 同交易；`onHand >= reserved`；未付不建；paid 不自動 expire；binding 從 fact 追溯 |
| 6 | Constraint ownership | §7 普通 CHECK 只管單列；跨表用 composite FK、row lock、constraint trigger；刪得掉的冗餘複製值就刪；approved immutability 用 trigger，不以 REVOKE 取代 |
| 7 | 唯一 money type | §8 選定 BigInt；Prisma／Postgres／JSON string／前端 parse／POS-01 Number 邊界與禁止隱式轉換；line／header／ledger／settlement／adjustment 一致 |
| 8 | Float audit 寫法 | §10 NaN 用 `value = 'NaN'::float8` 或已驗證 text 法，不用 `x <> x`；Infinity／非整數／round-trip 標 Preview fixture／EXPLAIN，不直接跑 Production |
| 9 | 仍只 2 docs | 本檔 + `docs/POS-02-MIGRATION-PLAN.md`。相對 POS-01 的 diff 不得含第三檔 |
| 10 | Snapshot↔Order 一致性 | §2.3.1 line 自帶 `sourceOrderId`；`line.snapshot.sourceOrderId = line.sourceOrderId = OrderItem.orderId`；product／qty／price 來自該 item；能 FK 先 FK，其餘 DEFERRABLE trigger；Preview negative：Order B item 掛 Order A snapshot 必須失敗 |
| 11 | Refund header／line 同一來源 | §2.5.1 kind 一致、parent sale／snapshot 一致；禁止 header POS + line snapshot 與同店不同單；累計／佣金／庫存 lock 真正來源 line；列 negative tests |
| 12 | Fact 保存 authoritative binding | §4.4 `PosSale`／`MerchantSaleSnapshot` 存 `bindingId`；`[bindingId, merchantId]` composite FK；trigger 驗 `storeId` 與 verified／effective 期；歷史 binding 即使後來 revoked 仍保留；reservation／refund 不接受 client `storeId`；Preview negative：A+B、未 verified、超出有效期均 fail |
| 13 | O1 回庫文字 | §1.3、§6.2、§11.1.1：未履約取消只 release reserved、不加 onHand；已履約且實物退回、HQ 核准後可再售才 `onHand += qty`，不可售只寫 loss |

---

## 13. 待 POS-01／營運確認（本提案不猜）

1. **O1 contract bump：** 把 §11.1.1 的回庫規則寫進 POS-01 程式與測試
   （未履約取消只 release；已履約實物退回才 restock 或 loss）。
2. **O3：** 豬窩三店正式 immutable IDs。
3. **Production drift #112–#115：** 關閉後才能建 POS-02 migration。
4. **Order／OrderItem composite unique：** schema 階段才能真正加上；本輪只規定
   沒有它就不建 snapshot FK。

---

## 14. 本輪結束條件

- 只改兩份 docs。
- `git diff --check` 通過。
- commit／push 同一 PR #128。
- 回報新 head SHA。
- 停止等 review。不建 schema、不進 POS-03。
