import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { formatTaipeiCalendarDate } from '@/lib/inventory/purchase-orders';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptsPage(props: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await props.searchParams;
  const pending = view === 'pending';
  const [receipts, orders] = await Promise.all([prisma.purchaseReceipt.findMany({
    include: { vendor: { select: { name: true } }, warehouse: { select: { name: true } }, items: { select: { productName: true }, orderBy: { lineNumber: 'asc' } }, _count: { select: { items: true, attachments: true } } },
    orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }], take: 200,
  }), prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt' }, include: { vendor: { select: { name: true } }, _count: { select: { items: true, attachments: true } }, items: { select: { productName: true, quantityGrams: true }, orderBy: { lineNumber: 'asc' } }, note: true }, orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'desc' }], take: 200 })]);
  return <>
    <PageHeader title="進貨紀錄" description="待收貨只保存訂購內容；已入庫才會更新庫存與平均成本" actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href="/inventory/purchase-orders/new">新增採購單</Link></Button><Button asChild><Link href="/inventory/purchases/new">新增進貨</Link></Button></div>} />
    <div className="p-4 md:p-6"><nav className="mb-4 inline-flex rounded-xl bg-muted p-1"><Link href="/inventory/purchases" className={`rounded-lg px-4 py-2 text-sm font-medium ${!pending ? 'bg-card shadow-sm' : ''}`}>已入庫</Link><Link href="/inventory/purchases?view=pending" className={`rounded-lg px-4 py-2 text-sm font-medium ${pending ? 'bg-card shadow-sm' : ''}`}>待收貨</Link></nav><Card className="divide-y overflow-hidden">
      {pending ? (orders.length ? orders.map(order => {
        const productNames = order.items.map(item => item.productName).join('、');
        const merchantFromNote = order.note?.match(/實際供應商：([^；\n]+)/)?.[1]?.trim();
        const merchant = merchantFromNote ? `蝦皮｜${merchantFromNote}` : (order.vendor?.name ?? '未指定供應商');
        return <div key={order.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold">{productNames || '尚無商品名稱'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{merchant} · {order._count.items} 項 · {order.items.reduce((sum, item) => sum + item.quantityGrams, 0).toLocaleString()} g</p>
            <p className="mt-1 text-xs text-muted-foreground">{order.orderNumber} · {formatTaipeiCalendarDate(order.remindFromDate)} 起提醒 · {order._count.attachments} 份單據</p>
          </div>
          <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
            <strong>{formatCurrency(Number(order.totalAmount))}</strong>
            <Button asChild variant="outline" size="sm"><Link href={`/inventory/purchase-orders/${order.id}`}>查看明細／收到商品</Link></Button>
          </div>
        </div>;
      }) : <p className="p-10 text-center text-muted-foreground">目前沒有待收貨採購單。</p>) : receipts.length ? receipts.map(r => <div key={r.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0"><h2 className="break-words font-semibold">{r.items.map(item => item.productName).join('、') || '已入庫商品'}</h2><p className="mt-1 text-sm text-muted-foreground">{r.vendor?.name ?? '未指定供應商'} · {r.warehouse.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.receiptNumber} · {r.receiptDate.toISOString().slice(0,10)} · {r._count.attachments} 份單據</p></div>
        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end"><strong>{formatCurrency(Number(r.totalAmount))}</strong><Button size="sm" variant="outline" asChild><Link href={`/inventory/purchases/${r.id}`}>查看入庫明細</Link></Button></div>
      </div>) : <p className="p-10 text-center text-muted-foreground">尚無進貨紀錄。</p>}
    </Card><p className="mt-3 text-xs text-muted-foreground">顯示時間：{formatDateTime(new Date())}</p></div>
  </>;
}
