import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import {
  shipmentStatusLabel,
  SHIPMENT_STATUSES,
} from '@/lib/shipment';
import { SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES } from '@/lib/campaigns/jiba-two-piece/payment';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
  type JibaChargeSource,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import {
  activeShipmentQueueWhere,
  dedupeShipmentsByOrder,
} from '@/lib/shipment-queue-filters';
import { assembleShipmentQueueRow, isoDate } from '@/lib/shipment-queue-rows';
import { getShipmentQueueCounts } from '@/lib/hot-path-reads';
import { SHIPMENT_QUEUE_TAKE } from '@/lib/list-pagination';
import { isShipmentKindKey, mergeShipmentWhere } from '@/lib/order-hub-kinds';
import { mergeSearchWhere, shipmentSearchWhere } from '@/lib/site-search';
import type { Prisma } from '@prisma/client';
import { cn } from '@/lib/utils';
import { shipmentInventoryAdvisories } from '@/lib/inventory/shipment-advisory';
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

const shipmentSelect = {
  id: true,
  shipmentNumber: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  merchantId: true,
  customerId: true,
  orderId: true,
  subscriptionShipmentId: true,
  recipientName: true,
  recipientPhone: true,
  recipientAddress: true,
  carrier: true,
  trackingNumber: true,
} as const;

const orderSelect = {
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
  omsStatus: true,
  shopifySnapshot: true,
} as const;

const STAGE_TABS = [
  { key: 'pending', label: '待出貨' },
  { key: 'shipped', label: '運送中' },
  { key: 'delivered', label: '待驗收' },
  { key: 'received', label: '已完成' },
] as const;

