import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MerchantSection, MerchantStat, MerchantStatGrid, MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { PackagePlus, ShoppingCart, Truck } from 'lucide-react';
import { shipmentStatusLabel, shipmentStatusVariant } from '@/lib/shipment';

export const dynamic = 'force-dynamic';

const requestStatusLabel: Record<string, string> = {
  draft: '草稿', submitted: '待核准', under_review: '審核中', approved: '已核准',
  rejected: '已拒絕', converted_to_shipment: '已建立出貨單', cancelled: '已取消',
};

export default async function MerchantOrdersAndShipmentsPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!merchant) notFound();

  const [requests, orders, shipments] = await Promise.all([
    prisma.restockRequest.findMany({ where: { merchantId: merchant.id }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.order.findMany({ where: { merchantId: merchant.id }, include: { shipments: { select: { id: true } } }, orderBy: { orderedAt: 'desc' }, take: 30 }),
    prisma.shipment.findMany({ where: { merchantId: merchant.id }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);

  const awaitingApproval = requests.filter((row) => ['submitted', 'under_review'].includes(row.status)).length;
  const preparing = shipments.filter((row) => ['pending', 'packed'].includes(row.status)).length;
  const inTransit = shipments.filter((row) => row.status === 'shipped').length;

  return (
    <MerchantWorkspace>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-navy">訂單與出貨</h2><p className="mt-1 text-sm text-muted-foreground">補貨申請、店家訂單與 HQ 出貨使用同一份正式資料。</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/merchants/${merchant.id}/sale`}><ShoppingCart className="mr-1.5 h-4 w-4" />建立店家訂單</Link></Button>
          <Button size="sm" asChild><Link href={`/merchants/${merchant.id}/restock`}><PackagePlus className="mr-1.5 h-4 w-4" />建立補貨</Link></Button>
        </div>
      </div>

      <MerchantStatGrid>
        <MerchantStat label="待核准申請" value={awaitingApproval} suffix="筆" tone={awaitingApproval ? 'warning' : 'default'} />
        <MerchantStat label="備貨中" value={preparing} suffix="筆" />
        <MerchantStat label="運送中" value={inTransit} suffix="筆" />
      </MerchantStatGrid>

      <MerchantSection title={`補貨申請（最近 ${requests.length} 筆）`} description="核准後由同一筆申請連結正式出貨單" contentClassName="px-0 py-0">
        {requests.length === 0 ? <CompactEmpty text="目前沒有補貨申請" /> : <Table><TableHeader><TableRow><TableHead>申請時間</TableHead><TableHead>申請方式</TableHead><TableHead>狀態</TableHead><TableHead className="text-right">品項／數量</TableHead></TableRow></TableHeader><TableBody>{requests.map((row) => <TableRow key={row.id}><TableCell><Link href={`/restock-requests/${row.id}`} className="font-medium hover:underline">{formatDate(row.createdAt)}</Link></TableCell><TableCell className="text-sm">{row.requestType === 'AUTO_REPLENISH' ? '自動補貨' : '店家選品'}</TableCell><TableCell><Badge variant={['submitted', 'under_review'].includes(row.status) ? 'warning' : row.status === 'rejected' ? 'destructive' : 'secondary'}>{requestStatusLabel[row.status] ?? row.status}</Badge></TableCell><TableCell className="text-right text-sm">{row.items.length} 項／{row.items.reduce((sum, item) => sum + (item.approvedQuantity ?? item.requestedQuantity ?? 0), 0)} 件</TableCell></TableRow>)}</TableBody></Table>}
      </MerchantSection>

      <MerchantSection title={`店家訂單（最近 ${orders.length} 筆）`} description="銷售或人工建立的店家訂單" contentClassName="px-0 py-0">
        {orders.length === 0 ? <CompactEmpty text="目前沒有店家訂單" /> : <Table><TableHeader><TableRow><TableHead>訂單編號</TableHead><TableHead>狀態</TableHead><TableHead className="text-right">總額</TableHead><TableHead className="text-right">關聯出貨</TableHead></TableRow></TableHeader><TableBody>{orders.map((row) => <TableRow key={row.id}><TableCell><Link href={`/orders/${row.id}`} className="font-mono text-xs hover:underline">{row.orderNumber}</Link></TableCell><TableCell><StatusBadge kind="order" value={row.status} /></TableCell><TableCell className="text-right">{formatCurrency(Number(row.total))}</TableCell><TableCell className="text-right text-sm text-muted-foreground">{row.shipments.length} 筆</TableCell></TableRow>)}</TableBody></Table>}
      </MerchantSection>

      <MerchantSection title={`出貨單（最近 ${shipments.length} 筆）`} description="與 HQ 全域出貨共用同一份資料；物流送達不代表店家已完成驗收" contentClassName="px-0 py-0">
        {shipments.length === 0 ? <CompactEmpty text="目前沒有出貨單" /> : <Table><TableHeader><TableRow><TableHead>出貨單</TableHead><TableHead>出貨狀態</TableHead><TableHead className="text-right">品項／數量</TableHead><TableHead>物流資訊</TableHead><TableHead>建立時間</TableHead></TableRow></TableHeader><TableBody>{shipments.map((row) => <TableRow key={row.id}><TableCell><Link href={`/shipments/${row.id}`} className="flex items-center gap-1.5 font-mono text-xs hover:underline"><Truck className="h-3.5 w-3.5 text-muted-foreground" />{row.shipmentNumber}</Link></TableCell><TableCell><Badge variant={shipmentStatusVariant[row.status] ?? 'secondary'}>{shipmentStatusLabel[row.status] ?? row.status}</Badge></TableCell><TableCell className="text-right text-sm">{row.items.length} 項／{row.items.reduce((sum, item) => sum + item.quantity, 0)} 件</TableCell><TableCell className="text-xs">{row.carrier ?? '未指定'}{row.trackingNumber ? <div className="font-mono text-muted-foreground">{row.trackingNumber}</div> : null}</TableCell><TableCell className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</TableCell></TableRow>)}</TableBody></Table>}
      </MerchantSection>
    </MerchantWorkspace>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return <p className="px-5 py-6 text-sm text-muted-foreground">{text}</p>;
}
