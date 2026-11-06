import Link from 'next/link';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import type { ShipmentQueueRow } from '@/components/shipments/shipment-queue-table';
import {
  shipmentStatusLabel,
  SHIPMENT_STATUSES,
} from '@/lib/shipment';
import { SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES } from '@/lib/campaigns/jiba-two-piece/payment';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import { canonicalProductName } from '@/lib/product-label';
import {
  activeShipmentQueueWhere,
  dedupeShipmentsByOrder,
} from '@/lib/shipment-queue-filters';
import { getShipmentQueueCounts } from '@/lib/hot-path-reads';
import { SHIPMENT_QUEUE_TAKE } from '@/lib/list-pagination';
import {
  createShipmentQueuePerf,
  emptyShipmentQueuePerfCounts,
  isShipmentQueuePerfEnabled,
  readShipmentQueuePerfRequestContext,
} from '@/lib/shipment-queue-perf';
import {
  isShipmentKindKey,
  mergeShipmentWhere,
  resolveShipmentDisplayKind,
} from '@/lib/order-hub-kinds';
import { mergeSearchWhere, shipmentSearchWhere } from '@/lib/site-search';
import { Prisma } from '@prisma/client';
import { cn } from '@/lib/utils';
import { shipmentInventoryAdvisories } from '@/lib/inventory/shipment-advisory';
import { normalizeStoredShopifyRecipient } from '@/lib/shopify/recipient-name';
import { displayOrderNumber } from '@/lib/orders/display-order-number';
import { resolveShopifyBundleDisplay } from '@/lib/shopify/bundle-contents';
import { customerDeliveryNote } from '@/lib/order-notes';

const merchantLogisticsSelect = {
  id: true,
  name: true,
  contactName: true,
  phone: true,
  address: true,
  city: true,
  preferredCarrier: true,
  pickupStoreName: true,
} as const;

const queueTierSelect = {
  id: true,
  productId: true,
  weightGrams: true,
  unit: true,
  unitQty: true,
} as const;

const queueBalanceSelect = {
  productId: true,
  quantity: true,
  unit: true,
  lastCountedAt: true,
} as const;

const queueOrderSnapshotSelect = {
  id: true,
  shopifySnapshot: true,
} as const;

const shipmentBaseSelect = {
  id: true,
  shipmentNumber: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  carrier: true,
  trackingNumber: true,
  recipientName: true,
  recipientPhone: true,
  recipientAddress: true,
  merchantId: true,
  customerId: true,
  orderId: true,
  subscriptionShipmentId: true,
} as const;

type ShipmentQueueBase = Prisma.ShipmentGetPayload<{ select: typeof shipmentBaseSelect }>;
type ShipmentQueueRecord = ShipmentQueueBase & {
  merchant: {
    id: string;
    name: string;
    contactName: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    preferredCarrier: string | null;
    pickupStoreName: string | null;
  } | null;
  customer: { id: string; name: string } | null;
  order: {
    id: string;
    orderNumber: string;
    source: string;
    externalOrderName: string | null;
    status: string;
    paymentStatus: string;
    shippingFeeType: string;
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
    note: string | null;
    omsStatus: Prisma.OrderGetPayload<object>['omsStatus'];
    merchantOrderMode: string | null;
  } | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    weightGrams: number | null;
    variantKey: string | null;
    notes: string | null;
    product: {
      id: string;
      sku: string;
      name: string;
      category: string;
      unit: string;
      productCategory: string;
      inventorySourceProduct: {
        id: string;
        sku: string;
        name: string;
        status: string;
        unit: string;
      } | null;
    };
  }>;
  subscriptionShipment: {
    shipmentNo: string;
    scheduledDate: Date;
    subscription: {
      subscriptionNo: string;
      plan: { name: string; contents: string };
    };
  } | null;
};

