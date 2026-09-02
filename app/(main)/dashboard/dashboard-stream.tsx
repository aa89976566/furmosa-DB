import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { AlertTriangle, CircleDollarSign, Recycle, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import { getDashboardData } from '@/features/dashboard/queries';

const chartFallback = <div className="h-56 animate-pulse rounded-xl bg-muted/40" aria-hidden />;
const RevenueTrendChart = nextDynamic(() => import('@/features/dashboard/charts').then((m) => m.RevenueTrendChart), { loading: () => chartFallback });
const SourcePieChart = nextDynamic(() => import('@/features/dashboard/charts').then((m) => m.SourcePieChart), { loading: () => chartFallback });

export function DashboardTasksFallback() {
  return <div className="h-80 animate-pulse rounded-2xl bg-muted/40" />;
}

export function DashboardBodyFallback() {
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />)}</div>
    <div className="h-72 animate-pulse rounded-2xl bg-muted/40" />
  </div>;
}

export async function DashboardBodySection() {
  const data = await getDashboardData();
  const metrics = [
    { label: '本月營收', value: formatCurrency(data.kpis.monthRevenue), icon: CircleDollarSign, href: '/orders' },
    { label: '今日訂單', value: formatNumber(data.kpis.todayOrderCount), icon: ShoppingBag, href: '/orders?day=today' },
    { label: '低庫存', value: formatNumber(data.kpis.lowStockCount), icon: AlertTriangle, href: '/inventory' },
    { label: '本週換罐', value: formatNumber(data.kpis.weekJarRedeemCount), icon: Recycle, href: '/jar-exchange/manage?tab=codes' },
  ];

  return <div className="space-y-6">
    <section>
      <div className="mb-3"><h2 className="text-lg font-semibold text-navy">營運摘要</h2><p className="text-sm text-muted-foreground">先看會影響今天決策的四個數字。</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(({ label, value, icon: Icon, href }) => <Link key={label} href={href} className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/30">
        <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-5 w-5 text-primary" /></div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-navy">{value}</p>
      </Link>)}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2"><h3 className="font-semibold">近 30 天營收</h3><p className="mb-4 text-sm text-muted-foreground">查看營運是否穩定成長</p><RevenueTrendChart data={data.revenueTrend} /></div>
      <div className="rounded-2xl border border-border/70 bg-card p-5"><h3 className="font-semibold">本月訂單來源</h3><p className="mb-4 text-sm text-muted-foreground">客人主要從哪裡下單</p><SourcePieChart data={data.sourceData} /></div>
    </section>
    <div className="flex justify-end"><Button variant="outline" asChild><Link href="/admin/store-report">查看完整營運報表</Link></Button></div>
  </div>;
}
