# POS-02 Persistence Proposal

> **地位：** POS 帳務／庫存／美容券／結算的**持久化設計稿**（只討論以後怎麼落庫，本輪不改資料庫）
> **版本：** v0.1
> **日期：** 2026-08-17
> **承接：** 已核准 PR #126 head `fc067be26a9df60c94d4e04b6ca9081f42cb9caf`（POS-01 Domain Contract v1.5）
> **基準：** `origin/main` @ `bbe580975af62476d62884813ad8b73bf2984b96`
> **範圍：** 兩份文件。本檔＋`docs/POS-02-MIGRATION-PLAN.md`
> **本輪硬禁止：** 不改 `prisma/schema.prisma`、不新增 migration、不跑 Prisma／SQL／Supabase、不改 API／UI／service／tests／package／env、不部署、不讀寫正式資料
> **下一步：** 三方 review 通過前不得進入 POS-03

---

## 0. 這份文件在做什麼

POS-01 已經用純函式寫死「可以做／不可以做」。
POS-02 只回答：**以後這些事實要存在哪一張表、誰能改、誰不能改、怎樣避免變成第二套帳。**

用白話說：

- 現在 HQ 後台的寄賣銷售、結算、庫存，已經有一組舊帳（`Order`、`MerchantStockTxn`、`Settlement`）。
- 若 POS 再各寫各的，月底會對不上。
- 所以新 POS 帳必須是**新的不可變帳本**，舊帳繼續活著，直到以後人工核准的 cutover。
- 本輪**零資料庫變更**。下面的 Prisma 區塊只是設計草稿，不是可執行 migration。

---

## 1. 已凍結（含本輪補上的 O1）

POS-01 R1–R10 全部沿用。本輪另外凍結 **O1（退款回庫）**：

| 情況 | 誰申請 | 誰核准 | 庫存結果 |
|------|--------|--------|----------|
| 未拆封、良好、可再售 | 店家申請 | **只有 HQ** | 回**該門市**可售庫存（`RESTOCK_SELLABLE` + `UNOPENED_GOOD_RESELLABLE`） |
| 已拆封／破損／變質／不可售 | 店家申請 | **只有 HQ** | **不回可售庫存**；另建不可變損耗（`WRITE_OFF` + `OPENED`／`DAMAGED`／`SPOILED`／`OTHER_UNSELLABLE`）。`OTHER` 必須填說明 |

其他凍結：

- 店家**不能**自行核准退款、回庫、改佣金或結算。
- HQ 核准時：退款金額、佣金回沖、庫存處理必須在**同一受保護 transaction／workflow**，且冪等。
- 原 sale 已進 `approved`／`paid` 結算：退款與佣金沖銷進**次期**，不重開舊期。
- **退款金額**與**實物 disposition** 分開：金額全退就可以財務 `fully_reversed`；東西能不能回架是另一筆決定。

**O3 仍未決：** 豬窩三店正式 immutable IDs。本檔只留空位，不填猜測 ID，不用中文店名辨識。

POS-01 程式裡的 `POS_01_OPEN_DECISIONS.refundRestockReason` 仍標 `UNDECIDED`。本輪**不改那 3 個 POS-01 檔**；O1 以本提案為準，等後續合約 bump。

---

## 2. 現況盤點（只讀，不改 Production）

### 2.1 現有模型在做什麼

