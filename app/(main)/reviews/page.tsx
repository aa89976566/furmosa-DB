import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { activeOrderWhere } from '@/lib/order-list';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { PageHeader } from '@/components/shared/page-header';
import { loadReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';
import { ArchiveOlderOrdersForm } from '@/components/orders/archive-older-orders-form';
import { ReviewResourceList } from '@/components/reviews/review-resource-list';

export const dynamic = 'force-dynamic';

export default async function ReviewInboxPage() {
  const pendingWhere = {
    type: 'customer_order',
    status: { in: ['pending', 'packed'] },
    order: { ...activeOrderWhere, omsStatus: 'FULFILLMENT_PENDING' as const },
  };
  const [inbox, pendingShipments, pendingShipmentCount] = await Promise.all([
    loadReviewInbox(),
    prisma.shipment.findMany({
      where: pendingWhere,
      select: {
        id: true,
        order: { select: { id: true, orderNumber: true, externalOrderName: true, shopifySnapshot: true } },
        items: { select: { id: true, productName: true, quantity: true, weightGrams: true, notes: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 12,
    }),
    prisma.shipment.count({ where: pendingWhere }),
  ]);
  const { items, counts } = inbox;
  const total = reviewInboxTotal(counts);

  return (
    <>
      <PageHeader
        tone="operations"
        title="待審核"
        description="店家合作申請、訂單、UGC 與補貨申請集中在這裡；每一列直接顯示現在要做什麼。"
      />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">待處理 {total}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">訂單 {counts.shopify_order}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">UGC {counts.ugc}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">補貨 {counts.restock}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">店家合作 {counts.partner}</span>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">管理</summary>
            <div className="absolute right-0 top-7 z-30 w-[min(90vw,24rem)] rounded-xl border bg-card p-3 shadow-lg"><ArchiveOlderOrdersForm /></div>
          </details>
        </div>
        {counts.shopify_order === 0 ? <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-semibold">目前沒有待審核訂單</p>
          <p className="mt-1 text-muted-foreground">已確認的訂單會移到待出貨，請從下方清單繼續處理。</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link href="/shipments?status=pending" className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-4 font-medium text-background">查看待出貨{pendingShipmentCount ? `（${pendingShipmentCount}）` : ''}</Link><Link href="/orders?work=all" className="inline-flex min-h-10 items-center rounded-lg border px-4 font-medium">查找訂單</Link></div>
        </div> : null}
        <ReviewResourceList items={items} />
        {pendingShipments.length > 0 ? <section className="space-y-3" aria-label="已審核待出貨訂單">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">已審核・待出貨 {pendingShipmentCount}</h2><Link href="/shipments?status=pending" className="text-sm underline underline-offset-4">查看全部出貨單</Link></div>
          <p className="text-sm text-muted-foreground">這些訂單已完成審核，接下來核對品項與安排出貨。</p>
          <ul className="space-y-3">{pendingShipments.map(shipment => {
            const source = snapshotView(shipment.order?.shopifySnapshot);
            return <li key={shipment.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/orders/${shipment.order!.id}`} className="font-semibold underline-offset-4 hover:underline">{shipment.order!.externalOrderName || source?.name || shipment.order!.orderNumber}</Link><Link href={`/shipments?status=pending&s=${encodeURIComponent(shipment.id)}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium">開啟出貨單</Link></div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{shipment.items.map(item => <li key={item.id}><p>{item.productName}{item.weightGrams ? ` ${item.weightGrams}g` : ''} ×{item.quantity}</p>{item.notes ? <p className="text-xs">揀貨內容：{item.notes}</p> : null}</li>)}</ul>
            </li>;
          })}</ul>
          {pendingShipmentCount > pendingShipments.length ? <p className="text-xs text-muted-foreground">此處顯示最近 12 筆，其他請至出貨清單查看。</p> : null}
        </section> : null}
      </div>
    </>
  );
}
