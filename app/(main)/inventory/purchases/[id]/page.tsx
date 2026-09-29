import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; received?: string }> }) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const receipt = await prisma.purchaseReceipt.findUnique({ where: { id }, include: {
    vendor: { select: { name: true } }, warehouse: { select: { name: true } }, createdBy: { select: { name: true } },
    items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'asc' } },
    attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
  } });
  if (!receipt) notFound();
  return <>
    <PageHeader title={`進貨單 ${receipt.receiptNumber}`} description={`${receipt.vendor?.name ?? '未指定供應商'} · ${receipt.warehouse.name}`} actions={<Button variant="outline" asChild><Link href="/inventory/purchases">返回進貨紀錄</Link></Button>} />
    <div className="space-y-5 p-4 md:p-6">
      {query.created ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">進貨已完成，庫存與平均成本已同步更新。</p> : null}
      {query.received ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">實收已確認，庫存與平均成本只更新一次。</p> : null}
      <Card className="grid gap-4 p-5 md:grid-cols-4"><div><p className="text-xs text-muted-foreground">進貨日期</p><p className="font-medium">{receipt.receiptDate.toISOString().slice(0,10)}</p></div><div><p className="text-xs text-muted-foreground">供應商單號</p><p className="font-medium">{receipt.supplierDocumentNumber ?? '—'}</p></div><div><p className="text-xs text-muted-foreground">入庫人員</p><p className="font-medium">{receipt.createdBy.name}</p></div><div><p className="text-xs text-muted-foreground">入庫時間</p><p className="font-medium">{formatDateTime(receipt.postedAt)}</p></div></Card>
      <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-muted/40 text-left"><tr>{['商品','實收','原料金額','費用分攤','到岸成本','本批成本/g','原平均/g','新平均/g','入庫後'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y">{receipt.items.map(item => <tr key={item.id}><td className="p-3 font-medium">{item.product.name}<span className="block text-xs text-muted-foreground">{item.product.sku}</span></td><td className="p-3">{formatNumber(item.quantityGrams)}g</td><td className="p-3">{formatCurrency(Number(item.rawAmount))}</td><td className="p-3">{formatCurrency(Number(item.allocatedCost))}</td><td className="p-3">{formatCurrency(Number(item.landedAmount))}</td><td className="p-3">NT${Number(item.costPerGram).toFixed(4)}</td><td className="p-3">NT${Number(item.previousAverageCostPerGram).toFixed(4)}</td><td className="p-3 font-semibold">NT${Number(item.newAverageCostPerGram).toFixed(4)}</td><td className="p-3">{formatNumber(item.resultingStockGrams)}g</td></tr>)}</tbody></table></Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card className="space-y-2 p-5"><h2 className="font-semibold">費用摘要</h2>{[['商品小計',receipt.subtotal],['運費',receipt.shippingCost],['包材費',receipt.packagingCost],['加工費',receipt.processingCost],['稅額',receipt.taxAmount],['折扣',Number(receipt.discountAmount) * -1],['本次總成本',receipt.totalAmount]].map(([label,value]) => <div key={String(label)} className="flex justify-between border-b py-2 last:border-0"><span>{String(label)}</span><span className="font-medium">{formatCurrency(Number(value))}</span></div>)}</Card><Card className="space-y-3 p-5"><h2 className="font-semibold">單據附件</h2>{receipt.attachments.length ? receipt.attachments.map(file => <Button key={file.id} variant="outline" className="w-full justify-between" asChild><a href={`/inventory/purchases/${receipt.id}/attachments/${file.id}`} target="_blank" rel="noreferrer"><span className="truncate">{file.fileName}</span><span>{Math.ceil(file.sizeBytes/1024)} KB</span></a></Button>) : <p className="text-sm text-muted-foreground">本次未上傳單據。</p>}</Card></div>
      {receipt.note ? <Card className="p-5"><h2 className="font-semibold">備註</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{receipt.note}</p></Card> : null}
    </div>
  </>;
}
