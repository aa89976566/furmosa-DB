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
import type { Prisma } from '@prisma/client';
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

const queueCustomerSelect = { id: true, name: true } as const;
const queueOrderSelect = {
  id: true,
  orderNumber: true,
  source: true,
  externalOrderName: true,
  status: true,
  paymentStatus: true,
  shippingFeeType: true,
  shippingMethod: true,
  cvsBrand: true,
  cvsStoreId: true,
  cvsStoreName: true,
  note: true,
  omsStatus: true,
  merchantOrderMode: true,
} as const;
const queueItemSelect = {
  shipmentId: true,
  productId: true,
  productName: true,
  quantity: true,
  weightGrams: true,
  variantKey: true,
  notes: true,
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      unit: true,
      productCategory: true,
      inventorySourceProduct: {
        select: { id: true, sku: true, name: true, status: true, unit: true },
      },
    },
  },
} as const;
const queueSubscriptionShipmentSelect = {
  id: true,
  shipmentNo: true,
  scheduledDate: true,
  subscription: {
    select: {
      subscriptionNo: true,
      plan: { select: { name: true, contents: true } },
    },
  },
} as const;

type ShipmentQueueBase = Awaited<
  ReturnType<typeof prisma.shipment.findMany<{ select: typeof shipmentBaseSelect }>>
>[number];
type QueueMerchant = Awaited<
  ReturnType<typeof prisma.merchant.findMany<{ select: typeof merchantLogisticsSelect }>>
>[number];
type QueueCustomer = Awaited<
  ReturnType<typeof prisma.customer.findMany<{ select: typeof queueCustomerSelect }>>
>[number];
type QueueOrder = Awaited<
  ReturnType<typeof prisma.order.findMany<{ select: typeof queueOrderSelect }>>
>[number];
type QueueItemWithShipment = Awaited<
  ReturnType<typeof prisma.shipmentItem.findMany<{ select: typeof queueItemSelect }>>
>[number];
type QueueSubscriptionShipment = Awaited<
  ReturnType<
    typeof prisma.subscriptionShipment.findMany<{
      select: typeof queueSubscriptionShipmentSelect;
    }>
  >
>[number];
type ShipmentQueueRecord = ShipmentQueueBase & {
  merchant: QueueMerchant | null;
  customer: QueueCustomer | null;
  order: QueueOrder | null;
  items: Array<Omit<QueueItemWithShipment, 'shipmentId'>>;
  subscriptionShipment: Omit<QueueSubscriptionShipment, 'id'> | null;
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
  const merchantIds = [...new Set(shipments.flatMap((s) => (s.merchantId ? [s.merchantId] : [])))];
  const customerIds = [...new Set(shipments.flatMap((s) => (s.customerId ? [s.customerId] : [])))];
  const orderIds = [...new Set(shipments.flatMap((s) => (s.orderId ? [s.orderId] : [])))];
  const subscriptionShipmentIds = [
    ...new Set(
      shipments.flatMap((s) =>
        s.subscriptionShipmentId ? [s.subscriptionShipmentId] : [],
      ),
    ),
  ];

  const [merchants, customers, orders, items, subscriptionShipments] = await Promise.all([
    merchantIds.length
      ? prisma.merchant.findMany({
          where: { id: { in: merchantIds } },
          select: merchantLogisticsSelect,
        })
      : Promise.resolve([] as QueueMerchant[]),
    customerIds.length
      ? prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: queueCustomerSelect,
        })
      : Promise.resolve([] as QueueCustomer[]),
    orderIds.length
      ? prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: queueOrderSelect,
        })
      : Promise.resolve([] as QueueOrder[]),
    prisma.shipmentItem.findMany({
      where: { shipmentId: { in: shipmentIds } },
      select: queueItemSelect,
    }),
    subscriptionShipmentIds.length
      ? prisma.subscriptionShipment.findMany({
          where: { id: { in: subscriptionShipmentIds } },
          select: queueSubscriptionShipmentSelect,
        })
      : Promise.resolve([] as QueueSubscriptionShipment[]),
  ]);

  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const subscriptionShipmentById = new Map(
    subscriptionShipments.map(({ id, ...shipment }) => [id, shipment]),
  );
  const itemsByShipmentId = new Map<
    string,
    Array<Omit<QueueItemWithShipment, 'shipmentId'>>
  >();
  for (const { shipmentId, ...item } of items) {
    const shipmentItems = itemsByShipmentId.get(shipmentId) ?? [];
    shipmentItems.push(item);
    itemsByShipmentId.set(shipmentId, shipmentItems);
  }

  return shipments.map((shipment) => ({
    ...shipment,
    merchant: shipment.merchantId ? merchantById.get(shipment.merchantId) ?? null : null,
    customer: shipment.customerId ? customerById.get(shipment.customerId) ?? null : null,
    order: shipment.orderId ? orderById.get(shipment.orderId) ?? null : null,
    items: itemsByShipmentId.get(shipment.id) ?? [],
    subscriptionShipment: shipment.subscriptionShipmentId
      ? subscriptionShipmentById.get(shipment.subscriptionShipmentId) ?? null
      : null,
  }));
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