| 現有模型 | 現在是什麼真相 | POS-02 怎麼對待 |
|----------|----------------|-----------------|
| `Merchant` / `MerchantUser` / `MerchantSettings` | 店與 POS 登入（`Merchant.id` = cuid；session 只信這個） | **沿用**。`merchantId` 只能來自 POS session |
| `MerchantStock` | 店×商品×規格的**目前數量**（只有 `quantity`，沒有 reserved；可寫成負） | **擴充、不當財務真相**。`id` 當 server-resolved `inventoryAggregateId` |
| `MerchantStockTxn` | HQ 寄賣**現行結算來源**（`type=sale` + 未配對的負 `adjust`）。金額是 Float；可刪未結清列；無冪等 key | **舊 HQ 帳繼續用**。**不是** POS 新財務真相。不可再讓 POS 銷售雙寫進這裡當第二套佣金 |
| `Order` / `OrderItem` | 網站／LINE／寄賣訂單。金額 Float。快速銷售常常**沒有** Order | **顧客訂單真相**。POS 店內 completed sale **不**再用 Order 當佣金／結算來源 |
| `Settlement` | 期間加總 Float；`paid` 才禁刪，`approved` 現在仍可刪並解開 txn | **沿用表頭，擴充整數 line**。對齊 R5：`approved` 起不可刪、不可改金額 |
| `MerchantProductRule` | 現行 HQ **每商品**不同抽成（20%／30%） | 與 POS-01 R3（同店單一％）衝突。POS 新 sale **不讀此規則算佣金**；改讀店級整數％並 snapshot。舊規則留給 HQ 舊帳 |
| `Merchant.commissionRate` | Float 0.30 fallback，銷售路徑幾乎沒用 | 不當 POS 真相。新店級％另存整數 snapshot |
| `Shipment` / `ShipmentItem` | 出貨履約。code 在 shipped **或** delivered 就可能入店庫；合約只要 delivered | **沿用履約**。POS 入店庫只認 `delivered` |
| `RestockRequest` / `RestockRequestItem` | POS 一鍵叫貨；取消只在合約、service 還沒做 | **沿用申請**。取消事件另表，不把 `approved` 改寫成 `cancelled` |
| `GroomingCoupon` | LINE 美容券。`storeId`＝Store **slug**，不是 `Merchant.id`。面額 Float。過期不退點。公開核銷入口已退役 | **沿用券本體**。POS 核銷／取消走新 ledger／request，不把券表當結算加總來源 |
| `Store` | LINE／會員／券的 slug 空間 | **不與 Merchant 用店名硬配**。只做 audit／backfill／quarantine |
| `MemberPointsLedger` | 會員點數流水（Int）。兌換券已扣 10 點 | **沿用**退點 +10；新 source type + idempotency |
| `RefillOrder.idempotencyKey` | 換罐訂單已有 `@unique` 冪等 | **抄模式**，不把 refill 金額當 POS 寄賣帳 |
| `Warehouse` / `InventoryBalance` / `InventoryTransaction` | 總倉庫存，不是店庫存 | 不混用 |

### 2.2 Source-of-truth matrix（避免第二套帳）

| 事實 | 舊 HQ 真相（繼續活） | POS 新真相（本提案） | 禁止 |
|------|----------------------|----------------------|------|
| 店內／指定門市 completed sale 金額與佣金 | `MerchantStockTxn` Float snapshot（或缺欄重算規則） | `PosSaleLine` 整數 snapshot | 同一筆 POS 成交再寫一筆 Order 當結算來源 |
| 退款／佣金回沖 | **沒有**寄賣退款 persistence | `PosRefundLine` + `PosLedgerEntry` | 改寫原 sale 或原 txn |
| 庫存現況 | `MerchantStock.quantity` | 擴充後的 `onHand`／`reserved`；現況可由 ledger 重算核對 | POS 只改 quantity、不留 ledger |
| 庫存事件 | `MerchantStockTxn`（可刪） | `PosInventoryLedger` 不可變 | 用 `Set<string>` 或依目前庫存數字判斷重試 |
| 月結加總 | `Settlement` 重算／加總 txn | `PosSettlementLine` **只加總 snapshot** | 月底重算整月淨額×費率 |
| 美容券補貼 | 無結算 line | `PosLedgerEntry` kind=`voucher_fixed_subsidy` | 把券當商品折價、或用店名猜 200／250 |
| 顧客網站／訂閱訂單 | `Order` | 維持 Order | 不要把 POS 店收現金硬塞成第二套 Order 財務 |

一句話：**舊帳不刪、新帳不抄舊欄位當權威；POS 新寫入只進 `Pos*`（與安全擴充的店庫存）。**

---

## 3. 金額型別（禁止新 Float）

| 選項 | 優點 | 缺點 | 本提案 |
|------|------|------|--------|
| `Int` | 對齊 POS-01 `TwdInteger`（安全整數）；Prisma／JS 簡單 | 約 21 億封頂 | **推薦 line／adjustment／券額／佣金 snapshot** |
| `BigInt` | 幾乎不會溢位 | POS-01 helper 拒絕 JS BigInt；應用層要轉 | 僅當期間加總可能超過 `Int` 時備用；本階段期間加總仍用 `Int` + safe-add |
| `Decimal(18,0)` | DB 精確整數 | Prisma Decimal 在 JS 難用；合約要 number | 不採用 |
| `Decimal(12,2)`／`Float` | — | 分、精度漂移 | **禁止**新財務真相 |

