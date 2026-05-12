import Link from 'next/link';
import {
  AlertTriangle,
  CalendarRange,
  CircleDollarSign,
  PackageSearch,
  Repeat,
  ShoppingBag,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SectionCard } from '@/components/shared/section-card';
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
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { getDashboardData } from '@/features/dashboard/queries';
import { RevenueTrendChart, SourcePieChart, TopProductsChart } from '@/features/dashboard/charts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <PageHeader
        title="Furmosa Dashboard"
        description="即時掌握全品牌營運狀況：訂單、營收、庫存、寄賣表現、會員與待辦"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">查看訂單</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {/* KPI */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="今日訂單"
            value={formatNumber(data.kpis.todayOrderCount)}
            description="不含已取消"
            icon={ShoppingBag}
            accent="info"
          />
          <StatCard
            title="本月營收"
            value={formatCurrency(data.kpis.monthRevenue)}
            description="不含已取消"
            icon={CircleDollarSign}
            accent="success"
          />
          <StatCard
            title="庫存總值（成本）"
            value={formatCurrency(data.kpis.inventoryValue)}
            description="所有倉庫加總"
            icon={PackageSearch}
            accent="primary"
          />
          <StatCard
            title="低庫存品項"
            value={data.kpis.lowStockCount}
            description="低於補貨點"
            icon={AlertTriangle}
            accent="warning"
          />
          <StatCard
            title="寄賣店家數"
            value={data.kpis.merchantsCount}
            icon={Store}
            accent="info"
          />
          <StatCard
            title="待結算金額"
            value={formatCurrency(data.kpis.pendingSettlementAmount)}
            description="draft / reviewing / approved"
            icon={Wallet}
            accent="warning"
          />
          <StatCard
            title="換罐會員總數"
            value={formatNumber(data.kpis.membersCount)}
            icon={UserRound}
            accent="primary"
          />
          <StatCard
            title="訂閱中合約"
            value={formatNumber(data.kpis.activeSubscriptionsCount)}
            description="active 狀態"
            icon={Repeat}
            accent="info"
          />
          <StatCard
            title="本月回購率"
            value={formatPercent(data.kpis.repurchaseRate)}
            description="本月下單者中曾有下單紀錄占比"
            icon={CalendarRange}
            accent="success"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="近 30 天營收趨勢"
            description="每日訂單合計（不含已取消）"
            className="lg:col-span-2"
          >
            <RevenueTrendChart data={data.revenueTrend} />
          </SectionCard>

          <SectionCard title="本月訂單來源分布" description="官網 / LINE / 寄賣 / 手動">
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

          <SectionCard title="寄賣店銷售排行" description="近 30 天">
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

        <SectionCard
          title="本週訂閱出貨"
          description="待出貨 / 已包裝的訂閱出貨清單，依排定日期排序"
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
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
                        <div className="font-medium">{b.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.product.productId} · {b.product.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-warning">
                        {formatNumber(b.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatNumber(b.product.reorderPoint)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard
            title="待處理任務"
            description="todo / in_progress / blocked"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks">所有任務</Link>
              </Button>
            }
          >
            <div className="divide-y">
              {data.pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">沒有待辦任務 ✨</p>
              ) : (
                data.pendingTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.taskId} · {t.assignee?.name ?? '未指派'} ·{' '}
                        {t.dueDate ? formatDate(t.dueDate) : '無期限'}
                      </p>
                    </div>
                    <StatusBadge kind="taskPriority" value={t.priority} />
                    <StatusBadge kind="task" value={t.status} />
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