type ShipmentQueueJoinRow = {
  shipmentId: string;
  merchantId: string | null;
  merchantName: string | null;
  merchantContactName: string | null;
  merchantPhone: string | null;
  merchantAddress: string | null;
  merchantCity: string | null;
  merchantPreferredCarrier: string | null;
  merchantPickupStoreName: string | null;
  customerId: string | null;
  customerName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderSource: string | null;
  orderExternalOrderName: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  orderShippingFeeType: string | null;
  orderShippingMethod: string | null;
  orderCvsBrand: string | null;
  orderCvsStoreId: string | null;
  orderCvsStoreName: string | null;
  orderNote: string | null;
  orderOmsStatus: Prisma.OrderGetPayload<object>['omsStatus'] | null;
  orderMerchantOrderMode: string | null;
  itemId: string | null;
  itemProductId: string | null;
  itemProductName: string | null;
  itemQuantity: number | null;
  itemWeightGrams: number | null;
  itemVariantKey: string | null;
  itemNotes: string | null;
  productSku: string | null;
  productName: string | null;
  productCategoryLegacy: string | null;
  productUnit: string | null;
  productCategory: string | null;
  sourceProductId: string | null;
  sourceProductSku: string | null;
  sourceProductName: string | null;
  sourceProductStatus: string | null;
  sourceProductUnit: string | null;
  subscriptionShipmentNo: string | null;
  subscriptionScheduledDate: Date | null;
  subscriptionNo: string | null;
  subscriptionPlanName: string | null;
  subscriptionPlanContents: string | null;
};
type QueueTier = Awaited<
  ReturnType<typeof prisma.productPriceTier.findMany<{ select: typeof queueTierSelect }>>
>[number];
type QueueBalance = Awaited<
  ReturnType<typeof prisma.inventoryBalance.findMany<{ select: typeof queueBalanceSelect }>>
>[number];
type QueueOrderSnapshot = Awaited<
  ReturnType<typeof prisma.order.findMany<{ select: typeof queueOrderSnapshotSelect }>>
>[number];

type ShipmentQueueEnrichment = {
  tiersByProductId: Map<string, QueueTier[]>;
  tierById: Map<string, QueueTier>;
  balanceByProductId: Map<string, QueueBalance>;
};