const emptyCounts = { byStatus: {} as Record<string, number>, pendingCount: 0, total: 0 };

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
            { order: { is: null } },
            { order: { status: { notIn: [...SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES] } } },
          ],
        }
      : status && SHIPMENT_STATUSES.includes(status as never)
        ? {
            status,
            OR: [
              { orderId: null },
              { order: { is: null } },
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
        { order: { is: null } },
        { order: { status: { notIn: [...SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES] } } },
      ],
    },
    kindFilter,
  );

  let loadError: string | null = null;
  let rawShipments: Array<Prisma.ShipmentGetPayload<{ select: typeof shipmentSelect }>> = [];
  let counts = emptyCounts;
  try {
    const [listed, queueCounts] = await Promise.all([
      prisma.shipment.findMany({
        where,
        select: shipmentSelect,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: SHIPMENT_QUEUE_TAKE,
      }),
      getShipmentQueueCounts(countWhere).catch((error: unknown) => {
        console.error('[shipments-queue] counts skipped', error);
        return emptyCounts;
      }),
    ]);
    rawShipments = listed;
    counts = queueCounts;
  } catch (error) {
    console.error('[shipments-queue] list query failed', error);
    loadError = '出貨清單暫時無法載入。請再試一次。';
  }

  const shipmentIds = rawShipments.map((shipment) => shipment.id);
  let itemRows: Array<{
    shipmentId: string;
    productId: string;
    productName: string;
    quantity: number;
    weightGrams: number | null;
    variantKey: string | null;
    unit: string | null;
  }> = [];
  let itemsUnavailable = false;
  if (shipmentIds.length) {
    try {
      itemRows = await prisma.shipmentItem.findMany({
        where: { shipmentId: { in: shipmentIds } },
        select: {
          shipmentId: true,
          productId: true,
          productName: true,
          quantity: true,
          weightGrams: true,
          variantKey: true,
          unit: true,
        },
      });
    } catch (error) {
      console.error('[shipments-queue] item lookup retry', error);
      try {
        const basicItems = await prisma.shipmentItem.findMany({
          where: { shipmentId: { in: shipmentIds } },
          select: {
            shipmentId: true,
            productId: true,
            productName: true,
            quantity: true,
            weightGrams: true,
          },
        });
        itemRows = basicItems.map((item) => ({ ...item, variantKey: null, unit: null }));
      } catch (retryError) {
        console.error('[shipments-queue] item lookup skipped', retryError);
        itemsUnavailable = true;
      }
    }
  }
  const itemsByShipment = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByShipment.get(item.shipmentId) ?? [];
    list.push(item);
    itemsByShipment.set(item.shipmentId, list);
  }

  const shipments = dedupeShipmentsByOrder(
    rawShipments.map((shipment) => ({
      ...shipment,
      items: itemsByShipment.get(shipment.id) ?? [],
    })),
  );
  const { byStatus: countByStatus, pendingCount } = counts;
  const panelRefreshKey = shipments
    .map((s) => `${s.id}:${s.status}:${isoDate(s.updatedAt) ?? ''}`)
    .join('|');

  const orderIds = [...new Set(shipments.map((s) => s.orderId).filter((id): id is string => Boolean(id)))];
  const merchantIds = [...new Set(shipments.map((s) => s.merchantId).filter((id): id is string => Boolean(id)))];
  const customerIds = [...new Set(shipments.map((s) => s.customerId).filter((id): id is string => Boolean(id)))];
  const subscriptionShipmentIds = [
    ...new Set(shipments.map((s) => s.subscriptionShipmentId).filter((id): id is string => Boolean(id))),
  ];

  let orders: Array<Prisma.OrderGetPayload<{ select: typeof orderSelect }>> = [];
  if (orderIds.length) {
    try {
      orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: orderSelect });
    } catch (error) {
      console.error('[shipments-queue] order lookup retry', error);
      try {
        const basicOrders = await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
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
          },
        });
        orders = basicOrders.map((order) => ({ ...order, omsStatus: null, shopifySnapshot: null }));
      } catch (retryError) {
        console.error('[shipments-queue] order lookup skipped', retryError);
      }
    }
  }
  const orderById = new Map(orders.map((order) => [order.id, order]));

  let merchants: Array<Prisma.MerchantGetPayload<{ select: typeof merchantLogisticsSelect }>> = [];
  if (merchantIds.length) {
    try {
      merchants = await prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: merchantLogisticsSelect,
      });
    } catch (error) {
      console.error('[shipments-queue] merchant lookup skipped', error);
    }
  }
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));

  let customers: Array<{ id: string; name: string }> = [];
  if (customerIds.length) {
    try {
      customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      });
    } catch (error) {
      console.error('[shipments-queue] customer lookup skipped', error);
    }
  }
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  let subscriptionShipments: Array<{
    id: string;
    shipmentNo: string;
    scheduledDate: Date;
    subscriptionId: string;
  }> = [];
  if (subscriptionShipmentIds.length) {
    try {
      subscriptionShipments = await prisma.subscriptionShipment.findMany({
        where: { id: { in: subscriptionShipmentIds } },
        select: { id: true, shipmentNo: true, scheduledDate: true, subscriptionId: true },
      });
    } catch (error) {
      console.error('[shipments-queue] subscription shipment lookup skipped', error);
    }
  }
  const subscriptionShipmentById = new Map(subscriptionShipments.map((row) => [row.id, row]));

  const productIds = [
    ...new Set(shipments.flatMap((s) => s.items.map((item) => item.productId)).filter(Boolean)),
  ];
  let productLookupFailed = false;
  let products: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: string | null;
    priceTiers: Array<{ id: string; weightGrams: number | null; unit: string; unitQty: number }>;
    inventoryBalances: Array<{ quantity: number; unit: string | null; lastCountedAt: Date | null }>;
  }> = [];
  if (productIds.length) {
    try {
      products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          unit: true,
          priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true } },
          inventoryBalances: {
            where: { warehouse: { code: 'WH-MAIN' } },
            select: { quantity: true, unit: true, lastCountedAt: true },
            take: 1,
          },
        },
      });
    } catch (error) {
      productLookupFailed = true;
      console.error('[shipments-queue] product lookup skipped', error);
    }
  }
  const productById = new Map(products.map((product) => [product.id, product]));

  const subscriptionIds = [
    ...new Set(subscriptionShipments.map((row) => row.subscriptionId).filter(Boolean)),
  ];
  const subscriptionById = new Map<
    string,
    { subscriptionNo: string; plan: { name: string; contents: string | null } | null }
  >();
  if (subscriptionIds.length) {
    try {
      const subscriptions = await prisma.subscription.findMany({
        where: { id: { in: subscriptionIds } },
        select: { id: true, subscriptionNo: true, planId: true },
      });
      const planIds = [...new Set(subscriptions.map((row) => row.planId))];
      const plans = planIds.length
        ? await prisma.subscriptionPlan.findMany({
            where: { id: { in: planIds } },
            select: { id: true, name: true, contents: true },
          })
        : [];
      const planById = new Map(plans.map((plan) => [plan.id, plan]));
      for (const row of subscriptions) {
        const plan = planById.get(row.planId);
        subscriptionById.set(row.id, {
          subscriptionNo: row.subscriptionNo,
          plan: plan ? { name: plan.name, contents: plan.contents } : null,
        });
      }
    } catch (error) {
      console.error('[shipments-queue] subscription lookup skipped', error);
    }
  }

  let jibaCharges = new Map<string, JibaChargeSource>();
  try {
    jibaCharges = await loadJibaChargeSourcesByOrderIds(shipments.map((s) => s.orderId));
  } catch (error) {
    console.error('[shipments-queue] charge lookup skipped', error);
  }
  const queueRows = shipments.map((s) => {
    const order = s.orderId ? orderById.get(s.orderId) ?? null : null;
    const subscriptionShipment = s.subscriptionShipmentId
      ? subscriptionShipmentById.get(s.subscriptionShipmentId) ?? null
      : null;
    const subscription = subscriptionShipment
      ? subscriptionById.get(subscriptionShipment.subscriptionId) ?? null
      : null;
    return assembleShipmentQueueRow(
      {
        ...s,
        itemsUnavailable,
        merchant: s.merchantId ? merchantById.get(s.merchantId) ?? null : null,
        customer: s.customerId ? customerById.get(s.customerId) ?? null : null,
        order,
        items: s.items.map((item) => ({
          ...item,
          productFound: productLookupFailed ? undefined : productById.has(item.productId),
        })),
        subscriptionShipment: subscriptionShipment
          ? {
              shipmentNo: subscriptionShipment.shipmentNo,
              scheduledDate: subscriptionShipment.scheduledDate,
              subscription,
            }
          : null,
      },
      resolveShipmentFulfillmentFee({
        orderStatus: order?.status,
        shippingFeeType: order?.shippingFeeType,
        jiba: s.orderId ? jibaCharges.get(s.orderId) ?? null : null,
      }),
      shipmentInventoryAdvisories(
        s.items.map((item) => ({
          ...item,
          product: productById.get(item.productId) ?? null,
        })),
      ),
    );
  });

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

      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

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
