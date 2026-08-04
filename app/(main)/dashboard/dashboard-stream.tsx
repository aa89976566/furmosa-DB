import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import {
  DashboardHeroKpis,
  DashboardKpiOverview,
} from '@/components/dashboard/dashboard-kpi-overview';
import { SectionBlock } from '@/components/shared/section-block';
import { SectionCard } from '@/components/shared/section-card';
import { SectionSkeleton } from '@/components/shared/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { getDashboardData } from '@/features/dashboard/queries';

const chartFallback = (
  <div className="h-56 animate-pulse rounded-md bg-muted/40" aria-hidden />
);

const RevenueTrendChart = nextDynamic(
  () =>
    import('@/features/dashboard/charts').then((m) => m.RevenueTrendChart),
  { loading: () => chartFallback },
);
const SourcePieChart = nextDynamic(
  () => import('@/features/dashboard/charts').then((m) => m.SourcePieChart),
  { loading: () => chartFallback },
);
const TopProductsChart = nextDynamic(
  () => import('@/features/dashboard/charts').then((m) => m.TopProductsChart),
  { loading: () => chartFallback },
);

export function DashboardBodyFallback() {
  return (
    <div className="space-y-8">
      <SectionSkeleton rows={2} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-muted/40" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}

export function DashboardHeroFallback() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink/80" />
      ))}
    </div>
  );
}

export async function DashboardHeroSection() {
  const data = await getDashboardData();
  return <DashboardHeroKpis kpis={data.kpis} />;
}

export async function DashboardBodySection() {
  const data = await getDashboardData();

  return (
    <>
      <SectionBlock tone="overview" title="營運細節" description="分組掃讀次級指標">
        <div className="bento-card p-5 sm:p-6">
          <DashboardKpiOverview kpis={data.kpis} />
        </div>
      </SectionBlock>

      <SectionBlock tone="orders" title="訂單與營收" description="趨勢、來源與熱銷表現">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            tone="orders"
            title="近 30 天營收趨勢"
            description="每日訂單合計（不含已取消）"
            className="lg:col-span-2"
          >
            <RevenueTrendChart data={data.revenueTrend} />
          </SectionCard>

          <SectionCard
            tone="orders"
            title="本月訂單來源分布"
            description="官網 / LINE / 寄賣 / 手動"
          >
            <SourcePieChart data={data.sourceData} />
            <div className="mt-3 space-y-1.5">
              {data.sourceData.map((s) => (
                <div
                  key={s.source}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>
                    <StatusBadge kind="orderSource" value={s.source} />
                  </span>
                  <span>
                    {formatCurrency(s.total)} · {s.count} 筆
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            tone="master"
            title="熱銷商品 Top 10"
            description="近 30 天銷售額排行"
            className="lg:col-span-2"
          >
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無銷售資料</p>
            ) : (
              <TopProductsChart data={data.topProducts} />
            )}
          </SectionCard>

          <SectionCard tone="master" title="寄賣店銷售排行" description="近 30 天">
            <div className="space-y-3">
              {data.topMerchants.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無寄賣訂單</p>
              ) : (
                data.topMerchants.map((m, idx) => (
                  <div key={m.merchantId} className="flex items-center gap-3">
                    <Badge variant="muted" className="w-6 justify-center">
                      {idx + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.merchantId} · {m.orders} 筆
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(m.total)}</p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </SectionBlock>

      <SectionBlock tone="subscription" title="訂閱出貨" description="本週待處理的訂閱包裹">
        <SectionCard
          tone="subscription"
          title="本週訂閱出貨"
          description="待出貨的訂閱出貨清單，依排定日期排序"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/subscriptions/shipments">出貨排程</Link>
            </Button>
          }
        >
          {data.weekShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">本週沒有需要出貨的訂閱包 ✨</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排定日期</TableHead>
                  <TableHead>客戶</TableHead>
                  <TableHead>方案</TableHead>
                  <TableHead>收件電話</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.weekShipments.map((sh) => (
                  <TableRow key={sh.id}>
                    <TableCell className="text-sm font-medium">
                      {formatDate(sh.scheduledDate)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${sh.subscription.customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {sh.subscription.customer.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {sh.subscription.customer.customerId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{sh.subscription.plan.name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{sh.subscription.recipientPhone}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {sh.subscription.shippingAddress}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="subscriptionShipment" value={sh.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </SectionBlock>

      <SectionBlock tone="inventory" title="庫存警示" description="需要優先處理的低庫存品項">
        <SectionCard
          tone="inventory"
          title="低庫存警示"
          description="WH-MAIN 數量已達或低於補貨點"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inventory">查看庫存</Link>
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">在庫</TableHead>
                <TableHead className="text-right">補貨點</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lowStockBalances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    所有商品庫存正常
                  </TableCell>
                </TableRow>
              ) : (
                data.lowStockBalances.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.product?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.product?.productId ?? '—'} · {b.product?.sku ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-warning">
                      {formatNumber(b.quantity)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatNumber(b.product?.reorderPoint ?? 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </SectionBlock>
    </>
  );
}
