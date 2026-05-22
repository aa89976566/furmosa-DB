import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import { Button } from '@/components/ui/button';
import { ArrowLeft, History } from 'lucide-react';

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

export default async function ShipmentHistoryPage({
  searchParams,
}: {
  searchParams?: { type?: string; s?: string };
}) {
  const type = searchParams?.type;
  const selectedShipmentId = searchParams?.s;

  const where: Record<string, unknown> = {
    status: { in: ['shipped', 'delivered'] },
  };
  if (type === 'subscription') where.type = 'subscription';
  if (type === 'order') where.type = 'customer_order';

  const [shipments, subCount, orderCount] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: [{ shippedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    prisma.shipment.count({
      where: { status: { in: ['shipped', 'delivered'] }, type: 'subscription' },
    }),
    prisma.shipment.count({
      where: { status: { in: ['shipped', 'delivered'] }, type: 'customer_order' },
    }),
  ]);

  const panelRefreshKey = shipments
    .map((s) => `${s.id}:${s.status}:${s.updatedAt.toISOString()}`)
    .join('|');

  const subscriptionRows = shipments.filter((s) => s.type === 'subscription');
  const orderRows = shipments.filter((s) => s.type === 'customer_order');

  const showAll = !type;
  const sections = [
    ...(showAll || type === 'subscription'
      ? [
          {
            key: 'subscription-history',
            title: `訂閱出貨歷史 (${subscriptionRows.length})`,
            description: '已寄出或已送達的訂閱包',
            tone: 'subscription' as const,
            tableVariant: 'subscription' as const,
            shipments: subscriptionRows,
          },
        ]
      : []),
    ...(showAll || type === 'order'
      ? [
          {
            key: 'order-history',
            title: `一般訂單出貨歷史 (${orderRows.length})`,
            description: '已寄出或已送達的客戶訂單',
            tone: 'logistics' as const,
            tableVariant: 'default' as const,
            shipments: orderRows,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        tone="logistics"
        title="出貨歷史"
        description="已寄出／已送達的出貨單 — 從出貨隊列標記「已寄出」後會自動移入此處"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/shipments">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回出貨隊列
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6">
        <div className="flex flex-wrap gap-2">
          <FilterLink href="/shipments/history" label="全部" count={subCount + orderCount} active={!type} />
          <FilterLink
            href="/shipments/history?type=subscription"
            label="訂閱"
            count={subCount}
            active={type === 'subscription'}
          />
          <FilterLink
            href="/shipments/history?type=order"
            label="一般訂單"
            count={orderCount}
            active={type === 'order'}
          />
        </div>

        {shipments.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
            <History className="mx-auto mb-3 h-8 w-8 opacity-40" />
            尚無歷史出貨紀錄
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                載入歷史出貨…
              </div>
            }
          >
            <ShipmentQueueWorkspace
              sections={sections}
              statusFilter="shipped"
              panelRefreshKey={panelRefreshKey}
              initialShipmentId={selectedShipmentId}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}

function FilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-4 py-3 transition hover:bg-muted/40 ${
        active ? 'border-primary ring-2 ring-primary/30' : 'bg-card'
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{count}</div>
    </Link>
  );
}