**推薦：** 所有 POS sale／refund／commission／voucher／adjustment／settlement line 用 **`Int` 整數 TWD**。費率用 **`Int` 0–100**（30 代表 30%），不用 `0.30` Float。

既有 Float（`MerchantStockTxn.unitPrice`、`Settlement.grossSales`、`GroomingCoupon.discountAmount`、`Order.total`…）走 **expand → backfill → verify → dual-read → cutover → 以後才 contract**。非整數或不一致**不得自動四捨五入**，進 quarantine。細節見 migration plan。

月結：**只加總**各 line 已存的整數 snapshot，不重算。

---

## 4. Prisma 設計草稿（只存在文件，不改 schema）

以下區塊**不是**可對 Production 執行的 SQL，也**不可**直接貼進 `schema.prisma` 後 migrate。

```prisma
// DRAFT ONLY — POS-02 persistence proposal. Do not apply.

/// 店級佣金％（POS 新帳）。舊 MerchantProductRule 不當 POS 真相。
model PosMerchantCommissionPolicy {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  ratePercent        Int      @map("rate_percent") // 0–100
  effectiveFrom      DateTime @map("effective_from")
  supersededAt       DateTime? @map("superseded_at")
  createdByActor     String   @map("created_by_actor") // hq
  createdAt          DateTime @default(now()) @map("created_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)

  @@index([merchantId, effectiveFrom])
  @@map("pos_merchant_commission_policies")
}

model PosSale {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  status             String   // draft | completed | cancelled
  collectionChannel  String   @map("collection_channel")
  fulfillmentStatus  String?  @map("fulfillment_status")
  paymentStatus      String?  @map("payment_status")
  idempotencyKey     String   @unique @map("idempotency_key")
  createdByActor     String   @map("created_by_actor")
  createdByUserId    String?  @map("created_by_user_id")
  completedAt        DateTime? @map("completed_at")
  createdAt          DateTime @default(now()) @map("created_at")
  /// completed 後禁止改金額／通道／狀態（終態）
  merchant           Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  lines              PosSaleLine[]
  refundRequests     PosRefundRequest[]
  ledgerEntries      PosLedgerEntry[]

  @@index([merchantId, createdAt])
  @@index([merchantId, status])
  @@map("pos_sales")
}

model PosSaleLine {
  id                         String   @id @default(cuid())
  merchantId                 String   @map("merchant_id")
  saleId                     String   @map("sale_id")
  productId                  String   @map("product_id")
  inventoryAggregateId       String   @map("inventory_aggregate_id") // = MerchantStock.id，server 解析
  quantity                   Int
  actualGrossTwd             Int      @map("actual_gross_twd")
  collectionChannel          String   @map("collection_channel")
  commissionRateSnapshot     Int      @map("commission_rate_snapshot")
  commissionAmountSnapshot   Int      @map("commission_amount_snapshot")
  direction                  String
  ledgerKind                 String   @default("ordinary_commission") @map("ledger_kind")
  createdAt                  DateTime @default(now()) @map("created_at")

  sale     PosSale       @relation(fields: [saleId], references: [id], onDelete: Restrict)
  merchant Merchant      @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  stock    MerchantStock @relation(fields: [inventoryAggregateId], references: [id], onDelete: Restrict)
  product  Product       @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([merchantId, saleId, id])
  @@index([merchantId, saleId])
  @@map("pos_sale_lines")
}

model PosRefundRequest {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  saleId             String   @map("sale_id")
  status             String   // requested | approved | rejected
  requestedByActor   String   @map("requested_by_actor")
  approvedByActor    String?  @map("approved_by_actor")
  reason             String
  idempotencyKey     String   @unique @map("idempotency_key")
  createdAt          DateTime @default(now()) @map("created_at")
  decidedAt          DateTime? @map("decided_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  sale     PosSale  @relation(fields: [saleId], references: [id], onDelete: Restrict)
  lines    PosRefundLine[]
  dispositions PosRefundDisposition[]

  @@index([merchantId, saleId, status])
  @@map("pos_refund_requests")
}

model PosRefundLine {
  id                                String   @id @default(cuid())
  merchantId                        String   @map("merchant_id")
  requestId                         String   @map("request_id")
  originalSaleId                    String   @map("original_sale_id")
  originalSaleLineId                String?  @map("original_sale_line_id")
  amountTwd                         Int      @map("amount_twd")
  quantity                          Int?
  originalCollectionChannel         String   @map("original_collection_channel")
  originalCommissionRateSnapshot    Int      @map("original_commission_rate_snapshot")
  commissionReversalSnapshot        Int      @map("commission_reversal_snapshot")
  settlementDestination             String   @map("settlement_destination") // current_open_period | next_period_adjustment
  idempotencyKey                    String   @unique @map("idempotency_key")
  createdAt                         DateTime @default(now()) @map("created_at")

  merchant Merchant         @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  request  PosRefundRequest @relation(fields: [requestId], references: [id], onDelete: Restrict)

  @@index([merchantId, originalSaleId])
  @@map("pos_refund_lines")
}

/// 實物 disposition；與金額 line 分離
model PosRefundDisposition {
  id                     String   @id @default(cuid())
  merchantId             String   @map("merchant_id")
  requestId              String   @map("request_id")
  inventoryAggregateId   String   @map("inventory_aggregate_id")
  quantity               Int
  action                 String   // RESTOCK_SELLABLE | WRITE_OFF
  reasonCode             String   @map("reason_code")
  /// UNOPENED_GOOD_RESELLABLE | OPENED | DAMAGED | SPOILED | OTHER_UNSELLABLE
  reasonNote             String?  @map("reason_note") // OTHER 必填
  inventoryLedgerId      String?  @unique @map("inventory_ledger_id")
  createdAt              DateTime @default(now()) @map("created_at")

  merchant Merchant         @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  request  PosRefundRequest @relation(fields: [requestId], references: [id], onDelete: Restrict)
  stock    MerchantStock    @relation(fields: [inventoryAggregateId], references: [id], onDelete: Restrict)

  @@index([merchantId, requestId])
  @@map("pos_refund_dispositions")
}

model PosLedgerEntry {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  amountTwd          Int      @map("amount_twd") // 永遠正整數
  direction          String   // merchant_owes_hq | hq_owes_merchant
  kind               String
  saleId             String?  @map("sale_id")
  refundLineId       String?  @map("refund_line_id")
  voucherId          String?  @map("voucher_id")
  redemptionId       String?  @map("redemption_id")
  adjustmentId       String?  @map("adjustment_id")
  settlementId       String?  @map("settlement_id")
  periodStart        DateTime? @map("period_start")
  periodEnd          DateTime? @map("period_end")
  idempotencyKey     String   @unique @map("idempotency_key")
  createdByActor     String   @map("created_by_actor")
  createdAt          DateTime @default(now()) @map("created_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  sale     PosSale? @relation(fields: [saleId], references: [id], onDelete: Restrict)

  @@index([merchantId, createdAt])
  @@index([merchantId, kind])
  @@index([settlementId])
  @@map("pos_ledger_entries")
}

model PosInventoryLedger {
  id                     String   @id @default(cuid())
  merchantId             String   @map("merchant_id")
  inventoryAggregateId   String   @map("inventory_aggregate_id")
  op                     String   // reserve | release | expire | consume_pickup | consume_in_store | restock_delivered | restock_sellable | write_off
  quantity               Int
  onHandAfter            Int      @map("on_hand_after")
  reservedAfter          Int      @map("reserved_after")
  reference              String?
  reasonCode             String?  @map("reason_code")
  reasonNote             String?  @map("reason_note")
  idempotencyKey         String   @unique @map("idempotency_key")
  fingerprint            String
  createdByActor         String   @map("created_by_actor")
  createdAt              DateTime @default(now()) @map("created_at")

  merchant Merchant      @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  stock    MerchantStock @relation(fields: [inventoryAggregateId], references: [id], onDelete: Restrict)

  @@unique([idempotencyKey])
  @@index([merchantId, inventoryAggregateId, createdAt])
  @@map("pos_inventory_ledger")
}

model PosSettlementLine {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  settlementId       String   @map("settlement_id")
  ledgerEntryId      String   @unique @map("ledger_entry_id")
  amountTwd          Int      @map("amount_twd")
  direction          String
  kind               String
  sourceSnapshotTwd  Int      @map("source_snapshot_twd")
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([merchantId, settlementId])
  @@map("pos_settlement_lines")
}

model PosSettlementAdjustment {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  amountTwd          Int      @map("amount_twd") // 正整數
  direction          String
  kind               String   // merchant_proposed_adjustment | next_period_adjustment
  reference          String
  reason             String
  requestedByActor   String   @map("requested_by_actor")
  approvedByActor    String?  @map("approved_by_actor")
  effectiveStart     DateTime @map("effective_start")
  effectiveEnd       DateTime @map("effective_end")
  idempotencyKey     String   @unique @map("idempotency_key")
  createdAt          DateTime @default(now()) @map("created_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)

  @@index([merchantId, effectiveStart])
  @@map("pos_settlement_adjustments")
}

model PosVoucherCancellationRequest {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  requestId          String   @unique @map("request_id")
  voucherId          String   @map("voucher_id")
  redemptionId       String   @map("redemption_id")
  status             String   // pending | approved | rejected
  requestedByActor   String   @map("requested_by_actor")
  decidedByActor     String?  @map("decided_by_actor")
  reason             String
  idempotencyKey     String   @unique @map("idempotency_key")
  fingerprint        String
  createdAt          DateTime @default(now()) @map("created_at")
  decidedAt          DateTime? @map("decided_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)

  @@index([merchantId, voucherId])
  @@map("pos_voucher_cancellation_requests")
}

model PosIdempotencyRecord {
  id                 String   @id @default(cuid())
  merchantId         String   @map("merchant_id")
  scope              String   // sale | refund | inventory | voucher_cancel | adjustment | settlement
  idempotencyKey     String   @map("idempotency_key")
  fingerprint        String
  resultRef          String   @map("result_ref")
  createdAt          DateTime @default(now()) @map("created_at")

  @@unique([merchantId, scope, idempotencyKey])
  @@map("pos_idempotency_records")
}

/// 非權威。只供 audit／backfill／quarantine，禁止用名稱自動核准。
model MerchantStoreLinkAudit {
  id                 String   @id @default(cuid())
  merchantId         String?  @map("merchant_id")
  storeId            String?  @map("store_id")
  storeSlug          String?  @map("store_slug")
  observedName       String?  @map("observed_name")
  status             String   // proposed | quarantined | hq_approved | rejected
  reason             String
  createdAt          DateTime @default(now()) @map("created_at")
  reviewedByActor    String?  @map("reviewed_by_actor")

  @@index([status, createdAt])
  @@map("merchant_store_link_audits")
}

/// O3 空位：正式豬窩 immutable IDs 未定前不得填值當權威。
model ZhuwoImmutableIdPolicySlot {
  id                 String   @id @default(cuid())
  slotKey            String   @unique @map("slot_key") // zhuwo_branch_1 | zhuwo_branch_2 | zhuwo_branch_3
  officialMerchantId String?  @map("official_merchant_id") // 必須保持 null 直到 O3
  officialStoreId    String?  @map("official_store_id")
  status             String   @default("UNDECIDED")
  note               String   @default("禁止用中文店名辨識；正式 ID 未定")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@map("zhuwo_immutable_id_policy_slots")
}
```

