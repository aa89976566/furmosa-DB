import Link from 'next/link';
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
import { isShipmentKindKey, mergeShipmentWhere } from '@/lib/order-hub-kinds';
import { mergeSearchWhere, shipmentSearchWhere } from '@/lib/site-search';
import type { Prisma } from '@prisma/client';
import { cn } from '@/lib/utils';
import { shipmentInventoryAdvisories } from '@/lib/inventory/shipment-advisory';
import { normalizeStoredShopifyRecipient } from '@/lib/shopify/recipient-name';

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

const shipmentInclude = {
  merchant: { select: merchantLogisticsSelect },
  customer: {
    select: {
      id: true,
      name: true,
      customerId: true,
      phone: true,
      address: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      source: true,
      status: true,
      paymentStatus: true,
      shippingFeeType: true,
      shippingMethod: true,
      cvsBrand: true,
      cvsStoreId: true,
      cvsStoreName: true,
      omsStatus: true,
      shopifySnapshot: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      sku: true,
      quantity: true,
      weightGrams: true,
      variantKey: true,
      unit: true,
      product: {
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
      },
    },
  },
  subscriptionShipment: {
    select: {
      id: true,
      shipmentNo: true,
      scheduledDate: true,
      status: true,
      subscription: {
        select: {
          id: true,
          subscriptionNo: true,
          plan: { select: { id: true, name: true, contents: true } },
        },
      },
    },
  },
} as const;

const STAGE_TABS = [
  { key: 'pending', label: '待出貨' },
  { key: 'shipped', label: '運送中' },
  { key: 'delivered', label: '待驗收' },
  { key: 'received', label: '已完成' },
] as const;

function toQueueRow(
  s: Awaited<ReturnType<typeof prisma.shipment.findMany<{ include: typeof shipmentInclude }>>>[number],
  fee: ReturnType<typeof resolveShipmentFulfillmentFee>,
): ShipmentQueueRow {
  return {
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    type: s.type,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    recipientName: s.order?.omsStatus
      ? normalizeStoredShopifyRecipient(s.recipientName, s.order.shopifySnapshot)
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
          omsStatus: s.order.omsStatus,
          status: s.order.status,
          paymentStatus: s.order.paymentStatus,
          shippingFeeType: s.order.shippingFeeType,
          shippingMethod: s.order.shippingMethod,
          cvsBrand: s.order.cvsBrand,
          cvsStoreId: s.order.cvsStoreId,
          cvsStoreName: s.order.cvsStoreName,
        }
      : null,
    fulfillmentFeeLabel: fee.fulfillmentFeeLabel,
    paymentReviewHold: fee.paymentReviewHold,
    inventoryWarnings: shipmentInventoryAdvisories(s.items),
    items: s.items.map((item) => ({
      productName: canonicalProductName(item.productName),
      weightGrams: item.weightGrams,
      quantity: item.quantity,
    })),
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

  const [rawShipments, counts] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: SHIPMENT_QUEUE_TAKE,
    }),
    getShipmentQueueCounts(countWhere),
  ]);

  const shipments = dedupeShipmentsByOrder(rawShipments);
  const { byStatus: countByStatus, pendingCount } = counts;
  const panelRefreshKey = shipments
    .map((s) => {
      const updated =
        s.updatedAt instanceof Date
          ? s.updatedAt.toISOString()
          : new Date(s.updatedAt as string | number).toISOString();
      return `${s.id}:${s.status}:${updated}`;
    })
    .join('|');

  const jibaCharges = await loadJibaChargeSourcesByOrderIds(shipments.map((s) => s.orderId));
  const queueRows = shipments.map((s) =>
    toQueueRow(
      s,
      resolveShipmentFulfillmentFee({
        orderStatus: s.order?.status,
        shippingFeeType: s.order?.shippingFeeType,
        jiba: s.orderId ? jibaCharges.get(s.orderId) ?? null : null,
      }),
    ),
  );

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
