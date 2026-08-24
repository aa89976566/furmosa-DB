import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import type { ShipmentQueueRow } from '@/components/shipments/shipment-queue-table';
import {
  isPreShipStatus,
  shipmentStatusLabel,
  shipmentStatusVariant,
  SHIPMENT_STATUSES,
} from '@/lib/shipment';
import { SHIPMENT_QUEUE_HIDDEN_ORDER_STATUSES } from '@/lib/campaigns/jiba-two-piece/payment';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import { replaceJibaLegacyCatnipName } from '@/lib/campaigns/jiba-two-piece/constants';
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
      unit: true,
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

const QUEUE_SECTIONS = [
  {
    status: 'pending',
    title: '待出貨',
    description: '點列表在下方開啟訂單內容，點選運輸狀態按鈕可標記已寄出',
    tone: 'operations' as const,
  },
  {
    status: 'shipped',
    title: '在途',
    description: '已寄出 — 點選「貨物到達」後訂單出貨狀態會同步更新（留在本頁）',
    tone: 'logistics' as const,
  },
];

type ChipVariant = 'all' | 'warning' | 'info' | 'success' | 'destructive' | 'secondary';

const CHIP_TONES: Record<
  ChipVariant,
  { dot: string; bar: string; accent: string; ring: string; tint: string }
> = {
  all: {
    dot: 'bg-primary',
    bar: 'bg-primary',
    accent: 'text-primary',
    ring: 'ring-primary/30 border-primary/50',
    tint: 'bg-primary/[0.04]',
  },
  warning: {
    dot: 'bg-warning',
    bar: 'bg-warning',
    accent: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-warning/30 border-warning/50',
    tint: 'bg-warning/[0.05]',
  },
  info: {
    dot: 'bg-info',
    bar: 'bg-info',
    accent: 'text-info',
    ring: 'ring-info/30 border-info/50',
    tint: 'bg-info/[0.05]',
  },
  success: {
    dot: 'bg-success',
    bar: 'bg-success',
    accent: 'text-success',
    ring: 'ring-success/30 border-success/50',
    tint: 'bg-success/[0.05]',
  },
  destructive: {
    dot: 'bg-destructive',
    bar: 'bg-destructive',
    accent: 'text-destructive',
    ring: 'ring-destructive/30 border-destructive/50',
    tint: 'bg-destructive/[0.05]',
  },
  secondary: {
    dot: 'bg-muted-foreground',
    bar: 'bg-muted-foreground',
    accent: 'text-muted-foreground',
    ring: 'ring-border border-border',
    tint: 'bg-muted/30',
  },
};

function FilterChip({
  href,
  label,
  count,
  total,
  active,
  variant = 'secondary',
}: {
  href: string;
  label: string;
  count: number;
  total: number;
  active?: boolean;
  variant?: ChipVariant;
}) {
  const tone = CHIP_TONES[variant];
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        active ? cn('ring-2', tone.ring, tone.tint) : 'border-border/70 hover:border-border',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-opacity',
          tone.bar,
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={cn('inline-block h-2 w-2 rounded-full', tone.dot)} />
          {label}
        </div>
        {variant !== 'all' ? (
          <span className={cn('text-[11px] font-semibold tabular-nums', tone.accent)}>
            {share}%
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-navy">
          {count}
        </span>
        <span className="text-xs text-muted-foreground">張</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full transition-all duration-500', tone.bar)}
          style={{ width: `${variant === 'all' ? 100 : share}%` }}
        />
      </div>
    </Link>
  );
}

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
    recipientName: s.recipientName,
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
          source: s.order.source,
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
    items: s.items.map((item) => ({
      productName: replaceJibaLegacyCatnipName(item.productName),
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
  const status = searchParams?.status;
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
      status: { in: ['pending', 'packed', 'shipped', 'delivered'] },
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
  const { byStatus: countByStatus, pendingCount, total } = counts;
  const grouped = !status;
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

  const subscriptionRows = queueRows
    .filter((s) => s.type === 'subscription' && (s.status === 'pending' || s.status === 'packed'))
    .sort((a, b) => {
      const aDate = new Date(a.subscriptionShipment?.scheduledDate ?? a.createdAt).getTime();
      const bDate = new Date(b.subscriptionShipment?.scheduledDate ?? b.createdAt).getTime();
      return aDate - bDate;
    });
  const operationalRows = queueRows.filter((s) => s.type !== 'subscription');

  const operationalSections = QUEUE_SECTIONS.map((section) => {
    const rows = operationalRows.filter((s) =>
      section.status === 'pending' ? isPreShipStatus(s.status) : s.status === section.status,
    );
    return {
      key: section.status,
      title: `${section.title} (${rows.length})`,
      description: section.description,
      tone: section.tone,
      tableVariant: 'default' as const,
      shipments: rows,
    };
  });
  const pendingSection = operationalSections.find((section) => section.key === 'pending');
  const otherOperationalSections = operationalSections.filter(
    (section) => section.key !== 'pending',
  );

  const workspaceSections = grouped
    ? [
        ...(pendingSection ? [pendingSection] : []),
        {
          key: 'subscription',
          title: `訂閱近期安排 (${subscriptionRows.length})`,
          description: '僅顯示未寄出；標記「已寄出」後會移至「在途」',
          tone: 'subscription' as const,
          tableVariant: 'subscription' as const,
          shipments: subscriptionRows,
        },
        ...otherOperationalSections,
      ]
    : [
        {
          key: status!,
          title: `${shipmentStatusLabel[status!]} (${queueRows.length})`,
          description: '點列表任一筆，在下方開啟訂單內容；運輸狀態可直接在列表修改',
          tone: 'logistics' as const,
          tableVariant: 'default' as const,
          shipments: queueRows,
        },
      ];

  const truncated = rawShipments.length >= SHIPMENT_QUEUE_TAKE;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <FilterChip
          href="/shipments"
          label="全部"
          count={total}
          total={total}
          active={!status}
          variant="all"
        />
        {(['pending', 'shipped', 'delivered'] as const).map((s) => (
          <FilterChip
            key={s}
            href={`/shipments?status=${s}`}
            label={s === 'pending' ? '待出貨' : shipmentStatusLabel[s]}
            count={
              s === 'pending'
                ? pendingCount
                : s === 'delivered'
                  ? (countByStatus.delivered ?? 0)
                  : (countByStatus[s] ?? 0)
            }
            total={total}
            active={status === s || (s === 'pending' && status === 'packed')}
            variant={shipmentStatusVariant[s === 'pending' ? 'pending' : s]}
          />
        ))}
      </div>

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
