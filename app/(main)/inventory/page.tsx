import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/format';
import { productCategoryLabel } from '@/lib/labels';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';

/** 建置時不預抓 DB，避免 Vercel SSG 因資料庫短暫不可達而整包部署失敗 */
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      productId: true,
      name: true,
      sku: true,
      category: true,
      reorderPoint: true,
      cost: true,
      vendor: { select: { name: true, id: true } },
      inventoryBalances: {
        select: {
          quantity: true,
          warehouse: { select: { code: true } },
        },
      },
    },
    orderBy: { productId: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="即時庫存"
        description="所有商品在各倉庫的當前數量，含補貨點警示"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/transactions">
              查看異動紀錄
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="p-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>廠商</TableHead>
                <TableHead className="text-right">總倉</TableHead>
                <TableHead className="text-right">南倉</TableHead>
                <TableHead className="text-right">寄賣</TableHead>
                <TableHead className="text-right">合計</TableHead>
                <TableHead className="text-right">補貨點</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const main =
                  p.inventoryBalances.find((b) => b.warehouse.code === 'WH-MAIN')?.quantity ?? 0;
                const south =
                  p.inventoryBalances.find((b) => b.warehouse.code === 'WH-SOUTH')?.quantity ?? 0;
                const consign =
                  p.inventoryBalances.find((b) => b.warehouse.code === 'WH-CONSIGN')?.quantity ??
                  0;
                const total = main + south + consign;
                const low = total <= p.reorderPoint;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {p.productId} · {p.sku}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{productCategoryLabel[p.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.vendor ? (
                        <Link href={`/vendors/${p.vendor.id}`} className="text-info hover:underline">
                          {p.vendor.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(main)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(south)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(consign)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatNumber(total)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatNumber(p.reorderPoint)}
                    </TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          補貨
                        </Badge>
                      ) : (
                        <Badge variant="success">正常</Badge>
                      )}
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
