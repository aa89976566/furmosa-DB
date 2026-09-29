import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PurchaseReceiptsPage() {
  const receipts = await prisma.purchaseReceipt.findMany({
    include: { vendor: { select: { name: true } }, warehouse: { select: { name: true } }, _count: { select: { items: true, attachments: true } } },
    orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }], take: 200,
  });
  return <>
    <PageHeader title="進貨紀錄" description="每次進貨的實收重量、單據、費用分攤與成本更新" actions={<Button asChild><Link href="/inventory/purchases/new">新增進貨</Link></Button>} />
    <div className="p-4 md:p-6"><Card className="divide-y overflow-hidden">
      {receipts.length ? receipts.map(r => <Link key={r.id} href={`/inventory/purchases/${r.id}`} className="grid gap-2 p-4 hover:bg-muted/40 md:grid-cols-[180px_1fr_160px_160px] md:items-center">
        <div><p className="font-mono text-sm font-semibold">{r.receiptNumber}</p><p className="text-xs text-muted-foreground">{r.receiptDate.toISOString().slice(0,10)}</p></div>
        <div><p className="font-medium">{r.vendor?.name ?? '未指定供應商'}</p><p className="text-sm text-muted-foreground">{r.supplierDocumentNumber ?? '無供應商單號'} · {r.warehouse.name}</p></div>
        <p className="text-sm">{r._count.items} 項 · {r._count.attachments} 份單據</p>
        <p className="font-semibold md:text-right">{formatCurrency(Number(r.totalAmount))}</p>
      </Link>) : <p className="p-10 text-center text-muted-foreground">尚無進貨紀錄。</p>}
    </Card><p className="mt-3 text-xs text-muted-foreground">顯示時間：{formatDateTime(new Date())}</p></div>
  </>;
}
