import { fillReceiptMetadata } from '../metadata-actions';
import { FormSubmitButton } from '@/components/shared/form-submit-button';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { metadataHistoryLines, metadataSnapshot } from '@/lib/inventory/metadata-history';
import { formatPurchaseMoney, formatPurchaseDate, formatPurchaseTime } from '@/lib/inventory/purchase-presentation';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; received?: string; metadataSaved?: string; metadataUnchanged?: string; metadataError?: string }> }) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const receipt = await prisma.purchaseReceipt.findUnique({ where: { id }, include: {
    sourceOrder: { select: { id: true, orderNumber: true, supplierDocumentNumber: true } },
    vendor: { select: { name: true } }, warehouse: { select: { name: true } }, createdBy: { select: { name: true } },
    items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'asc' } },
    attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
  } });
  if (!receipt) notFound();
  const user = await getCurrentUser();
  const canFill = !!user && ['admin','warehouse','finance'].includes(user.role);
  const vendors = canFill && !receipt.vendorId ? await prisma.vendor.findMany({ where: { status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [];
  const changeRows = await prisma.purchaseReceiptMetadataChange.findMany({ where: { receiptId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
  const changes = changeRows.slice(0, 20);
  const vendorIds = [...new Set(changes.flatMap(change => [metadataSnapshot(change.before).vendorId, metadataSnapshot(change.after).vendorId]).filter((value): value is string => value !== null))];
  const historyVendors = vendorIds.length ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } }) : [];
  const vendorNames = new Map(historyVendors.map(vendor => [vendor.id, vendor.name]));
  return <>
    <PageHeader title={`進貨單 ${receipt.receiptNumber}`} description={`${receipt.vendor?.name ?? '未指定供應商'} · ${receipt.warehouse.name}`} actions={<Button variant="outline" asChild><Link href="/inventory/purchases">返回進貨紀錄</Link></Button>} />
    <div className="space-y-5 p-4 md:p-6">
      {query.metadataUnchanged ? <p role="status">沒有新增資料，原有資料保持不變。</p> : null}
      {query.metadataSaved ? <p role="status">資料已儲存，庫存數量不變。</p> : null}
      {query.metadataError ? <p role="alert">補填未完成，請重新整理確認資料；可能有同時更新或廠商單號重複。</p> : null}
      {canFill && (!receipt.vendorId || !receipt.receiptDate) ? <Card className="p-5 space-y-3">
        <h2 className="font-semibold">補齊進貨資料</h2>
        <form action={fillReceiptMetadata} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="receiptId" value={id} />
          {!receipt.vendorId ? <label>廠商<select name="vendorId" className="block w-full rounded-md border p-2"><option value="">待補</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label> : null}
          {!receipt.receiptDate ? <label>實際進貨日期<input type="date" name="receiptDate" className="block w-full rounded-md border p-2" /></label> : null}
          <div><FormSubmitButton>儲存補填資料</FormSubmitButton></div>
        </form>
      </Card> : null}
      {changes.length ? <Card className="p-5"><h2 className="font-semibold">補資料紀錄</h2><p className="mt-1 text-xs text-muted-foreground">時間為台灣時間；廠商名稱依目前廠商資料顯示。</p><ol className="mt-3 divide-y">{changes.map(change => <li key={change.id} className="py-3 text-sm"><p className="font-medium">{change.actorName} · {formatPurchaseTime(change.createdAt)}</p><dl className="mt-2 space-y-2">{metadataHistoryLines(change.before, change.after, vendorNames).map(line => <div key={line.label} className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)]"><dt className="text-muted-foreground">{line.label}</dt><dd className="break-words"><span>修改前：{line.before}</span><span className="block">修改後：{line.after}</span></dd></div>)}</dl></li>)}</ol>{changeRows.length > 20 ? <p className="mt-2 text-xs text-muted-foreground">顯示最近 20 筆補填紀錄。</p> : null}</Card> : null}

      {query.created ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">進貨已完成，庫存與平均成本已同步更新。</p> : null}
      {query.received ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">實收已確認，庫存與平均成本只更新一次。</p> : null}
      {receipt.sourceOrder ? <p className="text-sm">來源進貨單：<Link className="text-primary underline" href={`/inventory/purchase-orders/${receipt.sourceOrder.id}`}>{receipt.sourceOrder.orderNumber}</Link></p> : null}
      <Card className="grid gap-4 p-5 md:grid-cols-4"><div><p className="text-xs text-muted-foreground">進貨日期</p><p className="font-medium">{formatPurchaseDate(receipt.receiptDate)}</p></div><div><p className="text-xs text-muted-foreground">供應商單號</p><p className="font-medium">{receipt.supplierDocumentNumber ?? receipt.sourceOrder?.supplierDocumentNumber ?? '—'}</p></div><div><p className="text-xs text-muted-foreground">入庫人員</p><p className="font-medium">{receipt.createdBy.name}</p></div><div><p className="text-xs text-muted-foreground">入庫時間（台灣）</p><p className="font-medium">{formatPurchaseTime(receipt.postedAt)}</p></div></Card>
      <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-muted/40 text-left"><tr>{['商品','實收','原料金額','費用分攤','到岸成本','本批成本/g','原平均/g','新平均/g','入庫後'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y">{receipt.items.map(item => <tr key={item.id}><td className="p-3 font-medium">{item.product.name}<span className="block text-xs text-muted-foreground">{item.product.sku}</span></td><td className="p-3">{formatNumber(item.quantityGrams)}g</td><td className="p-3">{formatPurchaseMoney(Number(item.rawAmount))}</td><td className="p-3">{formatPurchaseMoney(Number(item.allocatedCost))}</td><td className="p-3">{formatPurchaseMoney(Number(item.landedAmount))}</td><td className="p-3">NT${Number(item.costPerGram).toFixed(4)}</td><td className="p-3">NT${Number(item.previousAverageCostPerGram).toFixed(4)}</td><td className="p-3 font-semibold">NT${Number(item.newAverageCostPerGram).toFixed(4)}</td><td className="p-3">{formatNumber(item.resultingStockGrams)}g</td></tr>)}</tbody></table></Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card className="space-y-2 p-5"><h2 className="font-semibold">費用摘要</h2>{[['商品小計',receipt.subtotal],['運費',receipt.shippingCost],['包材費',receipt.packagingCost],['加工費',receipt.processingCost],['稅額',receipt.taxAmount],['折扣',Number(receipt.discountAmount) * -1],['本次總成本',receipt.totalAmount]].map(([label,value]) => <div key={String(label)} className="flex justify-between border-b py-2 last:border-0"><span>{String(label)}</span><span className="font-medium">{formatPurchaseMoney(Number(value))}</span></div>)}</Card><Card className="space-y-3 p-5"><h2 className="font-semibold">單據附件</h2>{receipt.attachments.length ? receipt.attachments.map(file => <Button key={file.id} variant="outline" className="w-full justify-between" asChild><a href={`/inventory/purchases/${receipt.id}/attachments/${file.id}`} target="_blank" rel="noreferrer"><span className="truncate">{file.fileName}</span><span>{Math.ceil(file.sizeBytes/1024)} KB</span></a></Button>) : <p className="text-sm text-muted-foreground">本次未上傳單據。</p>}</Card></div>
      {receipt.note ? <Card className="p-5"><h2 className="font-semibold">備註</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{receipt.note}</p></Card> : null}
    </div>
  </>;
}
