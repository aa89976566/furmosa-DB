import { canonicalTierSku } from '@/lib/products/canonical-sku';

export type ShopifyCatalogVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
};

export type ShopifyCatalogProduct = {
  id: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  variants: ShopifyCatalogVariant[];
};

export type HqCatalogTier = {
  id: string;
  status: string;
  sku: string | null;
  shopifySku: string | null;
  shopifyVariantId: string | null;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
};

export type HqCatalogProduct = {
  id: string;
  productId: string;
  name: string;
  status: string;
  price: number;
  sourceSku: string | null;
  priceTiers: HqCatalogTier[];
};

export type CatalogTierUpdate = {
  tierId: string;
  productId: string;
  shopifyProductId: string;
  sku: string;
  shopifySku: string;
  shopifyVariantId: string;
  price: number;
  status: 'active';
};

export type CatalogProductUpdate = {
  productId: string;
  shopifyProductId: string;
  name: string;
  price: number;
  status: 'active' | 'draft' | 'inactive';
};

export type CatalogSyncPlan = {
  tierUpdates: CatalogTierUpdate[];
  productUpdates: CatalogProductUpdate[];
  tierArchives: Array<{ tierId: string; productId: string; reason: 'not_in_shopify' }>;
  unmatchedShopifyVariants: Array<{
    productId: string; productTitle: string; productStatus: ShopifyCatalogProduct['status'];
    variantId: string; variantTitle: string; sku: string; price: number;
  }>;
  conflicts: Array<{ code: string; message: string; ids: string[] }>;
  blankShopifyVariants: Array<{
    productId: string; productTitle: string; productStatus: ShopifyCatalogProduct['status'];
    variantId: string; variantTitle: string; price: number;
  }>;
  unmatchedHqTiers: Array<{ productId: string; productName: string; tierId: string; reason: 'missing_identity' | 'no_shopify_match' | 'conflict' }>;
  ignoredBlankShopifySkus: number;
};

