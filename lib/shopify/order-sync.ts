import {
  auditHasWebhookId,
  compactShopifyAuditMetadata,
  decideShopifyEventVersion,
  parseSourceUpdatedAt,
  shopifyAuditEntityId,
  stringifyShopifyAuditMetadata,
  type ShopifyAuditDecision,
  type ShopifyAuditMetadata,
} from '@/lib/shopify/event-version';
import {
  isMooncakeShopifyItem,
  matchShopifyItemToProduct,
  resolvedShopifyItemSku,
  type MatchableProduct,
} from '@/lib/shopify/match-line-item';
import {
  cleanShopifyText,
  convenienceAddress,
  hasCompleteShopifyPickupInfo,
  isConveniencePickup,
  resolveShopifyItemWeight,
  shopifyAddressText,
  shopifyMoney,
  shopifyPaymentStatus,
  shopifyPickupInfo,
  shopifyShippingFeeType,
  validatePaidOrderPayload,
  validateShopifyOrderPayload,
  type ShopifyPaidOrder,
} from '@/lib/shopify/order-mapping';
import { ShopifyWebhookClientError, ShopifyWebhookRetryableError } from '@/lib/shopify/webhook-errors';
import type { ShopifyWebhookTopic } from '@/lib/shopify/webhook-verify';
import { SOURCE_ORDER_PREFIX } from '@/lib/orders/source-order-number';
import {
  createPrismaShopifyStore,
  defaultShopifySleep,
  withUniqueConflictRetry,
  type ShopifyOrderCreateData,
  type ShopifyOrderItemRecord,
  type ShopifyOrderRecord,
  type ShopifyWebhookDb,
  type ShopifyWebhookTx,
} from '@/lib/shopify/webhook-store';

export type ShopifySyncResult = {
  ignored: boolean;
  created: boolean;
  updated: boolean;
  decision: ShopifyAuditDecision;
  order: ShopifyOrderRecord | null;
};

export type ShopifyOrderSyncInput = {
  topic: Extract<ShopifyWebhookTopic, 'orders/create' | 'orders/paid' | 'orders/updated'>;
  shopDomain: string;
  webhookId: string;
  order: ShopifyPaidOrder;
  db?: ShopifyWebhookDb;
  sleep?: (ms: number) => Promise<void>;
};

function activeCustomerShipment(order: ShopifyOrderRecord) {
  return order.shipments.find((shipment) => shipment.type === 'customer_order' && shipment.status !== 'cancelled');
}

function canWriteSnapshot(order: ShopifyOrderRecord) {
  if (order.status === 'cancelled') return false;
  if (order.status !== 'pending_review') return false;
  return !activeCustomerShipment(order);
}

async function writeAudit(
  tx: ShopifyWebhookTx,
  meta: ShopifyAuditMetadata,
  previousStatus: string | null,
  newStatus: string,
  actorType: 'payment' | 'system',
) {
  await tx.statusAuditLog.create({
    entityType: 'shopify_order',
    entityId: shopifyAuditEntityId(meta.shopDomain, meta.externalOrderId),
    previousStatus,
    newStatus,
    actorType,
    actorId: meta.webhookId || null,
    metadataJson: stringifyShopifyAuditMetadata(compactShopifyAuditMetadata(meta)),
  });
}

