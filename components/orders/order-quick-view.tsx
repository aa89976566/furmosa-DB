import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Package, ReceiptText, Truck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { canonicalProductName } from '@/lib/product-label';
import { OMS_LABELS } from '@/lib/orders/oms';
import { OrderQuickViewShell } from './order-quick-view-shell';

export async function OrderQuickView({ orderId, closeHref }: { orderId: string; closeHref: string }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      merchant: { select: { id: true, name: true, contactName: true, phone: true, address: true, city: true, preferredCarrier: true, pickupStoreName: true } },
      items: { orderBy: { id: 'asc' } },
      shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!order) notFound();

  const snapshot = snapshotView(order.shopifySnapshot);
  const name = order.customer?.name ?? snapshot?.recipient ?? order.merchant?.name ?? '收件人待確認';
  const reference = order.externalOrderName || order.orderNumber;
  const items = snapshot?.items?.length
    ? snapshot.items.map((item) => ({ name: item.title, quantity: item.quantity }))
    : order.items.map((item) => ({ name: canonicalProductName(item.productName), quantity: item.quantity }));
  const logistics = resolveLogisticsForOrderList(order);

  return <OrderQuickViewShell closeHref={closeHref}>
    <div className="min-h-full pb-28">
      <header className="border-b px-5 pb-5 pt-16 sm:px-6 sm:pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">訂單快速詳情</p>
        <h2 className="mt-2 pr-12 text-2xl font-semibold tracking-tight">{name}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{reference}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge kind="orderSource" value={order.source} />
          {order.omsStatus ? <Badge variant="secondary">{OMS_LABELS[order.omsStatus]}</Badge> : <StatusBadge kind="order" value={order.status} />}
          <StatusBadge kind="payment" value={order.paymentStatus} />
        </div>
      </header>

      <div className="space-y-4 p-5 sm:p-6">
        <section className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold"><Package className="h-4 w-4" />商品內容</h3>
          <ul className="mt-3 divide-y">
            {items.length ? items.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0">{item.name}</span><span className="shrink-0 font-semibold tabular-nums">× {item.quantity ?? '—'}</span>
            </li>) : <li className="text-sm text-muted-foreground">商品待確認</li>}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" />配送與收件</h3>
          <LogisticsSummary logistics={logistics} />
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4" />付款摘要</h3>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div><p className="text-xs text-muted-foreground">下單時間</p><p className="mt-1 text-sm">{formatDateTime(order.orderedAt)}</p></div>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(Number(order.total))}</p>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur sm:absolute sm:left-auto sm:w-[34rem]">
        <Button className="w-full" size="lg" asChild><Link href={`/orders/${order.id}`}>進入完整處理<ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
      </div>
    </div>
  </OrderQuickViewShell>;
}