function fold(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

function numericVariantId(value: string) {
  const tail = value.trim().split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : value.trim();
}

function hqStatus(status: ShopifyCatalogProduct['status']): CatalogProductUpdate['status'] {
  if (status === 'ACTIVE') return 'active';
  if (status === 'DRAFT') return 'draft';
  return 'inactive';
}

/**
 * Builds a conservative plan. It never guesses by title, weight, or price:
 * Shopify and HQ can only meet through an exact, unique SKU/variant identity.
 */
export function planShopifyHqCatalogSync(
  shopifyProducts: ShopifyCatalogProduct[],
  hqProducts: HqCatalogProduct[],
): CatalogSyncPlan {
  const conflicts: CatalogSyncPlan['conflicts'] = [];
  const shopifyBySku = new Map<string, Array<{ product: ShopifyCatalogProduct; variant: ShopifyCatalogVariant }>>();
  const blankShopifyVariants: CatalogSyncPlan['blankShopifyVariants'] = [];

  for (const product of shopifyProducts) {
    for (const variant of product.variants) {
      const sku = fold(variant.sku);
      if (!sku) {
        blankShopifyVariants.push({
          productId: product.id,
          productTitle: product.title,
          productStatus: product.status,
          variantId: variant.id,
          variantTitle: variant.title,
          price: variant.price,
        });
        continue;
      }
      const rows = shopifyBySku.get(sku) ?? [];
      rows.push({ product, variant });
      shopifyBySku.set(sku, rows);
    }
  }

  for (const [sku, rows] of shopifyBySku) {
    if (rows.length > 1) {
      conflicts.push({
        code: 'DUPLICATE_SHOPIFY_SKU',
        message: `Shopify SKU ${sku} 對應 ${rows.length} 個規格，不能自動同步`,
        ids: rows.map((row) => row.variant.id),
      });
    }
  }

  const candidates: Array<{
    hqProduct: HqCatalogProduct;
    tier: HqCatalogTier;
    shopifyProduct: ShopifyCatalogProduct;
    variant: ShopifyCatalogVariant;
  }> = [];

  for (const product of hqProducts) {
    const active = product.priceTiers.filter((tier) => tier.status !== 'archived');
    for (const tier of active) {
      const identities = new Set(
        [tier.sku, tier.shopifySku, canonicalTierSku(product.sourceSku, tier, active.length)]
          .map(fold)
          .filter((value): value is string => Boolean(value)),
      );
      const hits = new Map<string, { product: ShopifyCatalogProduct; variant: ShopifyCatalogVariant }>();
      for (const identity of identities) {
        for (const row of shopifyBySku.get(identity) ?? []) hits.set(row.variant.id, row);
      }
      if (hits.size > 1) {
        conflicts.push({
          code: 'AMBIGUOUS_HQ_TIER',
          message: `HQ 規格 ${tier.id} 的身分欄位指向多個 Shopify 規格`,
          ids: [tier.id, ...hits.keys()],
        });
        continue;
      }
      const hit = [...hits.values()][0];
      if (hit) candidates.push({ hqProduct: product, tier, shopifyProduct: hit.product, variant: hit.variant });
    }
  }

  const byVariant = new Map<string, typeof candidates>();
  const byShopifyProduct = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    byVariant.set(candidate.variant.id, [...(byVariant.get(candidate.variant.id) ?? []), candidate]);
    byShopifyProduct.set(candidate.shopifyProduct.id, [...(byShopifyProduct.get(candidate.shopifyProduct.id) ?? []), candidate]);
  }

  const blockedTierIds = new Set<string>();
  for (const [variantId, rows] of byVariant) {
    const distinctTiers = new Set(rows.map((row) => row.tier.id));
    if (distinctTiers.size <= 1) continue;
    rows.forEach((row) => blockedTierIds.add(row.tier.id));
    conflicts.push({
      code: 'DUPLICATE_HQ_VARIANT_CLAIM',
      message: `Shopify 規格 ${variantId} 被多個 HQ 規格認領，需人工選擇保留項目`,
      ids: [variantId, ...distinctTiers],
    });
  }

  for (const [shopifyProductId, rows] of byShopifyProduct) {
    const distinctProducts = new Set(rows.map((row) => row.hqProduct.id));
    if (distinctProducts.size <= 1) continue;
    rows.forEach((row) => blockedTierIds.add(row.tier.id));
    conflicts.push({
      code: 'DUPLICATE_HQ_PRODUCT_CLAIM',
      message: `Shopify 商品 ${shopifyProductId} 被多個 HQ 商品認領，需人工選擇主要商品`,
      ids: [shopifyProductId, ...distinctProducts],
    });
  }

  const accepted = candidates.filter((candidate) => !blockedTierIds.has(candidate.tier.id));
  const tierUpdates: CatalogTierUpdate[] = accepted.flatMap(({ hqProduct, tier, shopifyProduct, variant }) => {
    const sku = fold(variant.sku)!;
    const shopifyVariantId = numericVariantId(variant.id);
    if (
      fold(tier.sku) === sku
      && fold(tier.shopifySku) === sku
      && tier.shopifyVariantId?.trim() === shopifyVariantId
      && tier.price === variant.price
      && tier.status === 'active'
    ) return [];
    return [{
      tierId: tier.id,
      productId: hqProduct.id,
      shopifyProductId: shopifyProduct.id,
      sku,
      shopifySku: sku,
      shopifyVariantId,
      price: variant.price,
      status: 'active',
    }];
  });

  const acceptedByHqProduct = new Map<string, typeof accepted>();
  for (const row of accepted) {
    acceptedByHqProduct.set(row.hqProduct.id, [...(acceptedByHqProduct.get(row.hqProduct.id) ?? []), row]);
  }

  const productUpdates: CatalogProductUpdate[] = [];
  const tierArchives: CatalogSyncPlan['tierArchives'] = [];
  for (const product of hqProducts) {
    const rows = acceptedByHqProduct.get(product.id) ?? [];
    const shopifyIds = new Set(rows.map((row) => row.shopifyProduct.id));
    if (shopifyIds.si…16044 tokens truncated…t_amount") @db.Decimal(14, 2)
  totalAmount            Decimal  @map("total_amount") @db.Decimal(14, 2)
  note                   String?
  createdById            String   @map("created_by_id")
  receivedById           String?  @map("received_by_id")
  receivedAt             DateTime? @map("received_at")
  cancelledAt            DateTime? @map("cancelled_at")
  cancelReason           String?  @map("cancel_reason")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  vendor       Vendor?                   @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  warehouse    Warehouse                 @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  createdBy    User                      @relation("PurchaseOrderCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  receivedBy   User?                     @relation("PurchaseOrderReceivedBy", fields: [receivedById], references: [id], onDelete: Restrict)
  items        PurchaseOrderItem[]
  attachments  PurchaseOrderAttachment[]
  receipts     PurchaseReceipt[] @relation("PartialReceipts")
  receipt      PurchaseReceipt?

  @@unique([vendorId, supplierDocumentNumber])
  @@index([status, remindFromDate])
  @@index([createdAt])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id              String   @id @default(cuid())
  purchaseOrderId String   @map("purchase_order_id")
  lineNumber      Int      @map("line_number")
  productId       String   @map("product_id")
  productName     String   @map("product_name")
  sku             String
  unit            String   @default("g")
  quantityGrams   Int      @map("quantity_grams")
  rawAmount       Decimal  @map("raw_amount") @db.Decimal(14, 2)
  createdAt       DateTime @default(now()) @map("created_at")

  receiptItems PurchaseReceiptItem[]
  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)
  product       Product       @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([purchaseOrderId, lineNumber])
  @@unique([purchaseOrderId, productId])
  @@index([productId])
  @@map("purchase_order_items")
}

model PurchaseOrderAttachment {
  id              String   @id @default(cuid())
  purchaseOrderId String   @map("purchase_order_id")
  fileName        String   @map("file_name")
  mimeType        String   @map("mime_type")
  sizeBytes       Int      @map("size_bytes")
  sha256          String
  data            Bytes
  createdAt       DateTime @default(now()) @map("created_at")

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@index([purchaseOrderId])
  @@map("purchase_order_attachments")
}

model StocktakeAdjustment {
  id                     String   @id @default(cuid())
  eventKey               String   @unique @map("event_key")
  productId              String   @map("product_id")
  warehouseId            String   @map("warehouse_id")
  inventoryTransactionId String   @unique @map("inventory_transaction_id")
  beforeQuantity         Int      @map("before_quantity")
  afterQuantity          Int      @map("after_quantity")
  deltaQuantity          Int      @map("delta_quantity")
  beforeTotalCost        Decimal  @map("before_total_cost") @db.Decimal(14, 2)
  afterTotalCost         Decimal  @map("after_total_cost") @db.Decimal(14, 2)
  deltaTotalCost         Decimal  @map("delta_total_cost") @db.Decimal(14, 2)
  reason                 String
  createdById            String   @map("created_by_id")
  reversalOfId           String?  @unique @map("reversal_of_id")
  createdAt              DateTime @default(now()) @map("created_at")

  product              Product              @relation(fields: [productId], references: [id], onDelete: Restrict)
  warehouse            Warehouse            @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  inventoryTransaction InventoryTransaction @relation(fields: [inventoryTransactionId], references: [id], onDelete: Restrict)
  createdBy            User                 @relation("StocktakeCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  reversalOf           StocktakeAdjustment? @relation("StocktakeReversal", fields: [reversalOfId], references: [id], onDelete: Restrict)
  reversal             StocktakeAdjustment? @relation("StocktakeReversal")

  @@index([productId, warehouseId, createdAt])
  @@map("stocktake_adjustments")
}

model PurchaseReceiptItem {
  sourceOrderItemId String? @map("source_order_item_id")
  sourceOrderItem PurchaseOrderItem? @relation(fields: [sourceOrderItemId], references: [id], onDelete: Restrict)
  id                         String   @id @default(cuid())
  purchaseReceiptId          String   @map("purchase_receipt_id")
  productId                  String   @map("product_id")
  inventoryTransactionId     String   @unique @map("inventory_transaction_id")
  quantityGrams              Int      @map("quantity_grams")
  rawAmount                   Decimal  @map("raw_amount") @db.Decimal(14, 2)
  allocatedCost              Decimal  @map("allocated_cost") @db.Decimal(14, 2)
  landedAmount               Decimal  @map("landed_amount") @db.Decimal(14, 2)
  costPerGram                 Decimal  @map("cost_per_gram") @db.Decimal(18, 6)
  previousStockGrams          Int      @map("previous_stock_grams")
  resultingStockGrams         Int      @map("resulting_stock_grams")
  previousAverageCostPerGram  Decimal  @map("previous_average_cost_per_gram") @db.Decimal(18, 6)
  newAverageCostPerGram       Decimal  @map("new_average_cost_per_gram") @db.Decimal(18, 6)
  createdAt                   DateTime @default(now()) @map("created_at")

  purchaseReceipt      PurchaseReceipt      @relation(fields: [purchaseReceiptId], references: [id], onDelete: Restrict)
  product              Product              @relation(fields: [productId], references: [id], onDelete: Restrict)
  inventoryTransaction InventoryTransaction @relation(fields: [inventoryTransactionId], references: [id], onDelete: Restrict)

  @@index([sourceOrderItemId])
  @@index([purchaseReceiptId])
  @@index([productId, createdAt])
  @@map("purchase_receipt_items")
}

model PurchaseReceiptAttachment {
  id                String   @id @default(cuid())
  purchaseReceiptId String   @map("purchase_receipt_id")
  fileName          String   @map("file_name")
  mimeType          String   @map("mime_type")
  sizeBytes         Int      @map("size_bytes")
  sha256            String
  data              Bytes
  createdAt         DateTime @default(now()) @map("created_at")

  purchaseReceipt PurchaseReceipt @relation(fields: [purchaseReceiptId], references: [id], onDelete: Cascade)

  @@index([purchaseReceiptId])
  @@map("purchase_receipt_attachments")
}

// =====================================================
// Order Hub
// =====================================================

enum OmsStatus {
  NEW
  REVIEW
  READY
  FULFILLMENT_PENDING
  FULFILLED
}

enum ShopifyWebhookStatus {
  RECEIVED
  PROCESSING
  PROCESSED
  FAILED
  IGNORED
}

// Durable inbox foundation; the receiver/worker will be connected in the next stage.
// Payloads may contain personal data: restrict access and purge by payloadExpiresAt.
model ShopifyWebhookEvent {
  id               String               @id @default(cuid())
  shopDomain       String
  topic            String
  eventId          String
  externalOrderId  String?
  sourceUpdatedAt  DateTime?
  payload          Json?
  payloadHash      String
  payloadExpiresAt DateTime?
  status           ShopifyWebhookStatus @default(RECEIVED)
  attempts         Int                  @default(0)
  nextAttemptAt    DateTime?
  lockedUntil      DateTime?
  receivedAt       DateTime             @default(now())
  processedAt      DateTime?
  lastErrorCode    String?

  @@unique([shopDomain, topic, eventId])
  @@index([status, nextAttemptAt])
  @@index([shopDomain, externalOrderId])
  @@index([payloadExpiresAt])
}

model Order {
  hqInventoryEligible       Boolean    @default(false)
  id                        String     @id @default(cuid())
  orderNumber               String     @unique // ORD-202605-001
  source                    String // website / line / consignment / subscription / manual
  externalStore             String?    @map("external_store")
  externalOrderId           String?    @map("external_order_id")
  externalOrderName         String?    @map("external_order_name")
  // Null means not enrolled in OMS; never default legacy/non-Shopify orders to NEW.
  omsStatus                 OmsStatus? @map("oms_status")
  // Null means not checked; [] means checked with no issues. Shape: lib/orders/oms.ts.
  omsIssueFlags             Json?      @map("oms_issue_flags")
  omsCheckedAt              DateTime?  @map("oms_checked_at")
  omsCheckedSourceUpdatedAt DateTime?  @map("oms_checked_source_updated_at")
  shopifySnapshot           Json?      @map("shopify_snapshot")
  shopifySourceUpdatedAt    DateTime?  @map("shopify_source_updated_at")
  shopifyLastEventId        String?    @map("shopify_last_event_id")
  omsReviewedById           String?    @map("oms_reviewed_by_id")
  omsReviewedAt             DateTime?  @map("oms_reviewed_at")
  archivedAt                DateTime?  @map("archived_at")
  archivedById              String?    @map("archived_by_id")
  deletedAt                 DateTime?  @map("deleted_at")
  deletedById               String?    @map("deleted_by_id")
  deletionReason            String?    @map("deletion_reason")
  status                    String     @default("draft") // draft / confirmed / packed / shipped / delivered / completed / cancelled
  paymentStatus             String     @default("unpaid") // unpaid / partial / paid / cod / refunded
  shippingFeeType           String     @default("unpaid") // free 包郵 / prepaid 已付費 / unpaid 不包郵 / cod 運費貨到付款
  fulfillmentStatus         String     @default("pending") // pending / packed / shipped / delivered / returned
  customerId                String?
  merchantId                String?
  merchantOrderMode         String?    @map("merchant_order_mode") // consignment / wholesale / jar_exchange
  subscriptionId            String? // 若為訂閱衍生的訂單
  subtotal                  Float
  discount                  Float      @default(0)
  shippingFee               Float      @default(0) // 買家於此單支付的運費（不包郵／貨到付時為標準運費）
  companyShippingCost       Float      @default(0) // 公司負擔的運費成本（包郵時為 711/黑貓 標準運費）
  giftCost                  Float      @default(0) // 贈品進貨成本合計（不計入買家應付）
  total                     Float
  shippingMethod            String     @default("home") // home / convenience / delivery
  shippingAddress           String? // 宅配：家用地址；超商：可填門市地址
  cvsBrand                  String? // 711 / familymart / hilife（僅 shippingMethod=convenience 時使用）
  cvsStoreId                String? // 門市店號
  cvsStoreName              String? // 門市名稱
  note                      String?
  orderedAt                 DateTime   @default(now())
  shippedAt                 DateTime?
  completedAt               DateTime?
  createdAt                 DateTime   @default(now())
  updatedAt                 DateTime   @updatedAt

  customer          Customer?          @relation(fields: [customerId], references: [id], onDelete: SetNull)
  omsReviewedBy     User?              @relation("OmsReviewedBy", fields: [omsReviewedById], references: [id], onDelete: SetNull)
  archivedBy        User?              @relation("OrderArchivedBy", fields: [archivedById], references: [id], onDelete: SetNull)
  merchant          Merchant?          @relation(fields: [merchantId], references: [id], onDelete: SetNull)
  subscription      Subscription?      @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  items             OrderItem[]
  merchantStockTxns MerchantStockTxn[]
  shipments         Shipment[]

  @@unique([externalStore, externalOrderId])
  @@index([source])
  @@index([status])
  @@index([orderedAt])
  @@index([subscriptionId])
  @@index([customerId])
  @@index([merchantId])
  @@index([status, orderedAt])
  @@index([source, orderedAt])
  @@index([omsStatus, orderedAt])
  @@index([omsReviewedById])
  @@index([archivedAt])
  @@index([archivedById])
}

model OrderItem {
  variantKey                     String? // selected ProductPriceTier identity
  id                             String    @id @default(cuid())
  orderId                        String
  productId                      String
  productName                    String
  sku                            String
  quantity                       Int
  unitPrice                      Float
  subtotal                       Float
  isGift                         Boolean   @default(false) // 贈品：買家單價為 0，仍計入公司成本
  unitCost                       Float? // 贈品／成本紀錄：單件進貨成本
  weightGrams                    Int? // 每件重量（g）
  unit                           String? // 片 / 包 / 支 / 件...
  businessTierSnapshot           String?   @map("business_tier_snapshot")
  commercialTermsVersionSnapshot Int?      @map("commercial_terms_version_snapshot")
  commercialRuleSource           String?   @map("commercial_rule_source") // order_override / merchant_exception / product_default / category_baseline
  defaultCommercialMode          String?   @map("default_commercial_mode") // percent / amount / fixed_price
  defaultCommercialValue         Int?      @map("default_commercial_value") // basis points or integer TWD, interpreted by mode
  appliedCommercialMode          String?   @map("applied_commercial_mode")
  appliedCommercialValue         Int?      @map("applied_commercial_value")
  commercialOverrideReason       String?   @map("commercial_override_reason")
  commercialOverrideById         String?   @map("commercial_override_by_id")
  commercialOverrideAt           DateTime? @map("commercial_override_at")

  order                Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product              Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  commercialOverrideBy User?   @relation("OrderItemCommercialOverrideBy", fields: [commercialOverrideById], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([commercialOverrideById])
}

// =====================================================
// Settlement
// =====================================================

model Settlement {
  id               String    @id @default(cuid())
  settlementId     String    @unique // SET-202605-001
  merchantId       String
  periodStart      DateTime
  periodEnd        DateTime
  grossSales       Float // 店家收的現金（依銷售流水加總）
  commissionRate   Float // 此期實際抽成率（commissionAmount / grossSales）
  commissionAmount Float // 店家應得分潤
  rewardPayout     Float     @default(0) // 換罐補貼（公司付給店家）
  shippingFee      Float     @default(0) // 運費（公司補給店家／或店家代墊）
  merchantOwesUs   Float     @default(0) // 店家應返公司金額 = grossSales - commissionAmount - rewardPayout - shippingFee
  payable          Float // 兼容舊欄位：等於 commissionAmount + rewardPayout + shippingFee（公司應付店家）
  status           String    @default("draft") // draft / reviewing / approved / paid / cancelled
  paidAt           DateTime?
  note             String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // POS 共用帳務增量欄位。全部 nullable；舊流程維持 null，不 backfill。
  rulesVersion          String? // 新版身份判定的唯一依據；null = legacy 流程
  idempotencyKey        String? @unique // 同 key 同 payload 回傳既有結算
  payloadFingerprint    String? // 同 key 不同 payload 必須拒絕
  createdSource         String? // pos / hq
  intendedPaymentMethod String?
  netPayableTwd         Int? // 整數台幣。正 = 店家應付公司；負 = 公司應付店家
  storeCollected        Int? // 整數台幣。店家代收現金，不含寄賣銷售現金

  merchant    Merchant               @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  txns        MerchantStockTxn[]
  sourceItems SettlementSourceItem[]

  @@index([merchantId])
  @@index([status])
  @@index([rulesVersion])
}

// 結算的來源唯一明細。每一筆已認列的來源在未作廢狀態下只能屬於一張結算。
model SettlementSourceItem {
  id               String    @id @default(cuid())
  settlementId     String
  merchantId       String
  sourceKind       String // consignment_sale / store_collection / coupon_subsidy
  sourceKey        String // canonical key，例如 consignment_sale:<txnId>
  direction        String // STORE_TO_FURMOSA / FURMOSA_TO_STORE
  originalAmount   Float // 來源原值，保留半元不四捨五入
  quantity         Int?
  unitPrice        Float?
  commissionAmount Float?
  companyRevenue   Float?
  occurredAt       DateTime
  relatedOrderId   String?
  sourceSnapshot   Json // 認列當時的來源快照
  rulesVersion     String
  voidedAt         DateTime? // 撤回時標記，釋放 active 唯一鍵，但不刪稽核
  createdAt        DateTime  @default(now())

  // 兩個關聯都是 Restrict：刪店家或刪結算都不得連帶刪掉帳務稽核列。
  settlement Settlement @relation(fields: [settlementId], references: [id], onDelete: Restrict)
  merchant   Merchant   @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  // active canonical unique：(merchantId, sourceKey) WHERE "voidedAt" IS NULL
  // Prisma schema 無法表達 partial unique index，於 migration.sql 手寫。

  @@index([settlementId])
  @@index([merchantId, sourceKey])
  @@index([sourceKind])
}

// =====================================================
// Subscription (訂閱制)
// =====================================================

// 方案定義（小食組 / 標準組 / 豪華組）
model SubscriptionPlan {
  id                String   @id @default(cuid())
  planCode          String   @unique // PLAN-LIGHT / PLAN-STANDARD / PLAN-DELUXE
  name              String // 小食組
  tagline           String? // 輕鬆入門 / 嚐鮮首選
  monthlyPrice      Float // 399
  halfYearPrice     Float? // 2100
  halfYearSavings   Float? // 294
  shipmentsPerMonth Int      @default(1) // 1 / 2
  shipDays          String   @default("[15]") // JSON: [15] 或 [1, 15]
  contents          String   @default("[]") // JSON: [{name, weight, note}]
  bonusItems        String? // JSON: [{name, interval}]
  recommendedFor    String? // 5kg 以下小型犬 / ...
  sortOrder         Int      @default(0)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  subscriptions Subscription[]
}

// 客戶的訂閱合約
model Subscription {
  id               String    @id @default(cuid())
  subscriptionNo   String    @unique // SUB-202605-001
  customerId       String
  planId           String
  status           String    @default("active") // active / paused / cancelled / expired
  billingCycle     String    @default("monthly") // monthly / halfyear
  startDate        DateTime
  endDate          DateTime? // 半年方案會有結束日
  nextShipmentDate DateTime?
  recipientName    String
  recipientPhone   String
  shippingAddress  String
  notes            String?
  // 此訂閱專屬的盒內內容（JSON），未設定則沿用方案 plan.contents / plan.bonusItems
  customContents   String? // JSON: [{name, weight, note}]
  customBonus      String? // JSON: [{name}]
  paymentType      String    @default("monthly") // full / monthly / other
  paymentNote      String? // 選「其他」時可填说明
  pausedAt         DateTime?
  cancelledAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  customer  Customer               @relation(fields: [customerId], references: [id], onDelete: Cascade)
  plan      SubscriptionPlan       @relation(fields: [planId], references: [id], onDelete: Restrict)
  shipments SubscriptionShipment[]
  orders    Order[]

  @@index([customerId])
  @@index([status])
  @@index([nextShipmentDate])
}

// 每次預定 / 已出的訂閱出貨
model SubscriptionShipment {
  id             String    @id @default(cuid())
  shipmentNo     String    @unique // SHIP-202605-001
  subscriptionId String
  scheduledDate  DateTime
  status         String    @default("pending") // pending / packed / shipped / delivered / skipped
  packedAt       DateTime?
  shippedAt      DateTime?
  deliveredAt    DateTime?
  trackingNo     String?
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  shipment     Shipment? // 對應到統一的 Shipment 紀錄（後建）

  @@index([subscriptionId])
  @@index([scheduledDate])
  @@index([status])
}

// =====================================================
// Task Ops
// =====================================================

model Task {
  id          String    @id @default(cuid())
  taskId      String    @unique // TASK-0001
  title       String
  description String?
  type        String    @default("general") // inventory_issue / settlement_followup / customer_service / vendor_followup / marketing / shipment / general
  status      String    @default("todo") // todo / in_progress / done / blocked
  priority    String    @default("medium") // low / medium / high / urgent
  dueDate     DateTime?
  assigneeId  String?
  reference   String? // 可放 SHIP-xxx / ORD-xxx 等
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  completedAt DateTime?

  assignee User? @relation("AssignedTasks", fields: [assigneeId], references: [id], onDelete: SetNull)
  attachments TaskAttachment[]

  @@index([status])
  @@index([type])
  @@index([dueDate])
}


model TaskAttachment {
  id        String   @id @default(cuid())
  taskId    String   @map("task_id")
  fileName  String   @map("file_name")
  mimeType  String   @map("mime_type")
  sizeBytes Int      @map("size_bytes")
  sha256    String
  data      Bytes
  createdAt DateTime @default(now()) @map("created_at")

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId, createdAt])
  @@map("task_attachments")
}

// =====================================================
// Automation recovery jobs
// =====================================================

/// 主要交易完成後的外部副作用佇列。所有作業以 jobKey 去重，避免 LINE／物流重送。
model AutomationJob {
  id              String    @id @default(cuid())
  jobKey          String    @unique @map("job_key")
  type            String
  status          String    @default("pending") // pending / retrying / processing / completed / fallback_succeeded / manual_required
  entityType      String?   @map("entity_type")
  entityId        String?   @map("entity_id")
  payload         Json
  attempts        Int       @default(0)
  nextAttemptAt   DateTime  @default(now()) @map("next_attempt_at")
  lockedUntil     DateTime? @map("locked_until")
  lastError       String?   @map("last_error")
  fallbackResult  String?   @map("fallback_result")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@index([status, nextAttemptAt])
  @@index([type, status])
  @@index([entityType, entityId])
  @@map("automation_jobs")
}

// =====================================================
// Dashboard KPI 預聚合（cron／讀頁共用）
// =====================================================

model DashboardKpiSnapshot {
  id         String   @id @default("default")
  payload    Json
  computedAt DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([computedAt])
}

// =====================================================
// UGC 活動（雞霸兩片開箱等）— LINE 對話為介面，DB 為真相
// =====================================================

model Campaign {
  id               String    @id @default(cuid())
  slug             String    @unique
  name             String
  status           String    @default("active") // draft / active / paused / ended
  coverImageUrl    String?   @map("cover_image_url")
  productName      String    @default("雞霸") @map("product_name")
  productQuantity  Int       @default(2) @map("product_quantity")
  productUnitPrice Float     @default(0) @map("product_unit_price")
  shippingFee      Float     @default(60) @map("shipping_fee")
  licenseVersion   String    @default("ugc-v1") @map("license_version")
  startsAt         DateTime? @map("starts_at")
  endsAt           DateTime? @map("ends_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  applications CampaignApplication[]

  @@map("campaigns")
}

model CampaignApplication {
  id                  String    @id @default(cuid())
  campaignId          String    @map("campaign_id")
  customerId          String?   @map("customer_id")
  lineUserId          String    @map("line_user_id")
  lineDisplayName     String?   @map("line_display_name")
  orderId             String?   @unique @map("order_id")
  instagramHandle     String?   @map("instagram_handle")
  petName             String?   @map("pet_name")
  recipientName       String?   @map("recipient_name")
  recipientPhone      String?   @map("recipient_phone")
  storeId             String?   @map("store_id")
  storeName           String?   @map("store_name")
  storeAddress        String?   @map("store_address")
  status              String    @default("COLLECTING_INFO")
  // COLLECTING_INFO / PENDING_REVIEW / APPROVED / AWAITING_SHIPPING_PAYMENT /
  // READY_TO_SHIP / REJECTED / CANCELLED_BY_USER / CANCELLED
  shippingQueueStatus String    @default("NOT_READY") @map("shipping_queue_status")
  // NOT_READY / QUEUED
  licenseAccepted     Boolean   @default(false) @map("license_accepted")
  licenseVersion      String?   @map("license_version")
  licenseAcceptedAt   DateTime? @map("license_accepted_at")
  licenseSourceMsgId  String?   @map("license_source_message_id")
  reviewedBy          String?   @map("reviewed_by")
  reviewedAt          DateTime? @map("reviewed_at")
  reviewNote          String?   @map("review_note")
  returnFields        String?   @map("return_fields") // JSON string array
  paymentToken        String?   @unique @map("payment_token")
  paymentStatus       String    @default("unpaid") @map("payment_status")
  // unpaid / paid / failed
  paidAt              DateTime? @map("paid_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  campaign            Campaign             @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  conversationSession ConversationSession?
  reviews             OrderReview[]
  auditLogs           StatusAuditLog[]

  @@index([campaignId, status])
  @@index([lineUserId, status])
  @@index([orderId])
  @@map("campaign_applications")
}

model ConversationSession {
  id                    String    @id @default(cuid())
  lineUserId            String    @map("line_user_id")
  campaignApplicationId String    @unique @map("campaign_application_id")
  currentState          String    @map("current_state")
  collectedDataJson     String    @default("{}") @map("collected_data_json")
  operatorTakeover      Boolean   @default(false) @map("operator_takeover")
  startedAt             DateTime  @default(now()) @map("started_at")
  completedAt           DateTime? @map("completed_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  application CampaignApplication   @relation(fields: [campaignApplicationId], references: [id], onDelete: Cascade)
  messages    ConversationMessage[]

  @@index([lineUserId, currentState])
  @@map("conversation_sessions")
}

model ConversationMessage {
  id            String   @id @default(cuid())
  sessionId     String   @map("session_id")
  lineMessageId String?  @map("line_message_id")
  senderType    String   @map("sender_type") // customer / bot / system / supervisor
  messageType   String   @default("text") @map("message_type")
  contentJson   String   @map("content_json")
  sentAt        DateTime @default(now()) @map("sent_at")

  session ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, sentAt])
  @@map("conversation_messages")
}

model OrderReview {
  id            String   @id @default(cuid())
  applicationId String   @map("application_id")
  orderId       String?  @map("order_id")
  reviewerId    String?  @map("reviewer_id")
  reviewerName  String?  @map("reviewer_name")
  decision      String // APPROVED / RETURNED / REJECTED
  reasonCode    String?  @map("reason_code")
  note          String?
  createdAt     DateTime @default(now()) @map("created_at")

  application CampaignApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@map("order_reviews")
}

model StatusAuditLog {
  id             String   @id @default(cuid())
  entityType     String   @map("entity_type")
  entityId       String   @map("entity_id")
  previousStatus String?  @map("previous_status")
  newStatus      String   @map("new_status")
  actorType      String   @map("actor_type") // customer / bot / supervisor / system / payment
  actorId        String?  @map("actor_id")
  metadataJson   String?  @map("metadata_json")
  createdAt      DateTime @default(now()) @map("created_at")
  applicationId  String?  @map("application_id")

  application CampaignApplication? @relation(fields: [applicationId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@index([applicationId])
  @@map("status_audit_logs")
}

// =====================================================
// 換罐計劃：口味主檔／合作店庫存（LINE 介紹與後台）
// =====================================================

/// 換罐口味（本期可選品項；UI 不寫死）
model RefillFlavour {
  id             String    @id @default(cuid())
  code           String    @unique
  name           String
  weightGrams    Int       @map("weight_grams")
  imageUrl       String?   @map("image_url")
  isActive       Boolean   @default(true) @map("is_active")
  availableFrom  DateTime? @map("available_from")
  availableUntil DateTime? @map("available_until")
  sortOrder      Int       @default(0) @map("sort_order")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  stocks    MerchantRefillStock[]
  stockTxns RefillStockTxn[]

  @@index([isActive, sortOrder])
  @@map("refill_flavours")
}

/// 合作店口味庫存（實際可選依店家當期庫存）
model MerchantRefillStock {
  id              String   @id @default(cuid())
  storeId         String   @map("store_id")
  flavourId       String   @map("flavour_id")
  quantity        Int      @default(0)
  isAvailable     Boolean  @default(true) @map("is_available")
  updatedByUserId String?  @map("updated_by_user_id")
  updatedAt       DateTime @updatedAt @map("updated_at")
  createdAt       DateTime @default(now()) @map("created_at")

  store   Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  flavour RefillFlavour @relation(fields: [flavourId], references: [id], onDelete: Cascade)

  @@unique([storeId, flavourId])
  @@index([flavourId])
  @@index([storeId, isAvailable])
  @@map("merchant_refill_stocks")
}

/// 庫存異動紀錄
model RefillStockTxn {
  id              String   @id @default(cuid())
  storeId         String   @map("store_id")
  flavourId       String   @map("flavour_id")
  changeQty       Int      @map("change_qty")
  quantityAfter   Int      @map("quantity_after")
  reason          String // adjust | period_copy | out_of_stock | restock | seed
  note            String?
  createdByUserId String?  @map("created_by_user_id")
  createdAt       DateTime @default(now()) @map("created_at")

  flavour RefillFlavour @relation(fields: [flavourId], references: [id], onDelete: Cascade)

  @@index([storeId, createdAt])
  @@index([flavourId, createdAt])
  @@map("refill_stock_txns")
}

/// 換罐計劃全域設定（主視覺、價格重點）
model RefillPlanSettings {
  id                String    @id @default("default")
  heroImageUrl      String?   @map("hero_image_url")
  firstJarPrice     Int       @default(129) @map("first_jar_price")
  exchangePrice     Int       @default(99) @map("exchange_price")
  pointsPerJar      Int       @default(1) @map("points_per_jar")
  pointsForDiscount Int       @default(10) @map("points_for_discount")
  discountAmount    Int       @default(200) @map("discount_amount")
  flavourUpdateNote String    @default("每兩週更新") @map("flavour_update_note")
  periodStartedAt   DateTime? @map("period_started_at")
  periodEndedAt     DateTime? @map("period_ended_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@map("refill_plan_settings")
}

/// 店家身分人工確認／測試標記。只新增此表，不改既有店家、MER、slug 或交易欄位。
/// 撤銷不是刪除：原列保留。
model PartnerStoreIdentityDecision {
  id                     String    @id @default(cuid())
  merchantId             String    @map("merchant_id")
  legacySlug             String?   @map("legacy_slug")
  /// same_store | test | demo
  verdict                String
  decidedByUserId        String    @map("decided_by_user_id")
  decidedAt              DateTime  @map("decided_at")
  rationale              String
  otherRecordDisposition String    @map("other_record_disposition")
  /// preview | production
  scope                  String    @default("production")
  createdAt              DateTime  @default(now()) @map("created_at")
  revokedAt              DateTime? @map("revoked_at")
  revokedByUserId        String?   @map("revoked_by_user_id")
  revokeReason           String?   @map("revoke_reason")

  decidedBy User  @relation("PartnerStoreIdentityDecidedBy", fields: [decidedByUserId], references: [id])
  revokedBy User? @relation("PartnerStoreIdentityRevokedBy", fields: [revokedByUserId], references: [id])

  @@index([scope, revokedAt])
  @@index([merchantId, scope])
  @@index([legacySlug, scope])
  @@map("partner_store_identity_decisions")
}

// Contains metadata only; never passwords, hashes, or ciphertext.
model PosPasswordAccessLog {
  id             String   @id @default(cuid())
  adminId        String   @map("admin_id")
  merchantUserId String   @map("merchant_user_id")
  action         String
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([merchantUserId, createdAt])
  @@map("pos_password_access_logs")
}

model PurchaseReceiptMetadataChange {
  id String @id @default(cuid())
  receiptId String @map("receipt_id")
  actorId String @map("actor_id")
  actorName String @map("actor_name")
  before Json
  after Json
  createdAt DateTime @default(now()) @map("created_at")
  receipt PurchaseReceipt @relation(fields: [receiptId], references: [id], onDelete: Restrict)
  @@index([receiptId, createdAt])
  @@map("purchase_receipt_metadata_changes")
}
