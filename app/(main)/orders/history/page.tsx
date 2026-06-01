import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { OrderListTable } from '@/components/orders/order-list-table';
import { Button } from '@/components/ui/button';
import { historicalOrderWhere, ORDER_LIST_INCLUDE } from '@/lib/order-list';
import { ArrowLeft, History } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? '').trim();
  const where: Record<string, unknown> = { ...historicalOrderWhere };
  if (q) {
    const contains = { contains: q, mode: 'insensitive' };
    where.AND = [
      historicalOrderWhere,
      {
        OR: [
          { orderNumber: contains },
          { customer: { name: contains } },
          { customer: { phone: contains } },
          { merchant: { name: contains } },
        ],
      },
    ];
    delete where.OR;
  }

  const [orders, returnedCount, cancelledCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: { orderedAt: 'desc' },
      take: 200,
    }),
    prisma.order.count({ where: { fulfillmentStatus: 'returned' } }),
    prisma.order.count({ where: { status: 'cancelled' } }),
  ]);

  return (
    <>
      <PageHeader
        tone="orders"
        title="歷史訂單"
        description="已退貨或已取消的訂單；進行中的訂單請至訂單列表"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              訂單列表
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1">
            <History className="h-3.5 w-3.5" />
            共 {orders.length} 筆（列表上限 200）
          </span>
          <span>已退貨 {returnedCount} · 已取消 {cancelledCount}</span>
        </div>

        <OrderListTable orders={orders} />
      </div>
    </>
  );
}