既有 `MerchantStock` **安全擴充（以後才做，本輪不做）：**

- 新增 `onHand Int`、`reserved Int`（預設 0）
- 過渡期 `quantity` 當 dual-read 別名
- **不**刪 `quantity` 直到 contract 階段
- `@@unique([merchantId, productId, tierId])` 維持；`id`＝authoritative `inventoryAggregateId`

既有 `Settlement` **安全擴充：**

- 新增整數欄（`grossSalesTwd` 等）與 `PosSettlementLine` 關聯
- 舊 Float 欄保留到 cutover
- 刪除政策改為：`approved`／`paid` 不可刪（應用層＋以後 DB 限制）

既有 `GroomingCoupon`：不改成 POS 結算來源。取消申請走 `PosVoucherCancellationRequest`。

既有 `MemberPointsLedger`：新增 source type（例如 `grooming_coupon_cancel_reversal`）時仍走 expand，本輪不改。

---

## 5. 每個新模型的契約

以下「不可變」＝完成後禁止 update／delete 金額、方向、snapshot、身分欄。只能再寫 reversal／adjustment。

### 5.1 `PosSale` / `PosSaleLine`

| 項目 | 規則 |
|------|------|
| Owner | `merchantId`＝POS session 的 `Merchant.id` |
| 建立者 | 店員／店家可建 `draft`；`completed` 由 server 在同一 transaction 寫 line snapshot |
| 可變 | 僅 `draft` 的非金額草稿。`completed`／`cancelled` 終態 |
| 不可變 | 成交額、通道、費率／佣金 snapshot、direction、inventoryAggregateId |
| 狀態 | `draft → completed \| cancelled`。`completed` 永不改、永不刪 |
| 刪除 | 禁止硬刪。draft 取消＝`cancelled` |
| Unique | `idempotencyKey`；line 必須同 `merchantId` |
| Reversal | 指向 `PosRefundLine.originalSaleId` |
| 隔離 | composite：`sale.merchantId = line.merchantId = stock.merchantId`。transaction 再 assert 等於 session |

