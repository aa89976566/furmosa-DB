import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SubscriptionShipmentStatusSelect } from '@/components/subscriptions/subscription-shipment-status-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parsePlanContents } from '@/lib/subscription';
import { PENDING_SUBSCRIPTION_SHIPMENT_STATUSES } from '@/lib/subscription-shipment-status';
import { addDays, startOfDay, startOfWeek, format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const shipmentInclude = {
  subscription: {
    include: {
      customer: true,
      plan: true,
    },
  },
  shipment: { select: { id: true, shipmentNumber: true } },
} as const;

export default async function SubscriptionShipmentsPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const horizonEnd = addDays(thisWeekStart, 28);

  const [overdue, thisWeekShipments, allInHorizon] = await Promise.all([
    prisma.subscriptionShipment.findMany({
      where: {
        scheduledDate: { lt: todayStart },
        status: { in: [...PENDING_SUBSCRIPTION_SHIPMENT_STATUSES] },
        subscription: { status: 'active' },
      },
      include: shipmentInclude,
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.subscriptionShipment.findMany({
      where: {
        scheduledDate: { gte: thisWeekStart, lt: addDays(thisWeekStart, 7) },
        subscription: { status: { in: ['active', 'paused'] } },
      },
      include: shipmentInclude,
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.subscriptionShipment.findMany({
      where: {
        scheduledDate: { gte: thisWeekStart, lt: horizonEnd },
        subscription: { status: { in: ['active', 'paused'] } },
      },
      include: shipmentInclude,
      orderBy: { scheduledDate: 'asc' },
    }),
  ]);

  const counts = {
    overdue: overdue.length,
    thisWeekTotal: thisWeekShipments.length,
    thisWeekPending: thisWeekShipments.filter((s) =>
      (PENDING_SUBSCRIPTION_SHIPMENT_STATUSES as readonly string[]).includes(
        s.status as (typeof PENDING_SUBSCRIPTION_SHIPMENT_STATUSES)[number],
      ),
    ).length,
    thisWeekShipped: thisWeekShipments.filter(
      (s) => s.status === 'shipped' || s.status === 'delivered',
    ).length,
  };

  const weekBuckets: Array<{ start: Date; end: Date; items: typeof allInHorizon }> = [];
  for (let i = 0; i < 4; i++) {
    const start = addDays(thisWeekStart, i * 7);
    const end = addDays(start, 7);
    const items = allInHorizon.filter(
      (s) => s.scheduledDate >= start && s.scheduledDate < end,
    );
    weekBuckets.push({ start, end, items });
  }

  return (
    <>
      <PageHeader
        title="訂閱出貨排程 Subscription Shipments"
        description="每週訂閱包排程；逾期與近四週會顯示在此，狀態可直接修改（含已出貨）"
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            label="逾期待出貨"
            value={counts.overdue}
            highlight={counts.overdue > 0}
          />
          <KpiCard
            icon={<CalendarDays className="h-4 w-4 text-info" />}
            label="本週總出貨"
            value={counts.thisWeekTotal}
          />
          <KpiCard
            icon={<Badge variant="warning">待</Badge>}
            label="本週待出貨"
            value={counts.thisWeekPending}
          />
          <KpiCard
            icon={<Badge variant="success">送</Badge>}
            label="本週已出 / 送達"
            value={counts.thisWeekShipped}
          />
        </div>

        {overdue.length > 0 ? (
          <SectionCard
            title={`逾期待出貨 (${overdue.length})`}
            description="排定日已過但仍未寄出 — 請優先處理"
          >
            <ShipmentTable rows={overdue} showOverdue />
          </SectionCard>
        ) : null}

        <SectionCard
          title={`本週 (${format(thisWeekStart, 'M/d')} - ${format(addDays(thisWeekStart, 6), 'M/d')})`}
          description="本週所有排程；下拉可改狀態（含改回待出貨）"
        >
          {thisWeekShipments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              本週沒有訂閱出貨排程
            </p>
          ) : (
            <ShipmentTable rows={thisWeekShipments} />
          )}
        </SectionCard>

        <SectionCard
          title="未來 4 週"
          description="含待出貨、已出貨、已送達；近一週內排程會同步至出貨隊列"
        >
          {weekBuckets.every((b) => b.items.length === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              未來 4 週沒有排程
            </p>
          ) : (
            <div className="space-y-4">
              {weekBuckets.map((b, idx) => (
                <div key={idx} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                    <div className="font-medium">
                      第 {idx + 1} 週 · {format(b.start, 'M/d')} -{' '}
                      {format(addDays(b.end, -1), 'M/d')}
                    </div>
                    <Badge variant="muted">{b.items.length} 筆</Badge>
                  </div>
                  {b.items.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground">無</div>
                  ) : (
                    <ShipmentTable rows={b.items} compact />
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

type ShipmentRow = Awaited<
  ReturnType<typeof prisma.subscriptionShipment.findMany<{ include: typeof shipmentInclude }>>
>[number];

function ShipmentTable({
  rows,
  compact,
  showOverdue,
}: {
  rows: ShipmentRow[];
  compact?: boolean;
  showOverdue?: boolean;
}) {
  if (compact) {
    return (
      <div className="divide-y">
        {rows.map((sh) => (
          <div key={sh.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
            <Truck className="h-4 w-4 shrink-0 text-info" />
            <div className="w-24 shrink-0 font-medium">
              {format(sh.scheduledDate, 'M/d (E)', { locale: zhTW })}
            </div>
            <Link
              href={`/subscriptions/${sh.subscription.id}`}
              className="w-28 shrink-0 font-mono text-[11px] hover:underline"
            >
              {sh.subscription.subscriptionNo}
            </Link>
            <Link
              href={`/customers/${sh.subscription.customer.id}`}
              className="w-24 shrink-0 font-medium hover:underline"
            >
              {sh.subscription.customer.name}
            </Link>
            <Badge variant="info" className="shrink-0">
              {sh.subscription.plan.name}
            </Badge>
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {sh.subscription.shippingAddress}
            </div>
            {sh.shipment ? (
              <Link
                href={`/shipments?s=${sh.shipment.id}`}
                className="shrink-0 font-mono text-[10px] text-info hover:underline"
              >
                隊列
              </Link>
            ) : null}
            <SubscriptionShipmentStatusSelect
              subscriptionShipmentId={sh.id}
              status={sh.status}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>排定日期</TableHead>
          <TableHead>合約</TableHead>
          <TableHead>客戶</TableHead>
          <TableHead>方案</TableHead>
          <TableHead>內容物</TableHead>
          <TableHead>收件電話</TableHead>
          <TableHead>地址</TableHead>
          <TableHead>出貨隊列</TableHead>
          <TableHead>狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sh) => {
          const contents = parsePlanContents(sh.subscription.plan.contents);
          return (
            <TableRow key={sh.id} className={showOverdue ? 'bg-warning/[0.04]' : undefined}>
              <TableCell className="whitespace-nowrap text-sm font-medium">
                <div>{format(sh.scheduledDate, 'M/d (E)', { locale: zhTW })}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{sh.shipmentNo}</div>
              </TableCell>
              <TableCell>
                <Link
                  href={`/subscriptions/${sh.subscription.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {sh.subscription.subscriptionNo}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/customers/${sh.subscription.customer.id}`}
                  className="font-medium hover:underline"
                >
                  {sh.subscription.customer.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="info">{sh.subscription.plan.name}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div className="space-y-0.5">
                  {contents.slice(0, 3).map((c, i) => (
                    <div key={i}>
                      · {c.name}
                      {c.weight && <span className="ml-1 opacity-70">{c.weight}</span>}
                    </div>
                  ))}
                  {contents.length > 3 && <div>· …等 {contents.length} 項</div>}
                </div>
              </TableCell>
              <TableCell className="text-sm">{sh.subscription.recipientPhone}</TableCell>
              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                {sh.subscription.shippingAddress}
              </TableCell>
              <TableCell className="text-xs">
                {sh.shipment ? (
                  <Link
                    href={`/shipments?s=${sh.shipment.id}`}
                    className="font-mono text-info hover:underline"
                  >
                    {sh.shipment.shipmentNumber}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <SubscriptionShipmentStatusSelect
                  subscriptionShipmentId={sh.id}
                  status={sh.status}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function KpiCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-warning/50 bg-warning/[0.03]' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export const metadata = {
  title: '訂閱出貨排程',
};