async function resolveSnapshotItems(tx: ShopifyWebhookTx, order: ShopifyPaidOrder) {
  validateShopifyOrderPayload(order);
  const lineItems = order.line_items ?? [];
  const skus = [
    ...new Set(
      lineItems
        .map((item) => cleanShopifyText(item.sku))
        .filter((sku): sku is string => Boolean(sku)),
    ),
  ];
  let products = await tx.product.findMatchable(skus);
  const resolved: Array<{ item: NonNullable<ShopifyPaidOrder['line_items']>[number]; product: MatchableProduct }> = [];
  for (const item of lineItems) {
    let product = matchShopifyItemToProduct(item, products);
    if (!product && isMooncakeShopifyItem(item)) {
      const mooncake = await tx.ensureMooncake();
      if (mooncake) {
        product = mooncake;
        products = [...products, mooncake];
      }
    }
    if (!product) {
      throw new ShopifyWebhookRetryableError(
        `Furmosa 找不到 Shopify 商品：${cleanShopifyText(item.sku) ?? cleanShopifyText(item.title) ?? '未命名商品'}`,
      );
    }
    resolved.push({ item, product });
  }
  return resolved.map(({ item, product }) => {
    const sku = resolvedShopifyItemSku(item, product);
    const quantity = Number(item.quantity);
    const unitPrice = shopifyMoney(item.price);
    const weightGrams = resolveShopifyItemWeight(item, product.priceTiers);
    const itemRecord: Omit<ShopifyOrderItemRecord, 'id'> = {
      productId: product.id,
      productName: [cleanShopifyText(item.title), cleanShopifyText(item.variant_title)].filter(Boolean).join(' · ') || product.name,
      sku,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
      weightGrams,
      unit: weightGrams ? 'g' : product.unit,
    };
    return itemRecord;
  });
}

function snapshotFields(order: ShopifyPaidOrder, items: Array<Omit<ShopifyOrderItemRecord, 'id'>>) {
  const subtotal = shopifyMoney(order.subtotal_price);
  const discount = shopifyMoney(order.total_discounts);
  const shippingFee = shopifyMoney(order.total_shipping_price_set?.shop_money?.amount);
  const total = shopifyMoney(order.total_price);
  const convenience = isConveniencePickup(order);
  const pickup = shopifyPickupInfo(order);
  return {
    subtotal,
    discount,
    shippingFee,
    companyShippingCost: shippingFee > 0 ? 0 : shippingFee,
    total,
    shippingFeeType: shopifyShippingFeeType(shippingFee),
    shippingMethod: convenience ? 'convenience' : 'home',
    shippingAddress: convenience ? convenienceAddress(order) : shopifyAddressText(order),
    cvsBrand: convenience ? pickup.brand ?? '711' : null,
    cvsStoreId: convenience ? pickup.storeId : null,
    cvsStoreName: convenience
      ? pickup.storeName ?? cleanShopifyText(order.shipping_address?.company) ?? cleanShopifyText(order.shipping_address?.address1)
      : null,
    note: `Shopify ${cleanShopifyText(order.name) ?? String(order.id)}\n訂單已同步，${convenience && !hasCompleteShopifyPickupInfo(order) ? '門市資料待確認' : '待客服審核'}`,
    items,
  };
}

function skeletonFields(order: ShopifyPaidOrder, paymentStatus: string, orderNumber: string): ShopifyOrderCreateData {
  return {
    orderNumber,
    source: 'shopify',
    externalStore: '',
    externalOrderId: '',
    externalOrderName: cleanShopifyText(order.name),
    status: 'pending_review',
    paymentStatus,
    fulfillmentStatus: 'pending',
    shippingFeeType: 'free',
    subtotal: 0,
    discount: 0,
    shippingFee: 0,
    companyShippingCost: 0,
    total: 0,
    shippingMethod: 'home',
    shippingAddress: null,
    cvsBrand: null,
    cvsStoreId: null,
    cvsStoreName: null,
    note: `Shopify ${cleanShopifyText(order.name) ?? String(order.id)}\n訂單已同步，待客服審核`,
    orderedAt: new Date(order.processed_at ?? order.created_at ?? Date.now()),
    items: [],
  };
}