### 5.2 `PosRefundRequest` / `PosRefundLine` / `PosRefundDisposition`

| 項目 | 規則 |
|------|------|
| Owner | 與原 sale 同一 `merchantId` |
| 建立者 | 店家申請；**只有 HQ** 核准 |
| 可變 | 僅 `requested` 的申請備註 |
| 不可變 | 核准後的 amount、commissionReversalSnapshot、channel／rate snapshot、disposition |
| 狀態 | `requested → approved \| rejected`。approved 後不改寫，錯了另寫 |
| 刪除 | 禁止 |
| Unique | 每 line／request 各有 `idempotencyKey`。line fingerprint 含 commission snapshot |
| 金額 vs 實物 | line＝財務；disposition＝回庫或損耗。金額全退即可 `fully_reversed` |
| 已鎖結算 | `settlementDestination = next_period_adjustment` |

### 5.3 `PosLedgerEntry`

| 項目 | 規則 |
|------|------|
| Owner | `merchantId` |
| 建立者 | 只由 server 在 sale／refund／voucher／adjustment 決策後寫入 |
| 不可變 | 全列。`amountTwd` 永遠正整數；方向只看 `direction` |
| 刪除 | 禁止 |
| Unique | `idempotencyKey` |
| 月結 | `PosSettlementLine` 引用這些 entry 的 snapshot，不重算 |

