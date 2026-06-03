import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ShipmentQueueWorkspace } from '@/components/shipments/shipment-queue-workspace';
import { Button } from '@/components/ui/button';
import {
  countHistoryShipments,
  historyShipmentWhere,
} from '@/lib/order-hub-kinds';
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
      source: true,
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
  const rawType = searchParams?.type;
  const type =
    rawType === 'restock' || rawType === 'merchant_restock' ? 'consignment' : rawType;
  const selectedShipmentId = searchParams?.s;

  const where = historyShipmentWhere(type);

  const [shipments, subCount, orderCount, consignmentCount] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: [{ shippedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    countHistoryShipments('subscription'),
    countHistoryShipments('customer_order'),
    countHistoryShipments('consignment'),
  ]);

  const panelRefreshKey = shipments
    .map((s) => `${s.id}:${s.status}:${s.updatedAt.toISOString()}`)
    .join('|');

  const subscriptionRows = shipments.filter((s) => s.type === 'subscription');
  const orderRows = shipments.filter(
    (s) =>
      s.type === 'customer_order' &&
      (!s.order || s.order.source !== 'consignment'),
  );
  const consignmentRows = shipments.filter(
    (s) =>
      s.type === 'merchant_restock' ||
      (s.type === 'customer_order' && s.order?.source === 'consignment'),
  );

  const showAll = !type;
  const sections = [
    ...(showAll || type === 'subscription'
      ? [
          {
            key: 'subscription-history',
            title: `訂閱 (${subscriptionRows.length})`,
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
            title: `客戶訂單 (${orderRows.length})`,
            description: '官網、LINE、手動等非寄賣成交',
            tone: 'logistics' as const,
            tableVariant: 'default' as const,
            shipments: orderRows,
          },
        ]
      : []),
    ...(showAll || type === 'consignment'
      ? [
          {
            key: 'consignment-history',
            title: `寄賣 (${consignmentRows.length})`,
            description: '寄賣店進貨與寄賣成交',
            tone: 'master' as const,
            tableVariant: 'default' as const,
            shipments: consignmentRows,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        tone="logistics"
        title="出貨歷史"
        description="已寄出／已送達 — 「寄賣」含店進貨與寄賣成交"
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
          <FilterLink
            href="/shipments/history"
            label="全部"
            count={subCount + orderCount + consignmentCount}
            active={!type}
          />
          <FilterLink
            href="/shipments/history?type=subscription"
            label="訂閱"
            count={subCount}
            active={type === 'subscription'}
          />
          <FilterLink
            href="/shipments/history?type=order"
            label="客戶訂單"
            count={orderCount}
            active={type === 'order'}
          />
          <FilterLink
            href="/shipments/history?type=consignment"
            label="寄賣"
            count={consignmentCount}
            active={type === 'consignment'}
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
              typeFilter={type === 'order' ? 'customer_order' : type}
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
