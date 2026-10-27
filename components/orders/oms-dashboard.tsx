import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  PackageCheck,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { omsNextActionLabel } from '@/lib/orders/oms';
import { taiwanToday } from '@/lib/orders/oms-workbench';
import { getOrderWorkState } from '@/lib/orders/order-work-state';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { formatCurrency } from '@/lib/format';
import { orderSourceLabel, paymentStatusLabel } from '@/lib/labels';
import { taipeiTodayRange } from '@/lib/taipei-date';
import { countReviewInbox } from '@/lib/reviews/inbox';
import { loadDashboardProcurement } from '@/lib/inventory/load-dashboard-procurement';
import { InventoryActionBoard } from '@/components/dashboard/inventory-action-board';
import { DashboardJarWeekActivity } from '@/components/dashboard/dashboard-jar-week-activity';
import { loadJarWeekActivity } from '@/lib/jar-exchange/load-week-activity';

type WorkRow = {
  id: string; orderNumber: string; source: string; total: number; paymentStatus: string;
  shippingMethod: string; cvsStoreName: string | null; recipient: string; action: string;
  items: { productName: string }[];
  workState: 'ACTION_REQUIRED' | 'WAITING' | 'DONE';
};

export async function OmsDashboard() {
  const today = taiwanToday();
  const { end: endOfToday } = taipeiTodayRange();
  const [orders, reviewedToday, fulfilledToday, reviewCounts, procurement, jarWeekActivity] = await Promise.all([
    prisma.order.findMany({
      where: { deletedAt: null, omsStatus: { in: ['NEW', 'REVIEW', 'READY', 'FULFILLMENT_PENDING'] } },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }], take: 30,
      select: {
        id: true, orderNumber: true, source: true, total: true, paymentStatus: true,
        shippingMethod: true, cvsStoreName: true, omsStatus: true, omsIssueFlags: true,
        shopifySnapshot: true, customer: { select: { name: true } },
        items: { take: 1, select: { productName: true } },
      },
    }),
    prisma.order.count({ where: { deletedAt: null, omsReviewedAt: today } }),
    prisma.order.count({ where: { deletedAt: null, omsStatus: 'FULFILLED', updatedAt: today } }),
    countReviewInbox(),
    loadDashboardProcurement(),
    loadJarWeekActivity(),
  ]);

  const { reorderAlerts } = procurement;
  const duePurchaseOrders = procurement.purchases.filter(order => order.remindFromDate <= endOfToday);
  const duePurchaseOrderCount = duePurchaseOrders.length;

  const rows: WorkRow[] = orders.map((order) => {
    const snapshot = snapshotView(order.shopifySnapshot);
    return {
      id: order.id, orderNumber: order.orderNumber, source: order.source, total: order.total,
      paymentStatus: order.paymentStatus, shippingMethod: order.shippingMethod,
      cvsStoreName: order.cvsStoreName, items: order.items,
      recipient: order.customer?.name || snapshot?.recipient || '收件人待確認',
      action: omsNextActionLabel(order.omsStatus, order.omsIssueFlags),
      workState: getOrderWorkState({ omsStatus: order.omsStatus, paymentStatus: order.paymentStatus }),
    };
  });
  const now = rows.filter((row) => row.workState === 'ACTION_REQUIRED');
  const waiting = rows.filter((row) => row.workState === 'WAITING');
  const completedSteps = reviewedToday + fulfilledToday;
  const reviewActionCount = reviewCounts.ugc + reviewCounts.restock;
  const inventoryActionCount = reorderAlerts.orderNow.length + reorderAlerts.stocktake.length;
  const actionCount = now.length + duePurchaseOrderCount + reviewActionCount + inventoryActionCount + procurement.merchantStockCount + procurement.shipmentAudit.missing.length;
  const first = now[0];
  const primaryHref = procurement.shipmentAudit.missing[0]
    ? `/shipments/${procurement.shipmentAudit.missing[0].id}`
    : duePurchaseOrders[0]
    ? `/inventory/purchase-orders/${duePurchaseOrders[0].id}`
    : reorderAlerts.orderNow.length > 0
      ? reorderAlerts.orderNow[0].unit === 'g' ? '/inventory/purchase-orders/new' : `/products/${reorderAlerts.orderNow[0].id}`
      : reorderAlerts.stocktake.length > 0
        ? '/inventory'
        : first
          ? `/orders/${first.id}`
          : reviewActionCount > 0
            ? '/reviews'
            : procurement.merchantStockCount > 0
              ? '#purchase-merchant'
              : null;
  const headline = actionCount
    ? `還有 ${actionCount} 件事需要處理`
    : waiting.length
      ? '目前沒有需要立即處理的訂單'
      : '目前所有訂單工作都已處理完成';
  const subline = actionCount
    ? `今天已完成 ${completedSteps} 個處理步驟；另有 ${waiting.length} 筆等待外部條件。`
    : waiting.length
      ? `另有 ${waiting.length} 筆等待外部條件；完成後會自動回到工作流程。`
      : `今天已完成 ${completedSteps} 個處理步驟。`;
  const shipmentCount = orders.filter((order) => ['READY', 'FULFILLMENT_PENDING'].includes(order.omsStatus ?? '')).length;
  const attentionItems = [
    procurement.shipmentAudit.missing.length > 0 ? { href: '#shipment-stock-check', label: `有 ${procurement.shipmentAudit.missing.length} 筆出貨扣庫存紀錄待核對`, tone: 'bg-destructive' } : null,
    inventoryActionCount > 0 ? { href: '/inventory', label: `有 ${inventoryActionCount} 項商品庫存需處理`, tone: 'bg-warning' } : null,
    shipmentCount > 0 ? { href: '/shipments?status=pending', label: `有 ${shipmentCount} 筆訂單等待出貨`, tone: 'bg-primary' } : null,
    reviewActionCount > 0 ? { href: '/reviews', label: `有 ${reviewActionCount} 筆資料等待審核`, tone: 'bg-primary' } : null,
  ].filter(Boolean) as { href: string; label: string; tone: string }[];

  return <div className="dashboard-operations space-y-6">
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">今天最重要的一件事</p>
          <h2 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{headline}</h2>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>
        {primaryHref ? <Button size="lg" asChild><Link href={primaryHref}>立即處理</Link></Button> : <span className="text-sm font-medium text-muted-foreground">目前沒有待辦</span>}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardMetric href="/shipments?status=pending" label="待出貨" value={shipmentCount} detail="筆訂單等待出貨" />
      <DashboardMetric href="/inventory" label="主倉待辦" value={inventoryActionCount} detail="項商品需處理" warning />
      <DashboardMetric href="/reviews" label="待審核" value={reviewActionCount} detail="筆資料等待審核" />
      <DashboardMetric href="/jar-exchange/manage?tab=ledger" label="本週換罐" value={jarWeekActivity.totalExchanges} detail="次換罐活動" />
    </section>

    <InventoryActionBoard data={procurement} today={today.gte} />

    <DashboardJarWeekActivity />

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-navy">今天流程</h3><span className="text-xs text-muted-foreground">即時工作狀態</span></div>
        <div className="mt-6 grid grid-cols-4 divide-x divide-border/70 text-center">
          <FlowMetric label="訂單" value={now.length} />
          <FlowMetric label="出貨" value={shipmentCount} />
          <FlowMetric label="收貨" value={duePurchaseOrderCount} />
          <FlowMetric label="完成" value={completedSteps} detail={<>今日完成 {completedSteps}</>} />
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-navy">需要注意</h3><Link href="/inventory" className="text-sm font-medium text-primary hover:underline">查看全部</Link></div>
        <div className="mt-4 space-y-3">
          {attentionItems.length ? attentionItems.map((item) => <Link key={item.label} href={item.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/50"><span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} /><span className="text-sm font-medium">{item.label}</span></Link>) : <p className="py-4 text-sm text-muted-foreground">目前沒有需要注意的異常。</p>}
        </div>
      </div>
    </section>

    {reviewActionCount > 0 ? (
      <Link
        href="/reviews"
        className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-4 py-3 transition-colors hover:bg-muted/25"
      >
        <div>
          <p className="font-semibold">其他待處理</p>
          <p className="mt-1 text-sm text-muted-foreground">
            UGC {reviewCounts.ugc} · 補貨申請 {reviewCounts.restock}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          打開待審核 <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    ) : null}

    <WorkList title="現在處理" count={now.length} icon={<AlertCircle className="h-5 w-5 text-primary" />} rows={now.slice(0, 6)} empty="目前沒有需要立即處理的訂單" />

    {waiting.length > 0 ? <details className="rounded-2xl border border-border/70 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5 text-warning" />等待中</span>
        <span className="text-sm text-muted-foreground">{waiting.length} 筆訂單</span>
      </summary>
      <div className="border-t px-5 pb-2"><OrderRows rows={waiting.slice(0, 6)} /></div>
    </details> : null}


  </div>;
}

function DashboardMetric({ href, label, value, detail, warning = false }: { href: string; label: string; value: number; detail: string; warning?: boolean }) {
  return <Link href={href} className={`rounded-2xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 ${warning ? 'border-warning/30 bg-warning/5' : 'border-border/70 bg-card'}`}>
    <p className={`text-sm font-medium ${warning ? 'text-warning' : 'text-muted-foreground'}`}>{label}</p>
    <p className="mt-2 text-3xl font-semibold tracking-tight text-navy">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </Link>;
}

function FlowMetric({ label, value, detail = '筆待處理' }: { label: string; value: number; detail?: ReactNode }) {
  return <div className="px-2"><p className="text-sm font-medium text-navy">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-navy">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function WorkList({ title, count, icon, rows, empty }: { title: string; count: number; icon: ReactNode; rows: WorkRow[]; empty: string }) {
  return <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
    <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="flex items-center gap-2 font-semibold">{icon}{title}</h3><span className="text-sm text-muted-foreground">{count} 件</span></div>
    {rows.length ? <div className="px-5"><OrderRows rows={rows} /></div> : <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p>}
  </section>;
}

function OrderRows({ rows }: { rows: WorkRow[] }) {
  return <div className="divide-y">{rows.map((row) => {
    const source = orderSourceLabel[row.source] ?? row.source;
    const delivery = row.shippingMethod === 'convenience' ? `7-11${row.cvsStoreName ? ` · ${row.cvsStoreName}` : ''}` : row.shippingMethod === 'delivery' ? '專人配送' : '宅配';
    return <Link key={row.id} href={`/orders/${row.id}`} className="group grid gap-3 py-4 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{source}</span><span className="font-semibold text-navy">{row.recipient}</span></div>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium"><PackageCheck className="h-4 w-4 shrink-0 text-primary" />{row.action}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{delivery} · {row.items[0]?.productName ?? '商品待確認'} · {row.orderNumber}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right"><p className="font-semibold">{formatCurrency(row.total)}</p><p className="text-xs text-muted-foreground">{paymentStatusLabel[row.paymentStatus] ?? row.paymentStatus}</p></div>
        <span className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium group-hover:border-primary/40">處理</span>
      </div>
    </Link>;
  })}</div>;
}