async function loadShipmentQueuePage(
  where: Prisma.ShipmentWhereInput,
): Promise<ShipmentQueueRecord[]> {
  const shipments = await prisma.shipment.findMany({
    where,
    select: shipmentBaseSelect,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: SHIPMENT_QUEUE_TAKE,
  });
  if (shipments.length === 0) return [];

  const shipmentIds = shipments.map((shipment) => shipment.id);
  const rows = await prisma.$queryRaw<ShipmentQueueJoinRow[]>(Prisma.sql`
    SELECT
      s.id AS "shipmentId",
      m.id AS "merchantId",
      m.name AS "merchantName",
      m."contactName" AS "merchantContactName",
      m.phone AS "merchantPhone",
      m.address AS "merchantAddress",
      m.city AS "merchantCity",
      m."preferredCarrier" AS "merchantPreferredCarrier",
      m."pickupStoreName" AS "merchantPickupStoreName",
      c.id AS "customerId",
      c.name AS "customerName",
      o.id AS "orderId",
      o."orderNumber" AS "orderNumber",
      o.source AS "orderSource",
      o.external_order_name AS "orderExternalOrderName",
      o.status AS "orderStatus",
      o."paymentStatus" AS "orderPaymentStatus",
      o."shippingFeeType" AS "orderShippingFeeType",
      o."shippingMethod" AS "orderShippingMethod",
      o."cvsBrand" AS "orderCvsBrand",
      o."cvsStoreId" AS "orderCvsStoreId",
      o."cvsStoreName" AS "orderCvsStoreName",
      o.note AS "orderNote",
      o.oms_status AS "orderOmsStatus",
      o.merchant_order_mode AS "orderMerchantOrderMode",
      si.id AS "itemId",
      si."productId" AS "itemProductId",
      si."productName" AS "itemProductName",
      si.quantity AS "itemQuantity",
      si."weightGrams" AS "itemWeightGrams",
      si."variantKey" AS "itemVariantKey",
      si.notes AS "itemNotes",
      p.sku AS "productSku",
      p.name AS "productName",
      p.category AS "productCategoryLegacy",
      p.unit AS "productUnit",
      p.product_category AS "productCategory",
      source.id AS "sourceProductId",
      source.sku AS "sourceProductSku",
      source.name AS "sourceProductName",
      source.status AS "sourceProductStatus",
      source.unit AS "sourceProductUnit",
      ss."shipmentNo" AS "subscriptionShipmentNo",
      ss."scheduledDate" AS "subscriptionScheduledDate",
      subscription."subscriptionNo" AS "subscriptionNo",
      plan.name AS "subscriptionPlanName",
      plan.contents AS "subscriptionPlanContents"
    FROM "Shipment" s
    LEFT JOIN "Merchant" m ON m.id = s."merchantId"
    LEFT JOIN "Customer" c ON c.id = s."customerId"
    LEFT JOIN "Order" o ON o.id = s."orderId"
    LEFT JOIN "ShipmentItem" si ON si."shipmentId" = s.id
    LEFT JOIN "Product" p ON p.id = si."productId"
    LEFT JOIN "Product" source ON source.id = p.inventory_source_product_id
    LEFT JOIN "SubscriptionShipment" ss ON ss.id = s."subscriptionShipmentId"
    LEFT JOIN "Subscription" subscription ON subscription.id = ss."subscriptionId"
    LEFT JOIN "SubscriptionPlan" plan ON plan.id = subscription."planId"
    WHERE s.id IN (${Prisma.join(shipmentIds)})
    ORDER BY si.id ASC
  `);

  const records = new Map<string, ShipmentQueueRecord>();
  for (const shipment of shipments) {
    records.set(shipment.id, {
      ...shipment,
      merchant: null,
      customer: null,
      order: null,
      items: [],
      subscriptionShipment: null,
    });
  }

  for (const row of rows) {
    const shipment = records.get(row.shipmentId);
    if (!shipment) continue;

    if (row.merchantId !== null && row.merchantName !== null) {
      shipment.merchant = {
        id: row.merchantId,
        name: row.merchantName,
        contactName: row.merchantContactName,
        phone: row.merchantPhone,
        address: row.merchantAddress,
        city: row.merchantCity,
        preferredCarrier: row.merchantPreferredCarrier,
        pickupStoreName: row.merchantPickupStoreName,
      };
    }
    if (row.customerId !== null && row.customerName !== null) {
      shipment.customer = { id: row.customerId, name: row.customerName };
    }
    if (
      row.orderId !== null &&
      row.orderNumber !== null &&
      row.orderSource !== null &&
      row.orderStatus !== null &&
      row.orderPaymentStatus !== null &&
      row.orderShippingFeeType !== null &&
      row.orderShippingMethod !== null
    ) {
      shipment.order = {
        id: row.orderId,
        orderNumber: row.orderNumber,
        source: row.orderSource,
        externalOrderName: row.orderExternalOrderName,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
        shippingFeeType: row.orderShippingFeeType,
        shippingMethod: row.orderShippingMethod,
        cvsBrand: row.orderCvsBrand,
        cvsStoreId: row.orderCvsStoreId,
        cvsStoreName: row.orderCvsStoreName,
        note: row.orderNote,
        omsStatus: row.orderOmsStatus,
        merchantOrderMode: row.orderMerchantOrderMode,
      };
    }
    if (
      row.itemId !== null &&
      row.itemProductId !== null &&
      row.itemProductName !== null &&
      row.itemQuantity !== null &&
      row.productSku !== null &&
      row.productName !== null &&
      row.productCategoryLegacy !== null &&
      row.productUnit !== null &&
      row.productCategory !== null
    ) {
      shipment.items.push({
        productId: row.itemProductId,
        productName: row.itemProductName,
        quantity: row.itemQuantity,
        weightGrams: row.itemWeightGrams,
        variantKey: row.itemVariantKey,
        notes: row.itemNotes,
        product: {
          id: row.itemProductId,
          sku: row.productSku,
          name: row.productName,
          category: row.productCategoryLegacy,
          unit: row.productUnit,
          productCategory: row.productCategory,
          inventorySourceProduct:
            row.sourceProductId !== null &&
            row.sourceProductSku !== null &&
            row.sourceProductName !== null &&
            row.sourceProductStatus !== null &&
            row.sourceProductUnit !== null
              ? {
                  id: row.sourceProductId,
                  sku: row.sourceProductSku,
                  name: row.sourceProductName,
                  status: row.sourceProductStatus,
                  unit: row.sourceProductUnit,
                }
              : null,
        },
      });
    }
    if (
      row.subscriptionShipmentNo !== null &&
      row.subscriptionScheduledDate !== null &&
      row.subscriptionNo !== null &&
      row.subscriptionPlanName !== null &&
      row.subscriptionPlanContents !== null
    ) {
      shipment.subscriptionShipment = {
        shipmentNo: row.subscriptionShipmentNo,
        scheduledDate: row.subscriptionScheduledDate,
        subscription: {
          subscriptionNo: row.subscriptionNo,
          plan: {
            name: row.subscriptionPlanName,
            contents: row.subscriptionPlanContents,
          },
        },
      };
    }
  }

  return shipments.map((shipment) => records.get(shipment.id)!);
}

