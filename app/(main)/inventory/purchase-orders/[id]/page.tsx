import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { formatPurchaseMoney, purchaseLineReceived } from '@/lib/inventory/purchase-presentation';
import { confirmPurchaseOrderReceipt, uploadPurchaseOrderAttachment } from '../actions';
import { formatTaipeiCalendarDate } from '@/lib/inventory/purchase-orders';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string; uploaded?: string; submissionKey?: string }> }) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: {
    vendor: { select: { name: true } }, warehouse: { select: { name: true } }, receipt: { include: { items: true } }, receipts: { include: { items: true } },
    items: { orderBy: { lineNumber: 'asc' } }, attachments: { select: { id: true, fileName: true, sizeBytes: true } },
  } });
  if (!order) notFound();
  const pending = order.status === 'pending_receipt';
  const receipts = [...new Map([...(order.receipt ? [order.receipt] : []), ...order.receipts].map(r => [r.id,r])).values()];
  const received = (item: typeof order.items[number]) => purchaseLineReceived(order.id, item, receipts);

  return <>
    <PageHeader title={`採購單 ${order.orderNumber}`} description={`${order.vendor?.name ?? '未指定供應商'} · ${order.warehouse.name}`} actions={<Button variant="outline" asChild><Link href="/inventory/purchases?view=pending">返回待收貨</Link></Button>} />
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      {query.created && receipts.length === 0 && pending ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">採購單已建立；庫存與平均成本尚未變更。</p> : null}
      {query.uploaded ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium">單據照片已儲存。</p> : null}
      {query.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{query.error}</p> : null}
      <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant={pending ? 'warning' : 'success'}>{pending ? receipts.length ? '部分到貨' : '尚未入庫' : order.status === 'received' ? '已入庫' : '已作廢'}</Badge><h2 className="mt-3 text-xl font-semibold">{order.supplierDocumentNumber ?? '無供應商單號'}</h2><p className="mt-1 text-sm text-muted-foreground">提醒日：{formatTaipeiCalendarDate(order.remindFromDate)}</p></div><div className="text-right"><p className="text-sm text-muted-foreground">採購總額</p><p className="text-2xl font-semibold">{formatPurchaseMoney(Number(order.totalAmount))}</p></div></div><p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{pending ? '確認商品實際到貨後，才能更新庫存與移動平均成本。' : '這張採購單已完成實收入庫。'}</p></Card>
      <Card className="overflow-hidden"><div className="border-b p-5"><h2 className="font-semibold">本次收貨</h2><p className="text-sm text-muted-foreground">只填本次實際收到的數量，未到貨留空。</p></div>
        <form action={confirmPurchaseOrderReceipt}>
          <input type="hidden" name="purchaseOrderId" value={order.id} /><input type="hidden" name="submissionKey" value={query.submissionKey && /^[0-9a-f-]{36}$/i.test(query.submissionKey) ? query.submissionKey : randomUUID()} />
          <div className="divide-y">{order.items.map(item => { const done = received(item); const remaining = item.quantityGrams-done; return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><p className="font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.sku}</p><p className="mt-2 text-sm">訂購 {formatNumber(item.quantityGrams)} g · 已收 {formatNumber(done)} g · 剩餘 {formatNumber(remaining)} g</p></div>
            {pending && remaining > 0 ? <label className="text-sm">本次實收（g）<input type="hidden" name="lineId" value={item.id} /><input aria-label={`${item.productName}本次實收克數`} name="receivedGrams" type="number" min="0" max={remaining} step="1" placeholder="未到貨留空" className="mt-1 block w-full rounded-md border bg-background px-3 py-2 sm:w-40" /></label> : <span className="text-sm text-muted-foreground">{remaining === 0 ? '已收齊' : '不可收貨'}</span>}
          </div>; })}</div>
          {pending ? <div className="border-t p-5"><Button size="lg" type="submit">確認本次實收並入庫</Button></div> : null}
        </form>
      </Card>
      {receipts.length ? <Card className="space-y-3 p-5"><h2 className="font-semibold">收貨紀錄</h2>{receipts.map(receipt => <Link key={receipt.id} className="block text-primary underline" href={`/inventory/purchases/${receipt.id}`}>{receipt.receiptNumber}</Link>)}</Card> : null}

      <div className="grid gap-5 lg:grid-cols-2"><Card className="space-y-3 p-5"><h2 className="font-semibold">單據附件</h2>{order.attachments.length ? order.attachments.map(file => <Button key={file.id} variant="outline" className="w-full justify-between" asChild><a href={`/inventory/purchase-orders/${order.id}/attachments/${file.id}`} target="_blank" rel="noreferrer"><span className="truncate">{file.fileName}</span><span>{Math.ceil(file.sizeBytes/1024)} KB</span></a></Button>) : <p className="text-sm text-muted-foreground">未上傳單據。</p>}
        {pending ? <form action={uploadPurchaseOrderAttachment} encType="multipart/form-data" className="space-y-2 border-t pt-3">
          <input type="hidden" name="purchaseOrderId" value={order.id} />
          <label className="block text-sm font-medium" htmlFor="purchase-order-attachments">補上訂單照片／單據</label>
          <input id="purchase-order-attachments" name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple required className="block w-full text-sm" />
          <p className="text-xs text-muted-foreground">最多 3 份，每份不超過 5MB；上傳不會影響庫存。</p>
          <Button type="submit" variant="outline">上傳照片</Button>
        </form> : null}</Card><Card className="p-5"><h2 className="font-semibold">備註</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{order.note ?? '—'}</p></Card></div>
    </div>
  </>;
}