### 5.4 `PosInventoryLedger` + 擴充 `MerchantStock`

| 項目 | 規則 |
|------|------|
| Owner | `merchantId` + `inventoryAggregateId`（＝`MerchantStock.id`，server 解析） |
| 建立者 | server。client 傳的 aggregateId 不可信 |
| 不可變 | 全列。fingerprint＝`aggregateId + op + qty + 必要 reference`，**不**含當下 onHand／reserved |
| 刪除 | 禁止（與現行 5 秒刪 txn 不同） |
| Unique | `idempotencyKey`；同 key 不同 aggregate／op／qty throw |
| 現況 | `available = onHand - reserved ≥ 0`。禁止負庫存 |
| 入庫 | 只有 shipment `delivered` 的 `restock_delivered`；退貨可售＝`restock_sellable` |

不建議把 POS 庫存事件只擴進 `MerchantStockTxn` 當唯一帳：舊 txn 可刪、無 reserved、無 fingerprint、金額 Float。若 HQ 要看，可以後 **投影** 一筆唯讀 txn，權威仍是 `PosInventoryLedger`。

### 5.5 `PosSettlementLine` / `PosSettlementAdjustment`

| 項目 | 規則 |
|------|------|
| Owner | 與 `Settlement.merchantId` 相同 |
| 建立者 | HQ。店員不可改佣金或結算 |
| 可變 | 僅 draft／reviewing 的 metadata（備註、期間、意見） |
| 不可變 | `approved` 起 lines／amounts。只准 `approved → paid` |
| 刪除 | `approved`／`paid` 禁止。draft 可 `cancelled`（不是重開已核准） |
| Adjustment | 正整數 + direction；0／負數拒絕 |

### 5.6 `PosVoucherCancellationRequest`

| 項目 | 規則 |
|------|------|
| Owner | session merchant；`request.voucherId` 必須等於被取消券 |
| 建立者 | 店家申請；**每次**核准／拒絕都重驗 HQ（含 duplicate 重送） |
| 順序 | HQ actor → request identity → idempotency key → existing fingerprint → 才驗券＝redeemed／申請＝pending |
| 不可變 | 核准後的點數 +10 與補貼 reversal line |
| 刪除 | 禁止 |
| 點數 | 沿用 `MemberPointsLedger`；自然過期不退點 |

### 5.7 `PosIdempotencyRecord`

跨表保險櫃：`merchantId + scope + key` → `{fingerprint, resultRef}`。
各業務表自己的 `@unique(idempotencyKey)` 仍要有。同 key 不同 fingerprint 必須 throw，不可回第一筆假裝成功。

### 5.8 `MerchantStoreLinkAudit` / `ZhuwoImmutableIdPolicySlot`

- Link：**非權威**。歧義進 `quarantined`。禁止用店名自動對上。
- 豬窩 slot：三列 `UNDECIDED`，`officialMerchantId`／`officialStoreId` 保持 **null**。偏好的 `MER-0016/19/20` 只是舊程式註解，**不是**本提案填入的正式 ID。

