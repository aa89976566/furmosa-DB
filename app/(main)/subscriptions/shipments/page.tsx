import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parsePlanContents } from '@/lib/subscription';
import { addDays, startOfWeek, format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { CalendarDays, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_FILTER = ['pending', 'packed'] as const;

export default async function SubscriptionShipmentsPage() {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const horizonEnd = addDays(thisWeekStart, 28); // 4 週

  const [thisWeekShipments, allUpcoming] = await Promise.all([
    prisma.subscriptionShipment.findMany({
      where: {
        scheduledDate: { gte: thisWeekStart, lt: addDays(thisWeekStart, 7) },
      },
      include: {
        subscription: { include: { customer: true, plan: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.subscriptionShipment.findMany({
      where: {
        scheduledDate: { gte: thisWeekStart, lt: horizonEnd },
        status: { in: [...STATUS_FILTER] },
      },
      include: {
        subscription: { include: { customer: true, plan: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    }),
  ]);

  // 統計
  const counts = {
    thisWeekTotal: thisWeekShipments.length,
    thisWeekPending: thisWeekShipments.filter((s) => s.status === 'pending').length,
    thisWeekPacked: thisWeekShipments.filter((s) => s.status === 'packed').length,
    thisWeekShipped: thisWeekShipments.filter(
      (s) => s.status === 'shipped' || s.status === 'delivered',
    ).length,
  };

  // 把未來 4 週的待出貨依「週」分組
  const weekBuckets: Array<{ start: Date; end: Date; items: typeof allUpcoming }> = [];
  for (let i = 0; i < 4; i++) {
    const start = addDays(thisWeekStart, i * 7);
    const end = addDays(start, 7);
    const items = allUpcoming.filter(
      (s) => s.scheduledDate >= start && s.scheduledDate < end,
    );
    weekBuckets.push({ start, end, items });
  }

  return (
    <>
      <PageHeader
        title="訂閱出貨排程 Subscription Shipments"
        description="每週要寄出的訂閱包，會自動依方案排程帶入"
      />
      <div className="space-y-6 p-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            icon={<Badge variant="info">包</Badge>}
            label="本週已包裝"
            value={counts.thisWeekPacked}
          />
          <KpiCard
            icon={<Badge variant="success">送</Badge>}
            label="本週已出 / 送達"
            value={counts.thisWeekShipped}
          />
        </div>

        {/* 本週出貨明細 */}
        <SectionCard
          title={`本週 (${format(thisWeekStart, 'M/d')} - ${format(addDays(thisWeekStart, 6), 'M/d')})`}
          description="所有狀態：待出貨、已包裝、已出貨、已送達、本次跳過"
        >
          {thisWeekShipments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              本週沒有需要出貨的訂閱包 ✨
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排定日期</TableHead>
                  <TableHead>客戶</TableHead>
                  <TableHead>方案</TableHead>
                  <TableHead>內容物</TableHead>
                  <TableHead>收件電話</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thisWeekShipments.map((sh) => {
                  const contents = parsePlanContents(sh.subscription.plan.contents);
                  return (
                    <TableRow key={sh.id}>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        <div>{format(sh.scheduledDate, 'M/d (E)', { locale: zhTW })}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {sh.shipmentNo}
                        </div>
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
                        <Link
                          href={`/subscriptions/${sh.subscription.id}`}
                          className="hover:underline"
                        >
                          <Badge variant="info">{sh.subscription.plan.name}</Badge>
                        </Link>
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
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {sh.subscription.shippingAddress}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="subscriptionShipment" value={sh.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        {/* 未來 4 週分組 */}
        <SectionCard
          title="未來 4 週待出貨"
          description="只顯示 pending / packed 狀態，已寄送的不再列出"
        >
          {weekBuckets.every((b) => b.items.length === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              未來 4 週沒有待出貨項目
            </p>
          ) : (
            <div className="space-y-4">
              {weekBuckets.map((b, idx) => (
                <div key={idx} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                    <div className="font-medium">
                      第 {idx + 1} 週 · {format(b.start, 'M/d')} - {format(addDays(b.end, -1), 'M/d')}
                    </div>
                    <Badge variant="muted">{b.items.length} 筆</Badge>
                  </div>
                  {b.items.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground">無</div>
                  ) : (
                    <div className="divide-y">
                      {b.items.map((sh) => (
                        <div key={sh.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                          <Truck className="h-4 w-4 shrink-0 text-info" />
                          <div className="w-20 shrink-0 font-medium">
                            {format(sh.scheduledDate, 'M/d (E)', { locale: zhTW })}
                          </div>
                          <Link
                            href={`/customers/${sh.subscription.customer.id}`}
                            className="w-24 shrink-0 font-medium hover:underline"
                          >
                            {sh.subscription.customer.name}
                          </Link>
                          <Badge variant="info" className="shrink-0">
                            {sh.subscription.plan.name}
                          </Badge>
                          <div className="flex-1 truncate text-xs text-muted-foreground">
                            {sh.subscription.shippingAddress}
                          </div>
                          <StatusBadge kind="subscriptionShipment" value={sh.status} />
                        </div>
                      ))}
                    </div>
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

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
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
