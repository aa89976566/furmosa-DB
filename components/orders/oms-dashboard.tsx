import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Clock3, PackageCheck } from 'lucide-react';
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

type WorkRow = {
  id: string; orderNumber: string; source: string; total: number; paymentStatus: string;
  shippingMethod: string; cvsStoreName: string | null; recipient: string; action: string;
  items: { productName: string }[];
  workState: 'ACTION_REQUIRED' | 'WAITING' | 'DONE';
};

export async function OmsDashboard() {
  const today = taiwanToday();
  const { end: endOfToday } = taipeiTodayRange();
  const [orders, reviewedToday, fulfilledToday, duePurchaseOrders, duePurchaseOrderCount, reviewCounts] = await Promise.all([
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
    prisma.purchaseOrder.findMany({
      where: { status: 'pending_receipt', remindFromDate: { lte: endOfToday } },
      include: { vendor: { select: { name: true } }, items: { select: { quantityGrams: true } }, _count: { select: { items: true } } },
      orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'asc' }], take: 6,
    }),
    prisma.purchaseOrder.count({ where: { status: 'pending_receipt', remindFromDate: { lte: endOfToday } } }),
    countReviewInbox(),
  ]);

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
  const actionCount = now.length + duePurchaseOrderCount + reviewActionCount;
  const first = now[0];
  const primaryHref = duePurchaseOrders[0]
    ? `/inventory/purchase-orders/${duePurchaseOrders[0].id}`
    : first
      ? `/orders/${first.id}`
      : reviewActionCount > 0
        ? '/reviews'
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

  return <div className="space-y-6">
    <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">今天的工作</p>
          <h2 className="text-2xl font-semibold tracking-tight text-navy">{headline}</h2>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>
        {primaryHref
          ? <Button size="lg" asChild><Link href={primaryHref}>繼續處理<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          : <span className="text-sm font-medium text-muted-foreground">目前沒有待辦</span>}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">待處理 {actionCount}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">等待中 {waiting.length}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">今日完成 {completedSteps}</span>
      </div>
    </section>

    {duePurchaseOrders.length ? <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card"><div className="flex items-center justify-between border-b px-5 py-4"><h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-5 w-5 text-primary" />待確認收貨</h3><span className="text-sm text-muted-foreground">{duePurchaseOrderCount} 件</span></div><div className="divide-y px-5">{duePurchaseOrders.map(order => <Link key={order.id} href={`/inventory/purchase-orders/${order.id}`} className="group grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold text-navy">{order.vendor?.name ?? '採購單'}待確認</p><p className="mt-1 text-sm text-muted-foreground">{order._count.items} 項・{order.items.reduce((sum, item) => sum + item.quantityGrams, 0).toLocaleString()} g・{formatCurrency(Number(order.totalAmount))}</p></div><span className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium group-hover:border-primary/40">查看並確認實收</span></Link>)}</div>{duePurchaseOrderCount > duePurchaseOrders.length ? <div className="border-t p-4 text-right"><Button variant="ghost" asChild><Link href="/inventory/purchases?view=pending">查看全部 {duePurchaseOrderCount} 件</Link></Button></div> : null}</section> : null}

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