---

## 6. merchant 隔離與 session

- POS cookie＝`furmosa_merchant_session`；HQ cookie＝`furmosa_session`。不得混用。
- 寫入時 `merchantId` **只能**來自已驗證 POS session（或 HQ 明確選店且 server 重查）。忽略 client 傳來的 merchantId。
- `inventoryAggregateId`：server 用 session.merchantId + productId + tierId 查 `MerchantStock.id`。
- 同一 transaction 斷言：sale／refund／stock／ledger／settlement 的 `merchantId` 全相等。
- 建議以後用複合 FK（`saleId + merchantId` 參照 `PosSale(id, merchantId)`）。本輪不建。
- Repo 內**沒有** Supabase RLS。跨店隔離必須靠 **service-side auth**，不能假設資料庫會擋。

---

## 7. 狀態機（與 POS-01 一致）

- Sale／Refund／Fulfillment／Reservation／Restock／Voucher／Settlement：沿用 POS-01 allow-list。
- 補貨：`draft`／`submitted`／`under_review` 可轉 `cancelled`；`approved`／`converted_to_shipment` 另建 cancellation event，不改寫原申請。
- 未付款 checkout 24h → `expired`，不 reserve。
- `paid_reserved` 不自動 expire／退款／釋放。
- HQ 退款核准 workflow（同一 transaction）：
  1. 再驗 HQ
  2. 驗原 sale 仍 completed、merchant 相符
  3. 寫／回 `PosRefundLine`（佣金精準公式）
  4. 寫相反方向 `PosLedgerEntry`
  5. 若有 disposition：`restock_sellable` 或 `write_off`
  6. 已鎖結算則 ledger kind＝`next_period_adjustment`

---

## 8. 冪等與併發

| 範圍 | key | fingerprint 至少含 |
|------|-----|-------------------|
| 完成銷售 | sale idempotencyKey | merchantId、channel、各 line 金額／qty／aggregateId、rate |
| 退款 | refund line key | saleId、amount、qty、channel、rate、**commissionReversalSnapshot** |
| 庫存 | inventory key | **aggregateId**、op、qty、必要 reference |
| 券取消 | cancel key | requestId、voucherId、redemptionId、decision、tier、settlement 路由、reason |
| 加減款 | adjustment key | merchant、amount、direction、kind、period、reason |

規則：

- 同 key 同 fingerprint → 回原 result、`duplicate=true`。
- 同 key 不同 fingerprint → throw。壞 duplicate 不可靜默略過。
- 用 `UNIQUE` + transaction retry；不要先讀再寫當唯一保護。
- 庫存列 `SELECT … FOR UPDATE`（以後實作）後再算 available。
- 券取消重送仍要先過 HQ allow-list。

---

## 9. 不變量（以後寫入時必須守）

1. 原 completed sale 與佣金 snapshot 永不改。
2. `sum(commissionReversalSnapshot) === 原佣金 − round((原成交 − 累計退款) × 原 rate)`。少或多都拒絕。
3. 累計退款金額 ≤ 原成交；有數量時 ≤ 原數量。
4. `available = onHand - reserved ≥ 0`。
5. ledger `amountTwd > 0`；方向只看 `direction`。
6. 月結只加總 snapshot。
7. 未知 enum throw。
8. 跨店 reference throw。
9. `OTHER_UNSELLABLE` 無說明 throw。
10. `RESTOCK_SELLABLE` 只能配 `UNOPENED_GOOD_RESELLABLE`。

---

## 10. 帳務方向範例（整數 TWD）

假設原成交 1000、店級 30%、佣金 snapshot＝300。

### 10.1 店家收款（現金）

| 列 | kind | direction | 金額 | 說明 |
|----|------|-----------|------|------|
| sale | ordinary_commission | `merchant_owes_hq` | 店欠 700；佣金 snapshot 300 | 店收 1000，留下 300 |

### 10.2 Furmosa 代收（LINE／綠界）

| 列 | kind | direction | 金額 | 說明 |
|----|------|-----------|------|------|
| sale | ordinary_commission | `hq_owes_merchant` | 總部欠店 300 | 同一 30%，方向必須相反 |

### 10.3 兩者都退 400（未鎖期）

剩餘淨額 600，應得佣金 `round(600×30%)＝180`，本筆回沖＝300−180＝120。

