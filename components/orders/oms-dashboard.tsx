import type { Prisma } from '@prisma/client';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  PackageCheck,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { omsNextActionLabel, parseOmsIssues } from '@/lib/orders/oms';
import { taiwanToday } from '@/lib/orders/oms-workbench';
import { orderWorkWhere, workbenchVisibleWhere } from '@/lib/orders/oms-workbench';
import { getShipmentQueueCounts } from '@/lib/hot-path-reads';
import { activeShipmentQueueWhere } from '@/lib/shipment-queue-filters';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { formatCurrency } from '@/lib/format';
import { orderSourceLabel, paymentStatusLabel } from '@/lib/labels';
import { taipeiTodayRange } from '@/lib/taipei-date';
import { countReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';
import { loadDashboardProcurement } from '@/lib/inventory/load-dashboard-procurement';
import { InventoryActionBoard } from '@/components/dashboard/inventory-action-board';
import { DashboardJarWeekActivity } from '@/components/dashboard/dashboard-jar-week-activity';
import { loadJarWeekActivity } from '@/lib/jar-exchange/load-week-activity';

type WorkRow = {
  id: string; orderNumber: string; source: string; total: number; paymentStatus: string;
  shippingMethod: string; cvsStoreName: string | null; recipient: string; action: string;
  items: { productName: string }[];
  reason: string;
  missingMapping: boolean;
};

export async function OmsDashboard({ selectedId }: { selectedId?: string }) {
  const today = taiwanToday();
  const { end: endOfToday } = taipeiTodayRange();
  const orderSelect = {
    id: true, orderNumber: true, source: true, total: true, paymentStatus: true,
    shippingMethod: true, cvsStoreName: true, omsStatus: true, omsIssueFlags: true,
    shopifySnapshot: true, customer: { select: { name: true } },
    items: { take: 1, select: { productName: true } },
  } as const;
  const orderScope = workbenchVisibleWhere;
  const waitingWhere = { AND: [orderScope, orderWorkWhere('waiting')] };
  const [orders, waitingOrders, waitingCount, reviews, shipments, procurement] = await Promise.allSettled([
    prisma.order.findMany({
      where: { AND: [orderScope, orderWorkWhere('now')] },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
      take: 8,
      select: orderSelect,
    }),
    prisma.order.findMany({
      where: waitingWhere, orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }], take: 5, select: orderSelect,
    }),
    prisma.order.count({ where: waitingWhere }),
    countReviewInbox(),
    getShipmentQueueCounts({ ...activeShipmentQueueWhere, status: { in: ['pending', 'packed', 'shipped', 'delivered'] } }),
    loadDashboardProcurement(),
  ]);

  function toRow(order: Prisma.OrderGetPayload<{ select: typeof orderSelect }>): WorkRow {
    const issues = parseOmsIssues(order.omsIssueFlags) ?? [];
    const issue = issues.find(item => item.severity === 'blocking' && item.code !== 'PAYMENT_PENDING') ?? issues[0];
    return {
      id: order.id, orderNumber: order.orderNumber, source: order.source, total: order.total,
      paymentStatus: order.paymentStatus, shippingMethod: order.shippingMethod,
      cvsStoreName: order.cvsStoreName, items: order.items,
      recipient: order.customer?.name || snapshotView(order.shopifySnapshot)?.recipient || '收件人待確認',
      action: omsNextActionLabel(order.omsStatus, order.omsIssueFlags),
      reason: issue?.message ?? '訂單待確認',
      missingMapping: issue?.code === 'PRODUCT_UNMAPPED',
    };
  }

  const rows = orders.status === 'fulfilled' ? orders.value.map(toRow) : [];
  const waiting = waitingOrders.status === 'fulfilled' ? waitingOrders.value.map(toRow) : [];
  const inventory = procurement.status === 'fulfilled' ? procurement.value : null;
  const selected = rows.find(row => row.id === selectedId && row.missingMapping);
  const priority = [
    ...rows.map(row => ({
      id: row.id, title: row.orderNumber, detail: row.items[0]?.productName, reason: row.reason,
      action: row.missingMapping ? '檢查商品對應' : row.action,
      href: row.missingMapping ? '/dashboard?item=' + encodeURIComponent(row.id) : '/orders/' + row.id,
    })),
    ...(inventory?.shipmentAudit.missing ?? []).slice(0, 3).map(shipment => ({
      id: 'shipment-' + shipment.id, title: '出貨庫存紀錄', detail: undefined,
      reason: '出貨扣庫存紀錄待核對', action: '查看出貨單', href: '/shipments/' + shipment.id,
    })),
    ...(inventory?.purchases ?? []).filter(order => order.remindFromDate <= endOfToday).slice(0, 3).map(order => ({
      id: 'purchase-' + order.id, title: '採購到貨', detail: undefined,
      reason: '已到收貨提醒日', action: '查看採購單', href: '/inventory/purchase-orders/' + order.id,
    })),
  ];

  return <div className="dashboard-operations space-y-6">
    <div className={selected ? 'grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]' : undefined}>
      <section aria-labelledby="workbench-priority" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 bg-warning/15 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <h2 id="workbench-priority" className="font-semibold">優先處理</h2>
          <Link href="/orders?work=now" className="ml-auto text-sm font-medium text-primary hover:underline">查看待處理訂單</Link>
        </div>
        {orders.status === 'rejected' && <p role="status" className="px-4 py-3 text-sm">暫時無法取得待處理訂單</p>}
        {priority.length > 0 ? <div className="divide-y">
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(9rem,auto)] gap-4 bg-muted/40 px-4 py-2 text-sm font-medium sm:grid">
            <span>事項</span><span>原因</span><span>下一步</span>
          </div>
          {priority.map(row => <div key={row.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(9rem,auto)] sm:items-center sm:gap-4">
            <div className="min-w-0 break-words"><p className="font-semibold">{row.title}</p>{row.detail && <p className="text-sm text-muted-foreground">{row.detail}</p>}</div>
            <p className="min-w-0 break-words text-sm">{row.reason}</p>
            <Button asChild variant="outline" size="sm" className="w-fit sm:justify-self-start"><Link href={row.href}>{row.action}</Link></Button>
          </div>)}
        </div> : orders.status === 'fulfilled' && procurement.status === 'fulfilled' && <p className="p-4 text-sm text-muted-foreground">目前沒有優先處理事項</p>}
        {procurement.status === 'rejected' && <p role="status" className="px-4 py-3 text-sm">暫時無法取得庫存與採購待辦</p>}
      </section>

      {selected && <aside aria-labelledby="workbench-product" className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="workbench-product" className="font-semibold">檢查商品對應</h2>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">關閉</Link>
        </div>
        <p className="mt-3 text-sm font-medium">{selected.orderNumber}</p>
        <p className="mt-1 text-sm text-muted-foreground">{selected.reason}</p>
        <div className="mt-4 grid gap-2">
          <Button asChild variant="outline"><Link href="/products/shopify-candidates">查看 Shopify 商品候選</Link></Button>
          <Button asChild><Link href={'/orders/' + selected.id}>開啟訂單確認對應</Link></Button>
        </div>
      </aside>}
    </div>

    <section aria-labelledby="workbench-queues">
      <h2 id="workbench-queues" className="mb-3 font-semibold">待處理清單</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardMetric href="/reviews" label="待審核" value={reviews.status === 'fulfilled' ? reviewInboxTotal(reviews.value) : null} />
        <DashboardMetric href="/shipments?status=pending" label="待出貨" value={shipments.status === 'fulfilled' ? shipments.value.pendingCount : null} />
        <DashboardMetric href="/shipments?status=delivered" label="待驗收" value={shipments.status === 'fulfilled' ? shipments.value.byStatus.delivered ?? 0 : null} />
        <DashboardMetric href="/orders?work=waiting" label="待付款" value={waitingCount.status === 'fulfilled' ? waitingCount.value : null} />
      </div>
    </section>

    <section aria-labelledby="workbench-waiting" className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 id="workbench-waiting" className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5 text-warning" />等待中</h2>
        <Link href="/orders?work=waiting" className="text-sm font-medium text-primary hover:underline">查看待付款訂單</Link>
      </div>
      <div className="px-4">
        {waitingOrders.status === 'rejected' ? <p role="status" className="py-3 text-sm">暫時無法取得等待中的訂單</p> :
          waiting.length ? <OrderRows rows={waiting} /> : <p className="py-3 text-sm text-muted-foreground">目前沒有等待付款的訂單</p>}
      </div>
    </section>

    {inventory && <InventoryActionBoard data={inventory} today={today.gte} />}
    <DashboardJarWeekActivity />
  </div>;
}

function DashboardMetric({ href, label, value }: { href: string; label: string; value: number | null }) {
  return <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className={value === null ? 'mt-2 text-sm text-muted-foreground' : 'mt-2 text-2xl font-semibold text-navy'}>
      {value ?? '暫時無法取得'}
    </p>
  </Link>;
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
