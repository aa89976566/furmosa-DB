import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDateTime, formatNumber } from '@/lib/format';
import { inventoryTxnTypeLabel } from '@/lib/labels';

const INVENTORY_TXN_TYPES = [
  'purchase_in',
  'sales_out',
  'transfer',
  'adjustment',
  'stocktake',
  'return_in',
  'return_out',
] as const;

export const dynamic = 'force-dynamic';

export default async function InventoryTxnsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const where: any = {};
  if (
    searchParams.type &&
    (INVENTORY_TXN_TYPES as readonly string[]).includes(searchParams.type)
  ) {
    where.type = searchParams.type;
  }

  const txns = await prisma.inventoryTransaction.findMany({
    where,
    include: { product: true, warehouse: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const types: { key: string; label: string }[] = [
    { key: '', label: '全部' },
    ...INVENTORY_TXN_TYPES.map((t) => ({
      key: t,
      label: inventoryTxnTypeLabel[t],
    })),
  ];

  return (
    <>
      <PageHeader
        title="庫存異動紀錄"
        description="採購入庫、銷售出庫、調撥、盤點、退貨等所有異動"
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => {
            const active = (searchParams.type ?? '') === t.key;
            const href = t.key
              ? `/inventory/transactions?type=${t.key}`
              : '/inventory/transactions';
            return (
              <Button
                key={t.key}
                size="sm"
                variant={active ? 'default' : 'outline'}
                asChild
              >
                <Link href={href}>{t.label}</Link>
              </Button>
            );
          })}
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>異動單號</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>倉庫</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead>關聯</TableHead>
                <TableHead>備註</TableHead>
                <TableHead>時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.txnNumber}</TableCell>
                  <TableCell>
                    <StatusBadge kind="inventory" value={t.type} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/products/${t.product.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.product.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{t.product.sku}</div>
                  </TableCell>
                  <TableCell className="text-sm">{t.warehouse.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(t.quantity)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.reference ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.note ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