export async function syncShopifyOrder(input: ShopifyOrderSyncInput): Promise<ShopifySyncResult> {
  const externalStore = input.shopDomain.trim().toLowerCase();
  if (!externalStore) throw new ShopifyWebhookClientError('缺少 Shopify shop domain', 403);
  validateShopifyOrderPayload(input.order);
  const externalOrderId = String(input.order.id);
  const sourceUpdatedAt = parseSourceUpdatedAt(input.order.updated_at);
  const db = input.db ?? createPrismaShopifyStore();
  const sleep = input.sleep ?? defaultShopifySleep;

  if (input.topic === 'orders/paid' && input.order.financial_status && input.order.financial_status !== 'paid') {
    throw new ShopifyWebhookClientError(`Shopify 訂單尚未付款：${input.order.financial_status}`);
  }

  return withUniqueConflictRetry(async () => {
    return db.$transaction(async (tx) => {
      const entityId = shopifyAuditEntityId(externalStore, externalOrderId);
      const audits = await tx.statusAuditLog.listForEntity('shopify_order', entityId);
      if (auditHasWebhookId(audits, input.webhookId)) {
        const existing = await tx.order.findByExternal(externalStore, externalOrderId);
        return {
          ignored: true,
          created: false,
          updated: false,
          decision: 'ignored_duplicate' as const,
          order: existing,
        };
      }

      let paymentDecision = decideShopifyEventVersion({
        records: audits,
        fieldGroup: 'payment',
        webhookId: input.webhookId,
        sourceUpdatedAt,
      });
      let snapshotDecision = decideShopifyEventVersion({
        records: audits,
        fieldGroup: 'snapshot',
        webhookId: input.webhookId,
        sourceUpdatedAt,
      });

      let existing = await tx.order.findByExternal(externalStore, externalOrderId);
      const previousPayment = existing?.paymentStatus ?? null;
      const previousStatus = existing?.status ?? null;
      const nextPaymentStatus =
        input.topic === 'orders/paid' ? 'paid' : shopifyPaymentStatus(input.order.financial_status);

      if (existing && snapshotDecision.action === 'apply' && !canWriteSnapshot(existing)) {
        snapshotDecision = {
          action: 'ignore',
          decision: existing.status === 'cancelled' ? 'ignored_cancelled_order' : 'ignored_operational',
        };
      }

      const applyPayment = paymentDecision.action === 'apply';
      const applySnapshot = snapshotDecision.action === 'apply';

      if (!applyPayment && !applySnapshot) {
        const decision =
          paymentDecision.decision === 'ignored_stale' || snapshotDecision.decision === 'ignored_stale'
            ? 'ignored_stale'
            : paymentDecision.decision === 'ignored_missing_timestamp' ||
                snapshotDecision.decision === 'ignored_missing_timestamp'
              ? 'ignored_missing_timestamp'
              : snapshotDecision.decision;
        if (paymentDecision.action === 'ignore') {
          await writeAudit(
            tx,
            {
              topic: input.topic,
              shopDomain: externalStore,
              externalOrderId,
              webhookId: input.webhookId,
              sourceUpdatedAt,
              fieldGroup: 'payment',
              decision: paymentDecision.decision,
            },
            previousPayment,
            previousPayment ?? paymentDecision.decision,
            'payment',
          );
        }
        if (snapshotDecision.action === 'ignore') {
          await writeAudit(
            tx,
            {
              topic: input.topic,
              shopDomain: externalStore,
              externalOrderId,
              webhookId: input.webhookId,
              sourceUpdatedAt,
              fieldGroup: 'snapshot',
              decision: snapshotDecision.decision,
            },
            previousStatus,
            previousStatus ?? snapshotDecision.decision,
            'system',
          );
        }
        return {
          ignored: true,
          created: false,
          updated: false,
          decision,
          order: existing,
        };
      }

      let snapshot: ReturnType<typeof snapshotFields> | null = null;
      if (applySnapshot) {
        const items = await resolveSnapshotItems(tx, input.order);
        snapshot = snapshotFields(input.order, items);
      }

      let created = false;
      let updated = false;
      if (!existing) {
        const orderNumber = await tx.order.nextNumber(SOURCE_ORDER_PREFIX.shopify);
        const base = skeletonFields(input.order, applyPayment ? nextPaymentStatus : 'unpaid', orderNumber);
        const createdData: ShopifyOrderCreateData = {
          ...base,
          externalStore,
          externalOrderId,
          ...(snapshot ?? {}),
          paymentStatus: applyPayment ? nextPaymentStatus : 'unpaid',
        };
        existing = await tx.order.create(createdData);
        created = true;
      } else {
        const updateData: Parameters<ShopifyWebhookTx['order']['update']>[1] = {};
        if (applyPayment) {
          updateData.paymentStatus = nextPaymentStatus;
        }
        if (applySnapshot && snapshot) {
          updateData.shippingFeeType = snapshot.shippingFeeType;
          updateData.subtotal = snapshot.subtotal;
          updateData.discount = snapshot.discount;
          updateData.shippingFee = snapshot.shippingFee;
          updateData.companyShippingCost = snapshot.companyShippingCost;
          updateData.total = snapshot.total;
          updateData.shippingMethod = snapshot.shippingMethod;
          updateData.shippingAddress = snapshot.shippingAddress;
          updateData.cvsBrand = snapshot.cvsBrand;
          updateData.cvsStoreId = snapshot.cvsStoreId;
          updateData.cvsStoreName = snapshot.cvsStoreName;
          updateData.note = snapshot.note;
          updateData.replaceItems = snapshot.items;
        }
        if (Object.keys(updateData).length > 0) {
          existing = await tx.order.update(existing.id, updateData);
          updated = true;
        }
      }

      if (applyPayment) {
        await writeAudit(
          tx,
          {
            topic: input.topic,
            shopDomain: externalStore,
            externalOrderId,
            webhookId: input.webhookId,
            sourceUpdatedAt,
            fieldGroup: 'payment',
            decision: 'accepted',
          },
          created ? null : previousPayment,
          existing.paymentStatus,
          'payment',
        );
      } else if (paymentDecision.action === 'ignore') {
        await writeAudit(
          tx,
          {
            topic: input.topic,
            shopDomain: externalStore,
            externalOrderId,
            webhookId: input.webhookId,
            sourceUpdatedAt,
            fieldGroup: 'payment',
            decision: paymentDecision.decision,
          },
          existing.paymentStatus,
          existing.paymentStatus,
          'payment',
        );
      }

      if (applySnapshot) {
        await writeAudit(
          tx,
          {
            topic: input.topic,
            shopDomain: externalStore,
            externalOrderId,
            webhookId: input.webhookId,
            sourceUpdatedAt,
            fieldGroup: 'snapshot',
            decision: 'accepted',
          },
          created ? null : previousStatus,
          existing.status,
          'system',
        );
      } else if (snapshotDecision.action === 'ignore') {
        await writeAudit(
          tx,
          {
            topic: input.topic,
            shopDomain: externalStore,
            externalOrderId,
            webhookId: input.webhookId,
            sourceUpdatedAt,
            fieldGroup: 'snapshot',
            decision: snapshotDecision.decision,
          },
          existing.status,
          existing.status,
          'system',
        );
      }

      return {
        ignored: false,
        created,
        updated,
        decision: 'accepted' as const,
        order: existing,
      };
    });
  }, sleep);
}

export async function importShopifyOrder(shopDomain: string, order: ShopifyPaidOrder, db?: ShopifyWebhookDb) {
  validateShopifyOrderPayload(order);
  return syncShopifyOrder({
    topic: 'orders/create',
    shopDomain,
    webhookId: '',
    order,
    db,
  });
}

export async function importShopifyPaidOrder(shopDomain: string, order: ShopifyPaidOrder, db?: ShopifyWebhookDb) {
  validatePaidOrderPayload(order);
  return syncShopifyOrder({
    topic: 'orders/paid',
    shopDomain,
    webhookId: '',
    order,
    db,
  });
}