| 原通道 | 退款 direction | 回沖佣金 | 債權 |
|--------|----------------|----------|------|
| 店收 | `hq_owes_merchant` | 120 | 回沖額 400−120＝280 |
| 代收 | `merchant_owes_hq` | 120 | 回沖佣金 120 |

不得每筆只做 `round(400×30%)＝120` 當唯一算法；多筆拆單必須用剩餘淨額公式，最後累計回沖精準＝300。

### 10.4 已鎖期（approved／paid）再退

原 sale／原 settlement **不改**。退款 line 與 ledger 的 `kind＝next_period_adjustment`，進下一開放期。

### 10.5 可售回庫 vs 不可售損耗

同一筆退 400、退 1 件：

| disposition | action | 庫存 |
|-------------|--------|------|
| 未拆封良好 | `RESTOCK_SELLABLE` + `UNOPENED_GOOD_RESELLABLE` | 該門市 `onHand += 1` |
| 已拆封／破損／變質／其他不可售 | `WRITE_OFF` + 對應 reason（OTHER 必填） | 不回可售；只留損耗 ledger |

財務 line 與 disposition 分開：可以錢退完、東西尚未回架。

---

## 11. RLS／最小權限／auth 邊界

| 層 | 現況 | POS-02 要求 |
|----|------|-------------|
| Cookie | HQ／POS 已分開 | 維持；HQ cookie 不能寫 POS 店帳 |
| Service | Prisma 用 `DATABASE_URL`，無 RLS | **所有** POS 寫入先 `getAuthenticatedMerchantId()` 或 HQ 角色檢查 |
| DB | 能拿連線就能讀全表 | 本輪不啟用 RLS、不改角色。以後若做，只能當多一層，不能取代 service 檢查 |
| Client | 不可信 | 佣金、方向、可退上限、aggregateId、settlement 路由一律 server 重算 |
| Cron／webhook | 綠界／LINE 另有簽章 | 不在本輪接；若接，金額仍以 server 原 sale 為準 |

店員：可申請退款／回庫／叫貨，不可核准、不可改％、不可改已核准結算。
店家：可提加減款，不可自核。
HQ：可核准退款、disposition、加減款、結算付款 metadata。

---

## 12. Reuse vs new（給 review 一眼看）

**沿用／安全擴充**

- `Merchant`、`MerchantUser`、session
- `MerchantStock.id` 當 aggregate
- `Shipment`／`RestockRequest` 履約
- `Settlement` 表頭（以後加整數欄）
- `GroomingCoupon` 券本體
- `MemberPointsLedger` 點數
- refill 的 idempotency 模式

**新建（POS 權威）**

- `PosSale`／`PosSaleLine`
- `PosRefundRequest`／`PosRefundLine`／`PosRefundDisposition`
- `PosLedgerEntry`
- `PosInventoryLedger`
- `PosSettlementLine`／`PosSettlementAdjustment`
- `PosVoucherCancellationRequest`
- `PosIdempotencyRecord`
- `PosMerchantCommissionPolicy`
- `MerchantStoreLinkAudit`（非權威）
- `ZhuwoImmutableIdPolicySlot`（空）

**不當 POS 新真相**

- `Order` 金額、`MerchantStockTxn` 佣金 Float、`MerchantProductRule` 每商品％、用店名猜豬窩

---

## 13. Contract checklist

| 項 | 結果 | 說明 |
|----|------|------|
| O1 回庫規則 | **PASS** | 可售回該店；不可售寫損耗；店家不能自核；HQ 同一 workflow；已鎖期進次期 |
| 不可變 ledger | **PASS** | 完成事實只准新 reversal／adjustment |
| 冪等 | **PASS** | key→{fingerprint,result}；庫存含 aggregateId；退款含佣金 snapshot |
| merchant 隔離 | **PASS** | session merchantId + 同列 assert；client 不可指定 |
| 已鎖結算 | **PASS** | approved 不重開；次期 adjustment |
| Float 共存 | **PASS** | 新帳 Int；舊 Float expand／quarantine，不自動 round |
| drift gate | **PASS** | 列為 prerequisite blocker（見 migration plan） |
| Store mapping | **PASS** | 只 audit／quarantine，不用名稱猜 |
| 豬窩 ID 未猜 | **PASS** | slot 空、status＝UNDECIDED |

---

## 14. 本輪不做

- 不進 POS-03（不實作 service／API／UI）
- 不改 schema、不建 migration、不產生 Production SQL
- 不 merge、不 deploy
- 不讀寫正式資料
- 不用文件字串假裝測試通過