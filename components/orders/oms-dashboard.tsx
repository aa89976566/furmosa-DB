import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, PackageCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { parseOmsIssues, type OmsIssue } from '@/lib/orders/oms';
import { taiwanToday } from '@/lib/orders/oms-workbench';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { formatCurrency } from '@/lib/format';
import { orderSourceLabel, paymentStatusLabel } from '@/lib/labels';

const actionByIssue: Record<string, string> = {
  PAYMENT_PENDING: '等待付款', PAYMENT_REFUNDED: '確認退款狀態', ORDER_CANCELLED: '確認取消訂單',
  SKU_MISSING: '補上商品 SKU', PRODUCT_UNMAPPED: '選擇對應商品', STOCK_UNKNOWN: '確認商品庫存',
  STOCK_INSUFFICIENT: '處理庫存不足', SHIPPING_METHOD_UNKNOWN: '選擇配送方式',
  PICKUP_STORE_MISSING: '補上 7-11 門市', TEMPERATURE_UNKNOWN: '確認配送溫層',
  TEMPERATURE_CONFLICT: '確認常溫／冷凍配送', GIFT_REVIEW_REQUIRED: '核對贈品內容',
  RECIPIENT_MISSING: '補上收件人', PHONE_MISSING: '補上聯絡電話', ADDRESS_MISSING: '補上收件地址',
  POSSIBLE_DUPLICATE: '確認是否重複訂單', SOURCE_VERSION_UNKNOWN: '重新同步訂單', ORDER_CHANGED: '重新檢查更新內容',
};

function nextAction(status: string | null, issues: OmsIssue[] | null) {
  const issue = issues?.find((item) => item.severity === 'blocking' && item.code !== 'PAYMENT_PENDING')
    ?? issues?.find((item) => item.code !== 'PAYMENT_PENDING')
    ?? issues?.[0];
  if (issue) return actionByIssue[issue.code] ?? issue.message;
  if (status === 'READY') return '建立物流單';
  if (status === 'FULFILLMENT_PENDING') return '確認交寄狀態';
  return '確認訂單內容';
}

function isWaiting(issues: OmsIssue[] | null) {
  return Boolean(issues?.length && issues.every((issue) => issue.code === 'PAYMENT_PENDING'));
}

type WorkRow = {
  id: string; orderNumber: string; source: string; total: number; paymentStatus: string;
  shippingMethod: string; cvsStoreName: string | null; recipient: string; action: string;
  items: { productName: string }[];
};

export async function OmsDashboard() {
  const today = taiwanToday();
  const [orders, reviewedToday, fulfilledToday] = await Promise.all([
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
  ]);

  const rows = orders.map((order) => {
    const issues = parseOmsIssues(order.omsIssueFlags);
    const snapshot = snapshotView(order.shopifySnapshot);
    return {
      id: order.id, orderNumber: order.orderNumber, source: order.source, total: order.total,
      paymentStatus: order.paymentStatus, shippingMethod: order.shippingMethod,
      cvsStoreName: order.cvsStoreName, items: order.items,
      recipient: order.customer?.name || snapshot?.recipient || '收件人待確認',
      action: nextAction(order.omsStatus, issues), waiting: isWaiting(issues),
    };
  });
  const now = rows.filter((row) => !row.waiting);
  const waiting = rows.filter((row) => row.waiting);
  const completed = reviewedToday + fulfilledToday;
  const total = completed + now.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 100;
  const first = now[0];

  return <div className="space-y-6">
    <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">今天的工作</p>
          <h2 className="text-2xl font-semibold tracking-tight text-navy">{now.length ? `還有 ${now.length} 件事需要處理` : '今天的訂單工作都完成了'}</h2>
          <p className="text-sm text-muted-foreground">今天已完成 {completed} 筆；等待中的訂單不會干擾目前工作。</p>
        </div>
        {first
          ? <Button size="lg" asChild><Link href={`/orders/${first.id}`}>繼續處理<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          : <CheckCircle2 className="h-11 w-11 text-success" />}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-label={`今日工作完成 ${progress}%`}>
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress}%` }} />
      </div>
    </section>

    <WorkList title="現在處理" count={now.length} icon={<AlertCircle className="h-5 w-5 text-primary" />} rows={now.slice(0, 6)} empty="目前沒有需要立即處理的訂單" />

    {waiting.length > 0 ? <details className="rounded-2xl border border-border/70 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5 text-warning" />等待中</span>
        <span className="text-sm text-muted-foreground">{waiting.length} 筆訂單</span>
      </summary>
      <div className="border-t px-5 pb-2"><OrderRows rows={waiting.slice(0, 6)} /></div>
    </details> : null}

    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-success" /><div><h3 className="font-semibold">今天完成</h3><p className="text-sm text-muted-foreground">已完成 {completed} 筆訂單工作</p></div></div>
      <Button variant="ghost" asChild><Link href="/orders">查看所有訂單<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
    </section>
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
