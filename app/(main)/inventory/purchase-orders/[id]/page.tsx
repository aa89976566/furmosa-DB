import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/format';
import { confirmPurchaseOrderReceipt } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: {
    vendor: { select: { name: true } }, warehouse: { select: { name: true } }, receipt: { select: { id: true } },
    items: { orderBy: { lineNumber: 'asc' } }, attachments: { select: { id: true, fileName: true, sizeBytes: true } },
  } });
  if (!order) notFound();
  const pending = order.status === 'pending_receipt';
  return <>
    <PageHeader title={`採購單 ${order.orderNumber}`} description={`${order.vendor?.name ?? '未指定供應商'} · ${order.warehouse.name}`} actions={<Button variant="outline" asChild><Link href="/inventory/purchases?view=pending">返回待收貨</Link></Button>} />
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      {query.created ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">採購單已建立；庫存與平均成本尚未變更。</p> : null}
      {query.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{query.error}</p> : null}
      <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant={pending ? 'warning' : 'success'}>{pending ? '尚未入庫' : '已入庫'}</Badge><h2 className="mt-3 text-xl font-semibold">{order.supplierDocumentNumber ?? '無供應商單號'}</h2><p className="mt-1 text-sm text-muted-foreground">提醒日：{order.remindFromDate.toISOString().slice(0,10)}</p></div><div className="text-right"><p className="text-sm text-muted-foreground">採購總額</p><p className="text-2xl font-semibold">{formatCurrency(Number(order.totalAmount))}</p></div></div><p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{pending ? '確認商品實際到貨後，才能更新庫存與移動平均成本。' : '這張採購單已完成實收入庫。'}</p></Card>
      <Card className="overflow-hidden"><div className="border-b p-5"><h2 className="font-semibold">本次應收商品</h2></div><form action={confirmPurchaseOrderReceipt}><input type="hidden" name="purchaseOrderId" value={order.id} /><div className="divide-y">{order.items.map(item => <label key={item.id} className="grid cursor-pointer gap-3 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"><input name="confirmedLine" value={item.id} type="checkbox" disabled={!pending} className="h-5 w-5 accent-primary" /><span><span className="font-medium">{item.productName}</span><span className="block text-xs text-muted-foreground">{item.sku}</span></span><span>{formatNumber(item.quantityGrams)} g</span><span className="font-medium">{formatCurrency(Number(item.rawAmount))}</span></label>)}</div><div className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">請逐項核對品項、重量與金額。首版僅支援整張完整到貨。</p>{pending ? <Button size="lg" type="submit">確認實收並入庫</Button> : order.receipt ? <Button variant="outline" asChild><Link href={`/inventory/purchases/${order.receipt.id}`}>查看入庫紀錄</Link></Button> : null}</div></form></Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card className="space-y-3 p-5"><h2 className="font-semibold">單據附件</h2>{order.attachments.length ? order.attachments.map(file => <Button key={file.id} variant="outline" className="w-full justify-between" asChild><a href={`/inventory/purchase-orders/${order.id}/attachments/${file.id}`} target="_blank" rel="noreferrer"><span className="truncate">{file.fileName}</span><span>{Math.ceil(file.sizeBytes/1024)} KB</span></a></Button>) : <p className="text-sm text-muted-foreground">未上傳單據。</p>}</Card><Card className="p-5"><h2 className="font-semibold">備註</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{order.note ?? '—'}</p></Card></div>
    </div>
  </>;
}
