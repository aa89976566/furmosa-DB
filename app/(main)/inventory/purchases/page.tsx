import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptsPage(props: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await props.searchParams;
  const pending = view === 'pending';
  const [receipts, orders] = await Promise.all([prisma.purchaseReceipt.findMany({
    include: { vendor: { select: { name: true } }, warehouse: { select: { name: true } }, _count: { select: { items: true, attachments: true } } },
    orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }], take: 200,
  }), prisma.purchaseOrder.findMany({ where: { status: 'pending_receipt' }, include: { vendor: { select: { name: true } }, _count: { select: { items: true, attachments: true } }, items: { select: { quantityGrams: true } } }, orderBy: [{ remindFromDate: 'asc' }, { createdAt: 'desc' }], take: 200 })]);
  return <>
    <PageHeader title="進貨紀錄" description="待收貨只保存訂購內容；已入庫才會更新庫存與平均成本" actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href="/inventory/purchase-orders/new">新增採購單</Link></Button><Button asChild><Link href="/inventory/purchases/new">新增進貨</Link></Button></div>} />
    <div className="p-4 md:p-6"><nav className="mb-4 inline-flex rounded-xl bg-muted p-1"><Link href="/inventory/purchases" className={`rounded-lg px-4 py-2 text-sm font-medium ${!pending ? 'bg-card shadow-sm' : ''}`}>已入庫</Link><Link href="/inventory/purchases?view=pending" className={`rounded-lg px-4 py-2 text-sm font-medium ${pending ? 'bg-card shadow-sm' : ''}`}>待收貨</Link></nav><Card className="divide-y overflow-hidden">
      {pending ? (orders.length ? orders.map(order => <Link key={order.id} href={`/inventory/purchase-orders/${order.id}`} className="grid gap-2 p-4 hover:bg-muted/40 md:grid-cols-[180px_1fr_180px_160px] md:items-center"><div><p className="font-mono text-sm font-semibold">{order.orderNumber}</p><p className="text-xs text-warning">{order.remindFromDate.toISOString().slice(0,10)} 起提醒</p></div><div><p className="font-medium">{order.vendor?.name ?? '未指定供應商'}</p><p className="text-sm text-muted-foreground">{order.supplierDocumentNumber ?? '無供應商單號'} · 尚未入庫</p></div><p className="text-sm">{order._count.items} 項 · {order.items.reduce((sum, item) => sum + item.quantityGrams, 0).toLocaleString()} g · {order._count.attachments} 份單據</p><p className="font-semibold md:text-right">{formatCurrency(Number(order.totalAmount))}</p></Link>) : <p className="p-10 text-center text-muted-foreground">目前沒有待收貨採購單。</p>) : receipts.length ? receipts.map(r => <Link key={r.id} href={`/inventory/purchases/${r.id}`} className="grid gap-2 p-4 hover:bg-muted/40 md:grid-cols-[180px_1fr_160px_160px] md:items-center">
        <div><p className="font-mono text-sm font-semibold">{r.receiptNumber}</p><p className="text-xs text-muted-foreground">{r.receiptDate.toISOString().slice(0,10)}</p></div>
        <div><p className="font-medium">{r.vendor?.name ?? '未指定供應商'}</p><p className="text-sm text-muted-foreground">{r.supplierDocumentNumber ?? '無供應商單號'} · {r.warehouse.name}</p></div>
        <p className="text-sm">{r._count.items} 項 · {r._count.attachments} 份單據</p>
        <p className="font-semibold md:text-right">{formatCurrency(Number(r.totalAmount))}</p>
      </Link>) : <p className="p-10 text-center text-muted-foreground">尚無進貨紀錄。</p>}
    </Card><p className="mt-3 text-xs text-muted-foreground">顯示時間：{formatDateTime(new Date())}</p></div>
  </>;
}
