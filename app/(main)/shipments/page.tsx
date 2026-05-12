import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import {
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
  SHIPMENT_STATUSES,
} from '@/lib/shipment';
import { productLabel } from '@/lib/product-label';
import {
  syncUpcomingSubscriptionShipments,
  parsePlanContents,
  formatPlanContents,
} from '@/lib/subscription-shipment-sync';
import { Truck, Store, User, Repeat, Package, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ICONS: Record<string, typeof Store> = {
  merchant_restock: Store,
  customer_order: User,
  subscription: Repeat,
};

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams?: { status?: string; type?: string };
}) {
  const status = searchParams?.status;
  const type = searchParams?.type;

  // 進入隊列前先同步：把「一週內要寄」的訂閱方案補成 pending Shipment
  await syncUpcomingSubscriptionShipments();

  const where: Record<string, unknown> = {};
  if (status && SHIPMENT_STATUSES.includes(status as never)) where.status = status;
  if (type) where.type = type;

  const [shipments, counts] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        merchant: true,
        customer: true,
        items: true,
        subscriptionShipment: {
          include: {
            subscription: { include: { plan: true } },
          },
        },
      },
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

  return (
    <>
      <PageHeader
        title="出貨隊列"
        description="物流人員的工作台 — 待包裝、待寄出、在途中的所有出貨單"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/transactions">
              <Package className="mr-1 h-4 w-4" />
              庫存異動
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6">
        <div className="grid gap-3 sm:grid-cols-5">
          <FilterChip
            href="/shipments"
            label="全部"
            count={total}
            active={!status}
          />
          {(['pending', 'packed', 'shipped', 'delivered', 'cancelled'] as const).map((s) => (
            <FilterChip
              key={s}
              href={`/shipments?status=${s}`}
              label={shipmentStatusLabel[s]}
              count={countByStatus[s] ?? 0}
              active={status === s}
              variant={shipmentStatusVariant[s]}
            />
          ))}
        </div>

        <SectionCard
          title={
            status
              ? `${shipmentStatusLabel[status]} (${shipments.length})`
              : `所有出貨單 (${shipments.length})`
          }
          description="點任一單進入詳情，可推進狀態（包裝 / 寄出 / 送達）"
        >
          {shipments.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
              沒有符合的出貨單
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>單號</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>收件人</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">總件數</TableHead>
                  <TableHead>建立 / 預定</TableHead>
                  <TableHead>物流</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s) => {
                  const Icon = ICONS[s.type] ?? Truck;
                  const totalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);
                  const isSub = s.type === 'subscription';
                  const planContents = isSub
                    ? parsePlanContents(s.subscriptionShipment?.subscription?.plan?.contents)
                    : [];
                  const scheduledDate = s.subscriptionShipment?.scheduledDate ?? null;
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell>
                        <Link
                          href={`/shipments/${s.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {s.shipmentNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {shipmentTypeLabel[s.type] ?? s.type}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={shipmentStatusVariant[s.status] ?? 'secondary'}>
                          {shipmentStatusLabel[s.status] ?? s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.merchant ? (
                          <Link
                            href={`/merchants/${s.merchant.id}`}
                            className="font-medium hover:underline"
                          >
                            {s.merchant.name}
                          </Link>
                        ) : s.customer ? (
                          <Link
                            href={`/customers/${s.customer.id}`}
                            className="font-medium hover:underline"
                          >
                            {s.customer.name}
                          </Link>
                        ) : (
                          (s.recipientName ?? '-')
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isSub && planContents.length > 0 ? (
                          <>
                            <div className="font-medium">
                              {s.subscriptionShipment?.subscription?.plan?.name ?? '訂閱方案'}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {formatPlanContents(planContents)}
                            </div>
                          </>
                        ) : s.items.length > 0 ? (
                          <>
                            {s.items.length} 項
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {s.items
                                .slice(0, 2)
                                .map((it) => productLabel(it.productName, it.weightGrams))
                                .join('、')}
                              {s.items.length > 2 ? `、+${s.items.length - 2}` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {isSub ? '—' : totalQty}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {isSub && scheduledDate ? (
                          <>
                            <div className="flex items-center gap-1 text-foreground">
                              <CalendarClock className="h-3.5 w-3.5 text-info" />
                              <span className="font-medium">預定 {formatDate(scheduledDate)}</span>
                            </div>
                            <div className="text-xs">{formatRelative(scheduledDate)}</div>
                          </>
                        ) : (
                          <>
                            <div>{formatDate(s.createdAt)}</div>
                            <div className="text-xs">{formatRelative(s.createdAt)}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.carrier ? (
                          <>
                            <div>{s.carrier}</div>
                            {s.trackingNumber && (
                              <div className="font-mono text-muted-foreground">
                                {s.trackingNumber}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
  variant,
}: {
  href: string;
  label: string;
  count: number;
  active?: boolean;
  variant?: 'secondary' | 'warning' | 'info' | 'success' | 'destructive';
}) {
  const dot =
    variant === 'warning'
      ? 'bg-warning'
      : variant === 'info'
        ? 'bg-info'
        : variant === 'success'
          ? 'bg-success'
          : variant === 'destructive'
            ? 'bg-destructive'
            : 'bg-muted-foreground';
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg border bg-card p-4 transition hover:bg-muted/40',
        active && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('inline-block h-2 w-2 rounded-full', dot)} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{count}</div>
    </Link>
  );
}
