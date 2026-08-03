import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ProductsListFilters } from '@/components/products/products-list-filters';
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
import { productCategoryLabel, platformProductCategoryLabel } from '@/lib/labels';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatPriceRange } from '@/lib/product-variations';
import { Plus, AlertTriangle } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { productSearchWhere } from '@/lib/site-search';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['active', 'inactive', 'draft'] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const q = (searchParams?.q ?? '').trim();
  const status =
    searchParams?.status && (VALID_STATUSES as readonly string[]).includes(searchParams.status)
      ? searchParams.status
      : '';

  const where: Prisma.ProductWhereInput = {
    ...(productSearchWhere(q) ?? {}),
    ...(status ? { status } : {}),
  };

  const [products, totalAll, activeCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        productId: true,
        name: true,
        sku: true,
        category: true,
        productCategory: true,
        status: true,
        price: true,
        reorderPoint: true,
        vendor: { select: { id: true, name: true } },
        priceTiers: { select: { price: true } },
        inventoryBalances: { select: { quantity: true } },
      },
      orderBy: { productId: 'asc' },
      take: 200,
    }),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'active' } }),
  ]);

  return (
    <>
      <PageHeader
        title="產品 Products"
        description={
          q || status
            ? `篩選結果 ${products.length} 筆 · 資料庫共 ${totalAll} 個商品`
            : `共 ${totalAll} 個商品（上架 ${activeCount}）· 含廠商、庫存與規格`
        }
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
        <Card className="overflow-hidden">
          <Suspense fallback={null}>
            <ProductsListFilters
              total={products.length}
              activeCount={activeCount}
              q={q}
              status={status}
            />
          </Suspense>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品編號</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>廠商</TableHead>
                <TableHead className="text-right">規格數</TableHead>
                <TableHead className="text-right">售價區間</TableHead>
                <TableHead className="text-right">總庫存</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    {q ? `找不到符合「${q}」的商品` : '尚無商品'}
                  </TableCell>
                </TableRow>
              ) : null}
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
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">
                          {productCategoryLabel[p.category] ?? p.category}
                        </Badge>
                        {p.productCategory !== 'STANDARD' ? (
                          <Badge variant="outline">
                            {platformProductCategoryLabel[p.productCategory] ??
                              p.productCategory}
                          </Badge>
                        ) : null}
                      </div>
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
                    <TableCell className="text-right">{formatNumber(p.priceTiers.length)}</TableCell>
                    <TableCell className="text-right">
                      {p.priceTiers.length > 0
                        ? formatPriceRange(p.priceTiers.map((tier) => tier.price))
                        : formatCurrency(Number(p.price))}
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
