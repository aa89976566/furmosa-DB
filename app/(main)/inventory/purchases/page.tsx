import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPurchaseMoney, formatPurchaseDate, formatPurchaseTime, purchaseLineReceived } from '@/lib/inventory/purchase-presentation';
import { formatTaipeiCalendarDate } from '@/lib/inventory/purchase-orders';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptsPage(props: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const { view, page: pageValue } = await props.searchParams;
  const missing = view === 'missing';
  const parsedPage = Number(pageValue);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 100000 ? parsedPage : 1;
  const pageSize = 50;
  const pending = view === 'pending';
  const [receiptRows, orders] = await Promise.all([prisma.purchaseReceipt.findMany({
    where: missing ? { OR: [{ vendorId: null }, { receiptDate: null }] } : undefined,
    include: { vendor: { select: { name: true } }, warehouse: { select: { name: true } }, items: { select: { product: { select: { name: true } } } }, _count: { select: { items: true, attachments: true } } },
    orderBy: missing ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ receiptDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    skip: missing ? (page - 1) * pageSize : undefined,
    take: missing ? pageSize + 1 : 200,
  }), prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt' }, include: { vendor: { select: { name: true } }, _count: { select: { items: true, attachments: true } }, receipt: { select: { id: true, purchaseOrderId: true, items: { select: { productId: true, quantityGrams: true, sourceOrderItemId: true } } } }, receipts: { select: { id: true, purchaseOrderId: true, items: { select: { productId: true, quantityGrams: true, sourceOrderItemId: true } } } }, items: { select: { id: true, productId: true, productName: true, quantityGrams: true }, orderBy: { lineNumber: 'asc' } } }, orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'desc' }], take: 200 })]);
  const hasNextPage = missing && receiptRows.length > pageSize;
  const receipts = missing ? receiptRows.slice(0, pageSize) : receiptRows;
  return <>
    <PageHeader title="進貨紀錄" description="待收貨只保存訂購內容；已入庫才會更新庫存與平均成本" actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href="/inventory">返回庫存</Link></Button><Button asChild><Link href="/inventory/new">新增進貨</Link></Button></div>} />
    <div className="p-4 md:p-6"><nav aria-label="進貨狀態" className="mb-4 flex flex-wrap gap-1 rounded-xl bg-muted p-1 w-fit"><Link href="/inventory/purchases" className={`rounded-lg px-4 py-2 text-sm font-medium ${!pending && !missing ? 'bg-card shadow-sm' : ''}`}>已入庫</Link><Link href="/inventory/purchases?view=pending" className={`rounded-lg px-4 py-2 text-sm font-medium ${pending ? 'bg-card shadow-sm' : ''}`}>待收貨</Link><Link href="/inventory/purchases?view=missing" aria-current={missing ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${missing ? 'bg-card shadow-sm' : ''}`}>待補資料</Link></nav>{missing ? <p className="mb-4 text-sm text-muted-foreground">廠商或實際進貨日期未填的入庫單，依建立時間由舊到新排列。補填不會再次增加庫存。</p> : null}<Card className="divide-y overflow-hidden">
      {pending ? (orders.length ? orders.map(order => {
        const batchReceipts = [...(order.receipt ? [order.receipt] : []), ...order.receipts];
        const ordered = order.items.reduce((sum,item) => sum+item.quantityGrams,0);
        const received = order.items.reduce((sum,item) => sum+purchaseLineReceived(order.id,item,batchReceipts),0);
        const isYizhaoOrder = order.note?.includes('億兆食品網路官方商店') && order.items.length === 1 && order.items[0]?.quantityGrams === 1000;
        const productNames = isYizhaoOrder ? '烘烤豬耳朵切條 1000g' : order.items.map(item => item.productName).join('、');
        const merchantFromNote = order.note?.match(/實際供應商：([^；\n]+)/)?.[1]?.trim();
        const merchant = merchantFromNote ? `蝦皮｜${merchantFromNote}` : (order.vendor?.name ?? '未指定供應商');
        return <div key={order.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold">{productNames || '尚無商品名稱'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{merchant} · {order._count.items} 項 · 訂購 {ordered.toLocaleString()} g · 已收 {received.toLocaleString()} g · 待收 {Math.max(0,ordered-received).toLocaleString()} g</p>
            <p className="mt-1 text-xs text-muted-foreground">{order.orderNumber} · {formatTaipeiCalendarDate(order.remindFromDate)} 起提醒 · {order._count.attachments} 份單據</p>
          </div>
          <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
            <strong>{formatPurchaseMoney(Number(order.totalAmount))}</strong>
            <Button asChild variant="outline" size="sm"><Link href={`/inventory/purchase-orders/${order.id}`}>查看明細／收到商品</Link></Button>
          </div>
        </div>;
      }) : <p className="p-10 text-center text-muted-foreground">目前沒有待收貨採購單。</p>) : receipts.length ? receipts.map(r => <div key={r.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0"><h2 className="break-words font-semibold">{r.items.map(item => item.product.name).join('、') || '已入庫商品'}</h2><p className="mt-1 text-sm text-muted-foreground">{r.vendor?.name ?? '廠商待補'} · {r.warehouse.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.receiptNumber} · {formatPurchaseDate(r.receiptDate)} · {r._count.attachments} 份單據</p>{!r.vendorId || !r.receiptDate ? <p className="mt-1 text-sm font-medium text-primary">待補：{[!r.vendorId ? '廠商' : null, !r.receiptDate ? '進貨日期' : null].filter(Boolean).join('、')}</p> : null}</div>
        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end"><strong>{formatPurchaseMoney(Number(r.totalAmount))}</strong><Button size="sm" variant="outline" asChild><Link href={`/inventory/purchases/${r.id}`}>{missing ? '查看／補填資料' : '查看入庫明細'}</Link></Button></div>
      </div>) : <p className="p-10 text-center text-muted-foreground">{missing ? '目前沒有待補資料的入庫單。' : '尚無進貨紀錄。'}</p>}
    </Card>{missing ? <nav aria-label="待補資料分頁" className="mt-4 flex flex-wrap items-center gap-3">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={`/inventory/purchases?view=missing&page=${page-1}`}>上一頁</Link></Button> : null}<span className="text-sm">第 {page} 頁</span>{hasNextPage ? <Button asChild variant="outline" size="sm"><Link href={`/inventory/purchases?view=missing&page=${page+1}`}>下一頁</Link></Button> : null}</nav> : null}<p className="mt-3 text-xs text-muted-foreground">顯示時間（台灣）：{formatPurchaseTime(new Date())}</p></div>
  </>;
}