function indexShipmentQueueEnrichment(
  tiers: QueueTier[],
  balances: QueueBalance[],
): ShipmentQueueEnrichment {
  const tiersByProductId = new Map<string, QueueTier[]>();
  for (const tier of tiers) {
    const productTiers = tiersByProductId.get(tier.productId) ?? [];
    productTiers.push(tier);
    tiersByProductId.set(tier.productId, productTiers);
  }
  return {
    tiersByProductId,
    tierById: new Map(tiers.map((tier) => [tier.id, tier])),
    balanceByProductId: new Map(balances.map((balance) => [balance.productId, balance])),
  };
}

function queueInventoryItems(
  shipment: ShipmentQueueRecord,
  enrichment: ShipmentQueueEnrichment,
) {
  return shipment.items.map((item) => {
    const source = item.product.inventorySourceProduct;
    const productBalance = enrichment.balanceByProductId.get(item.product.id);
    const sourceBalance = source
      ? enrichment.balanceByProductId.get(source.id)
      : undefined;
    return {
      quantity: item.quantity,
      weightGrams: item.weightGrams,
      variantKey: item.variantKey,
      product: {
        ...item.product,
        priceTiers: enrichment.tiersByProductId.get(item.product.id) ?? [],
        inventoryBalances: productBalance ? [productBalance] : [],
        inventorySourceProduct: source
          ? {
              ...source,
              inventoryBalances: sourceBalance ? [sourceBalance] : [],
            }
          : null,
      },
    };
  });
}

const STAGE_TABS = [
  { key: 'pending', label: '待出貨' },
  { key: 'shipped', label: '運送中' },
  { key: 'delivered', label: '待驗收' },
  { key: 'received', label: '已完成' },
] as const;

function toQueueRow(
  s: ShipmentQueueRecord,
  fee: ReturnType<typeof resolveShipmentFulfillmentFee>,
  enrichment: ShipmentQueueEnrichment,
  shopifySnapshot: QueueOrderSnapshot['shopifySnapshot'] | null,
): ShipmentQueueRow {
  return {
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    type: s.type,
    displayKind: resolveShipmentDisplayKind({
      type: s.type,
      merchantOrderMode: s.order?.merchantOrderMode,
    }),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    recipientName: s.order?.omsStatus
      ? normalizeStoredShopifyRecipient(s.recipientName, shopifySnapshot)
      : s.recipientName,
    recipientPhone: s.recipientPhone,
    recipientAddress: s.recipientAddress,
    merchant: s.merchant
      ? {
          id: s.merchant.id,
          name: s.merchant.name,
          contactName: s.merchant.contactName,
          phone: s.merchant.phone,
          address: s.merchant.address,
          city: s.merchant.city,
          preferredCarrier: s.merchant.preferredCarrier,
          pickupStoreName: s.merchant.pickupStoreName,
        }
      : null,
    customer: s.customer ? { id: s.customer.id, name: s.customer.name } : null,
    order: s.order
      ? {
          id: s.order.id,
          orderNumber: s.order.orderNumber,
          displayOrderNumber: displayOrderNumber(s.order),
          omsStatus: s.order.omsStatus,
          status: s.order.status,
          paymentStatus: s.order.paymentStatus,
          shippingFeeType: s.order.shippingFeeType,
          shippingMethod: s.order.shippingMethod,
          cvsBrand: s.order.cvsBrand,
          cvsStoreId: s.order.cvsStoreId,
          cvsStoreName: s.order.cvsStoreName,
          note: customerDeliveryNote(s.order.note),
        }
      : null,
    fulfillmentFeeLabel: fee.fulfillmentFeeLabel,
    paymentReviewHold: fee.paymentReviewHold,
    inventoryWarnings: shipmentInventoryAdvisories(queueInventoryItems(s, enrichment)),
    items: s.items.map((item) => {
      const tier = item.variantKey
        ? enrichment.tierById.get(item.variantKey)
        : null;
      const bundle = s.order
        ? resolveShopifyBundleDisplay(
            shopifySnapshot,
            item.productName,
            item.quantity,
            item.notes,
          )
        : null;
      return {
        productName: canonicalProductName(item.productName),
        weightGrams: item.weightGrams,
        quantity: item.quantity,
        packSize: tier?.unitQty ?? null,
        packUnit: tier?.unit ?? null,
        variantLabel: bundle?.variantLabel ?? null,
        contentsLabel: bundle?.contentsLabel ?? null,
      };
    }),
    subscriptionShipment: s.subscriptionShipment
      ? {
          shipmentNo: s.subscriptionShipment.shipmentNo,
          scheduledDate: s.subscriptionShipment.scheduledDate
            ? s.subscriptionShipment.scheduledDate.toISOString()
            : null,
          subscription: s.subscriptionShipment.subscription
            ? {
                subscriptionNo: s.subscriptionShipment.subscription.subscriptionNo,
                plan: s.subscriptionShipment.subscription.plan
                  ? {
                      name: s.subscriptionShipment.subscription.plan.name,
                      contents: s.subscriptionShipment.subscription.plan.contents,
                    }
                  : null,
              }
            : null,
        }
      : null,
  };
}

