import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import { Button } from '@/components/ui/button';
import {
  isPreShipStatus,
  shipmentStatusLabel,
  shipmentStatusVariant,
  SHIPMENT_STATUSES,
} from '@/lib/shipment';
import { syncUpcomingSubscriptionShipments } from '@/lib/subscription-shipment-sync';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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
  customer: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      shippingMethod: true,
      cvsBrand: true,
      cvsStoreId: true,
      cvsStoreName: true,
    },
  },
  items: true,
  subscriptionShipment: {
    include: {
      subscription: { include: { plan: true } },
    },
  },
} as const;

const QUEUE_SECTIONS = [
  {
    status: 'pending',
    title: '待出貨',
    description: '點列表在下方開啟訂單內容，下拉可標記已寄出',
    tone: 'operations' as const,
  },
  {
    status: 'shipped',
    title: '在途',
    description: '已寄出 — 下拉選「貨物到達」後訂單出貨狀態會同步更新（留在本頁）',
    tone: 'logistics' as const,
  },
];

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams?: { status?: string; type?: string; s?: string };
}) {
  const status = searchParams?.status;
  const type = searchParams?.type;
  const selectedShipmentId = searchParams?.s;

  await syncUpcomingSubscriptionShipments();

  const where: Record<string, unknown> = {};
  if (status && SHIPMENT_STATUSES.includes(status as never)) where.status = status;
  if (type) where.type = type;

  const [shipments, counts] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.shipment.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const grouped = !status;
  const panelRefreshKey = shipments
    .map((s) => `${s.id}:${s.status}:${s.updatedAt.toISOString()}`)
    .join('|');

  // 訂閱近期安排：只顯示尚未寄出
  const subscriptionRows = shipments
    .filter((s) => s.type === 'subscription' && (s.status === 'pending' || s.status === 'packed'))
    .sort((a, b) => {
      const aDate = new Date(a.subscriptionShipment?.scheduledDate ?? a.createdAt).getTime();
      const bDate = new Date(b.subscriptionShipment?.scheduledDate ?? b.createdAt).getTime();
      return aDate - bDate;
    });
  const operationalRows = shipments.filter((s) => s.type !== 'subscription');

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
  const otherOperationalSections = operationalSections.filter((section) => section.key !== 'pending');

  const workspaceSections = grouped
    ? [
        ...(pendingSection ? [pendingSection] : []),
        {
          key: 'subscription',
          title: `訂閱近期安排 (${subscriptionRows.length})`,
          description: '僅顯示未寄出；標記「已寄出」後會移至出貨歷史',
          tone: 'subscription' as const,
          tableVariant: 'subscription' as const,
          shipments: subscriptionRows,
        },
        ...otherOperationalSections,
      ]
    : [
        {
          key: status!,
          title: `${shipmentStatusLabel[status!]} (${shipments.length})`,
          description: '點列表任一筆，在下方開啟訂單內容；運輸狀態可直接在列表修改',
          tone: 'logistics' as const,
          tableVariant: 'default' as const,
          shipments,
        },
      ];

  return (
    <>
      <PageHeader
        tone="logistics"
        title="出貨隊列"
        description="物流工作台 — 點列表任一筆，在下方開啟訂單內容（品項、運輸、物流狀態）"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/history">
                出貨歷史 ({(countByStatus.shipped ?? 0) + (countByStatus.delivered ?? 0)})
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory/transactions">
                <Package className="mr-1 h-4 w-4" />
                庫存異動
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              label={shipmentStatusLabel[s]}
              count={countByStatus[s] ?? 0}
              total={total}
              active={status === s}
              variant={shipmentStatusVariant[s]}
            />
          ))}
        </div>

        <Suspense
          fallback={
            <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
              載入出貨工作台…
            </div>
          }
        >
          <ShipmentQueueWorkspace
            sections={workspaceSections}
            statusFilter={status}
            panelRefreshKey={panelRefreshKey}
            initialShipmentId={selectedShipmentId}
          />
        </Suspense>
      </div>
    </>
  );
}

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
