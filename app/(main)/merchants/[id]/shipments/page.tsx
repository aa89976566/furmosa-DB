import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { PackagePlus, Truck } from 'lucide-react';
import { shipmentStatusLabel, shipmentStatusVariant } from '@/lib/shipment';

export const dynamic = 'force-dynamic';

export default async function MerchantShipmentsPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!merchant) notFound();

  const [active, history] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        merchantId: merchant.id,
        status: { in: ['pending', 'packed', 'shipped'] },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shipment.findMany({
      where: {
        merchantId: merchant.id,
        status: { in: ['delivered', 'cancelled'] },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <SectionCard
        title={`進行中（${active.length}）`}
        action={
          <Button size="sm" asChild>
            <Link href={`/merchants/${merchant.id}/restock`}>
              <PackagePlus className="mr-1 h-4 w-4" />
              新增進貨
            </Link>
          </Button>
        }
      >
        <ShipmentTable rows={active} emptyText="目前沒有運送中的單據" />
      </SectionCard>

      <SectionCard title={`歷史紀錄（最近 ${history.length} 筆）`}>
        <ShipmentTable rows={history} emptyText="尚無歷史紀錄" />
      </SectionCard>
    </div>
  );
}

function ShipmentTable({
  rows,
  emptyText,
}: {
  rows: Array<{
    id: string;
    shipmentNumber: string;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    createdAt: Date;
    items: { quantity: number }[];
  }>;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>單號</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>商品</TableHead>
          <TableHead className="text-right">總件數</TableHead>
          <TableHead>物流</TableHead>
          <TableHead>建立時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sh) => (
          <TableRow key={sh.id}>
            <TableCell>
              <Link
                href={`/shipments/${sh.id}`}
                className="flex items-center gap-1.5 font-mono text-xs hover:underline"
              >
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                {sh.shipmentNumber}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={shipmentStatusVariant[sh.status] ?? 'secondary'}>
                {shipmentStatusLabel[sh.status] ?? sh.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">{sh.items.length} 項</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {sh.items.reduce((s, i) => s + i.quantity, 0)}
            </TableCell>
            <TableCell className="text-xs">
              {sh.carrier ? (
                <>
                  <div>{sh.carrier}</div>
                  {sh.trackingNumber && (
                    <div className="font-mono text-muted-foreground">{sh.trackingNumber}</div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">未指定</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(sh.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
