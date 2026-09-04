import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { ScanLine, ShoppingCart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantSalesPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!merchant) notFound();

  const orders = await prisma.order.findMany({
    where: { merchantId: merchant.id },
    orderBy: { orderedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6 p-6">
      <SectionCard
        title={`訂單（最近 ${orders.length} 筆）`}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/merchants/${merchant.id}/adjust?mode=sold`}>
                <ScanLine className="mr-1 h-4 w-4" />
                登記賣出
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/merchants/${merchant.id}/sale`}>
                <ShoppingCart className="mr-1 h-4 w-4" />
                新增銷售訂單
              </Link>
            </Button>
          </div>
        }
      >
        {orders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">尚無訂單</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>訂單編號</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">總額</TableHead>
                <TableHead>下單時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="order" value={o.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(o.total))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.orderedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
