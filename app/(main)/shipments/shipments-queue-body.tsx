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
import {
  activeShipmentQueueWhere,
  dedupeShipmentsByOrder,
} from '@/lib/shipment-queue-filters';
import { getShipmentQueueCounts } from '@/lib/hot-path-reads';
import { SHIPMENT_QUEUE_TAKE } from '@/lib/list-pagination';
import { isShipmentKindKey, mergeShipmentWhere } from '@/lib/order-hub-kinds';
import { mergeSearchWhere, shipmentSearchWhere } from '@/lib/site-search';
import { resolveCampaignProductFallback } from '@/lib/shipment-queue-products';
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
      shippingMethod: true,
      cvsBrand: true,
      cvsStoreId: true,
      cvsStoreName: true,
      items: {
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          weightGrams: true,
          unit: true,
        },
      },
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
    description: '點列表或「查看」在右側開啟訂單內容；狀態變更請在抽屜內操作',
    tone: 'operations' as const,
  },
  {
    status: 'shipped',
    title: '在途',
    description: '已寄出 — 於右側抽屜標記「貨物到達」後訂單狀態會同步更新',
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

type CampaignProductMap = Map<
  string,
  {
    productName: string;
    quantity: number;
    unit: string | null;
    sku: string | null;
  }
>;

function toQueueRow(
  s: Awaited<ReturnType<typeof prisma.shipment.findMany<{ include: typeof shipmentInclude }>>>[number],
  campaignByOrderId: CampaignProductMap = new Map(),
): ShipmentQueueRow {
  const shipmentItems = s.items.map((item) => ({
    id: item.id,
    productName: item.productName,
    weightGrams: item.weightGrams,
    quantity: item.quantity,
    sku: item.sku,
    unit: item.unit,
  }));

  // 出貨品項為空時，用訂單品項（含零價／贈品）填列表摘要；仍無則走活動 fallback
  const orderFallbackItems =
    shipmentItems.length === 0 && s.order?.items?.length
      ? s.order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          weightGrams: item.weightGrams,
          quantity: item.quantity,
          sku: item.sku,
          unit: item.unit,
        }))
      : [];

  const displayItems = shipmentItems.length > 0 ? shipmentItems : orderFallbackItems;
  const campaignProduct =
    displayItems.length === 0 && s.orderId
      ? (campaignByOrderId.get(s.orderId) ?? null)
      : null;

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
          shippingMethod: s.order.shippingMethod,
          cvsBrand: s.order.cvsBrand,
          cvsStoreId: s.order.cvsStoreId,
          cvsStoreName: s.order.cvsStoreName,
        }
      : null,
    items: displayItems,
    campaignProduct,
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

async function loadCampaignProductsByOrderIds(orderIds: string[]): Promise<CampaignProductMap> {
  const map: CampaignProductMap = new Map();
  if (orderIds.length === 0) return map;

  const applications = await prisma.campaignApplication.findMany({
    where: { orderId: { in: orderIds } },
    select: {
      orderId: true,
      campaign: { select: { productName: true, productQuantity: true } },
      conversationSession: { select: { collectedDataJson: true } },
    },
  });

  for (const app of applications) {
    if (!app.orderId) continue;
    const product = resolveCampaignProductFallback({
      collectedDataJson: app.conversationSession?.collectedDataJson,
      campaignProductName: app.campaign.productName,
      campaignProductQuantity: app.campaign.productQuantity,
    });
    if (product) map.set(app.orderId, product);
  }

  return map;
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
          OR: [{ orderId: null }, { order: { status: { not: 'cancelled' } } }],
        }
      : status && SHIPMENT_STATUSES.includes(status as never)
        ? {
            status,
            OR: [{ orderId: null }, { order: { status: { not: 'cancelled' } } }],
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
      OR: [{ orderId: null }, { order: { status: { not: 'cancelled' } } }],
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
  const emptyItemOrderIds = [
    ...new Set(
      shipments
        .filter((s) => s.items.length === 0 && s.orderId)
        .map((s) => s.orderId as string),
    ),
  ];
  // 僅在出貨品項與訂單品項皆可能為空時查活動；避免列表捏造、也避免多餘查詢
  const needCampaignLookup = emptyItemOrderIds.filter((orderId) => {
    const row = shipments.find((s) => s.orderId === orderId);
    return !row?.order?.items?.length;
  });
  const campaignByOrderId = await loadCampaignProductsByOrderIds(needCampaignLookup);

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

  const queueRows = shipments.map((s) => toQueueRow(s, campaignByOrderId));

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
          description: '點列表或「查看」在右側開啟訂單內容；狀態變更請在抽屜內操作',
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
