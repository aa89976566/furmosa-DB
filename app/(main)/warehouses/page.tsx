import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { Warehouse as WarehouseIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function WarehousesPage() {
  const warehouses = await prisma.warehouse.findMany({
    include: {
      _count: {
        select: { inventoryBalances: true, inventoryTransactions: true },
      },
      inventoryBalances: { select: { quantity: true } },
    },
    orderBy: { code: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="倉庫 Warehouses"
        description="總倉、區域倉與虛擬倉的庫存總覽"
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((w) => {
          const totalQty = w.inventoryBalances.reduce((s, b) => s + b.quantity, 0);
          return (
            <Card key={w.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{w.code}</p>
                    <h3 className="text-lg font-semibold">{w.name}</h3>
                    <p className="text-sm text-muted-foreground">{w.address ?? '-'}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <WarehouseIcon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">SKU 數</p>
                    <p className="font-semibold">{w._count.inventoryBalances}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總件數</p>
                    <p className="font-semibold">{formatNumber(totalQty)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">異動數</p>
                    <p className="font-semibold">{w._count.inventoryTransactions}</p>
                  </div>
                </div>
                {w.isDefault ? (
                  <Badge variant="info" className="mt-1">
                    預設總倉
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