export async function ShipmentsQueueBody({
  searchParams,
}: {
  searchParams?: { status?: string; type?: string; s?: string; q?: string; error?: string };
}) {
  const requestedStatus = searchParams?.status;
  const status =
    requestedStatus && SHIPMENT_STATUSES.includes(requestedStatus as never)
      ? requestedStatus
      : 'pending';
  const rawType = searchParams?.type;
  const q = (searchParams?.q ?? '').trim();
  const type =
    rawType === 'merchant_restock' || rawType === 'restock' ? 'consignment' : rawType;
  const selectedShipmentId = searchParams?.s;

  const baseWhere =
    status === 'pending'
      ? {
          status: { in: ['pending', 'packed'] },
          OR: [
            { orderId: null },
            { order: { status: { notIn: [...SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES] } } },
          ],
        }
      : status && SHIPMENT_STATUSES.includes(status as never)
        ? {
            status,
            OR: [
              { orderId: null },
              { order: { status: { notIn: [...SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES] } } },
            ],
          }
        : activeShipmentQueueWhere;

  const kindFilter = type && isShipmentKindKey(type) ? type : undefined;
  const where = mergeSearchWhere(
    mergeShipmentWhere(baseWhere as Prisma.ShipmentWhereInput, kindFilter) as Record<
      string,
      unknown
    >,
    shipmentSearchWhere(q),
  ) as Prisma.ShipmentWhereInput;
  const countWhere = mergeShipmentWhere(
    {
      status: { in: ['pending', 'packed', 'shipped', 'delivered', 'received'] },
      OR: [
        { orderId: null },
        { order: { status: { notIn: [...SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES] } } },
      ],
    },
    kindFilter,
  );

  const perfEnabled = isShipmentQueuePerfEnabled();
  const perf = createShipmentQueuePerf({
    enabled: perfEnabled,
    requestContext: perfEnabled
      ? readShipmentQueuePerfRequestContext(await headers())
      : undefined,
  });
  let perfCounts = emptyShipmentQueuePerfCounts();
  let rawShipments: ShipmentQueueRecord[];
  let countByStatus: Record<string, number>;
  let pendingCount: number;
  let panelRefreshKey: string;
  let queueRows: ShipmentQueueRow[];

  try {
    const [loadedShipments, counts] = await Promise.all([
      perf.measure('findMany', () =>
        loadShipmentQueuePage(where),
      ),
      perf.measure('counts', () => getShipmentQueueCounts(countWhere)),
    ]);
    rawShipments = loadedShipments;
    const shipments = dedupeShipmentsByOrder(rawShipments);
    countByStatus = counts.byStatus;
    pendingCount = counts.pendingCount;
    panelRefreshKey = shipments
      .map((s) => {
        const updated =
          s.updatedAt instanceof Date
            ? s.updatedAt.toISOString()
            : new Date(s.updatedAt as string | number).toISOString();
        return `${s.id}:${s.status}:${updated}`;
      })
      .join('|');

    const orderIds = shipments.map((s) => s.orderId);
    const storedOrderIds = [...new Set(orderIds.filter((id): id is string => Boolean(id)))];
    const productIds = [
      ...new Set(shipments.flatMap((shipment) => shipment.items.map((item) => item.productId))),
    ];
    const stockProductIds = [
      ...new Set(
        shipments
          .flatMap((shipment) =>
            shipment.items.flatMap((item) => [
              item.productId,
              item.product.inventorySourceProduct?.id,
            ]),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [jibaCharges, tiers, balances, orderSnapshots] = await Promise.all([
      perf.measure('jiba', () => loadJibaChargeSourcesByOrderIds(orderIds)),
      productIds.length > 0
        ? perf.measure('tiers', () =>
            prisma.productPriceTier.findMany({
              where: { productId: { in: productIds } },
              select: queueTierSelect,
            }),
          )
        : Promise.resolve([] as QueueTier[]),
      stockProductIds.length > 0
        ? perf.measure('balances', () =>
            prisma.inventoryBalance.findMany({
              where: {
                productId: { in: stockProductIds },
                warehouse: { code: 'WH-MAIN' },
              },
              select: queueBalanceSelect,
            }),
          )
        : Promise.resolve([] as QueueBalance[]),
      storedOrderIds.length > 0
        ? perf.measure('snapshots', () =>
            prisma.order.findMany({
              where: { id: { in: storedOrderIds } },
              select: queueOrderSnapshotSelect,
            }),
          )
        : Promise.resolve([] as QueueOrderSnapshot[]),
    ]);
    const enrichment = indexShipmentQueueEnrichment(tiers, balances);
    const snapshotByOrderId = new Map(
      orderSnapshots.map((order) => [order.id, order.shopifySnapshot]),
    );
    if (perf.enabled) {
      perfCounts = {
        shipmentCount: rawShipments.length,
        itemCount: rawShipments.reduce((total, shipment) => total + shipment.items.length, 0),
        priceTierCount: tiers.length,
        inventoryBalanceCount: balances.length,
        orderIdCount: orderIds.length,
      };
    }
    queueRows = perf.measureSync(() =>
      shipments.map((s) =>
        toQueueRow(
          s,
          resolveShipmentFulfillmentFee({
            orderStatus: s.order?.status,
            shippingFeeType: s.order?.shippingFeeType,
            jiba: s.orderId ? jibaCharges.get(s.orderId) ?? null : null,
          }),
          enrichment,
          s.orderId ? snapshotByOrderId.get(s.orderId) ?? null : null,
        ),
      ),
    );
  } catch (error) {
    perf.fail({ status, type: type ?? '', counts: perfCounts });
    throw error;
  }

  const workspaceSections = [
    {
      key: status,
      title: `${status === 'pending' ? '待出貨' : shipmentStatusLabel[status]} (${queueRows.length})`,
      description: '點選列表可查看訂單內容；運輸狀態可直接在列表更新。',
      tone: status === 'pending' ? ('operations' as const) : ('logistics' as const),
      tableVariant: type === 'subscription' ? ('subscription' as const) : ('default' as const),
      shipments: queueRows,
    },
  ];

  const truncated = rawShipments.length >= SHIPMENT_QUEUE_TAKE;

  perf.succeed({ status, type: type ?? '', counts: perfCounts });

  return (
    <>
      <nav aria-label="出貨階段" className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:min-w-0">
          {STAGE_TABS.map((stage) => {
            const params = new URLSearchParams({ status: stage.key });
            if (type) params.set('type', type);
            const count =
              stage.key === 'pending' ? pendingCount : (countByStatus[stage.key] ?? 0);
            const active = status === stage.key || (stage.key === 'pending' && status === 'packed');
            return (
              <Link
                key={stage.key}
                href={`/shipments?${params}`}
                prefetch
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors sm:min-w-28 sm:flex-none sm:text-sm',
                  active
                    ? 'bg-black text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span>{stage.label}</span>
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {truncated ? (
        <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          佇列僅載入最近 {SHIPMENT_QUEUE_TAKE} 筆以加速畫面。請用上方狀態／種類篩選查看其餘出貨單。
        </p>
      ) : null}

      <ShipmentQueueWorkspace
        sections={workspaceSections}
        statusFilter={status}
        typeFilter={type}
        panelRefreshKey={panelRefreshKey}
        initialShipmentId={selectedShipmentId}
      />
    </>
  );
}
