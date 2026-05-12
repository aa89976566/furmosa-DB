import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productCategoryLabel } from '@/lib/labels';
import { formatCurrency, formatNumber } from '@/lib/format';
import { Plus, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: {
      vendor: true,
      inventoryBalances: { select: { quantity: true } },
    },
    orderBy: { productId: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="產品 Products"
        description="所有可銷售商品（含廠商來源、庫存與補貨點）"
        actions={
          <Button size="sm" asChild>
            <Link href="/products/new">
              <Plus className="mr-1 h-4 w-4" />
              新增商品
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品編號</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>廠商</TableHead>
                <TableHead className="text-right">售價</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead className="text-right">總庫存</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const onHand = p.inventoryBalances.reduce((sum, b) => sum + b.quantity, 0);
                const low = onHand <= p.reorderPoint;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.productId}</TableCell>
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{productCategoryLabel[p.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.vendor ? (
                        <Link
                          href={`/vendors/${p.vendor.id}`}
                          className="text-info hover:underline"
                        >
                          {p.vendor.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">未指定</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(p.price))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(Number(p.cost))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={low ? 'text-warning font-semibold' : ''}>
                        {formatNumber(onHand)}
                      </span>
                      {low ? (
                        <AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'success' : 'muted'}>
                        {p.status === 'active' ? '上架' : p.status === 'draft' ? '草稿' : '下架'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/products/${p.id}`}>編輯</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
