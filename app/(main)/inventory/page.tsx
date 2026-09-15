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
import { formatDateTime, formatNumber } from '@/lib/format';
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
      unit: true,
      reorderPoint: true,
      cost: true,
      vendor: { select: { name: true, id: true } },
      inventoryBalances: {
        select: {
          quantity: true,
          unit: true,
          lastCountedAt: true,
          countNote: true,
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
        description="HQ 主倉以散裝實際單位管理；未盤點的舊數字僅供核對"
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
                <TableHead>最近實體盤點</TableHead>
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
                const mainBalance = p.inventoryBalances.find(b => b.warehouse.code === "WH-MAIN");
                const isFood = ["staple_food", "treats", "freeze_dried", "health"].includes(p.category);
                const counted = Boolean(mainBalance?.unit && mainBalance.lastCountedAt);
                const total = main + south + consign;
                const low = isFood ? !counted || main === 0 : total <= p.reorderPoint;
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
                    <TableCell className="text-right">{formatNumber(main)} {mainBalance?.unit ?? (isFood ? "（舊數字，待盤點）" : p.unit)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(south)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(consign)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{counted ? `${formatNumber(main)} ${mainBalance?.unit}（HQ）` : `${formatNumber(total)}（舊合計）`}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {counted ? "待設定實際單位門檻" : formatNumber(p.reorderPoint)}
                    </TableCell>
                    <TableCell className="text-sm">{mainBalance?.countNote?.includes("未提供精確時間") ? mainBalance.lastCountedAt?.toISOString().slice(0, 10) : formatDateTime(mainBalance?.lastCountedAt)}<div className="text-xs text-muted-foreground">{mainBalance?.countNote}</div></TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {!isFood || counted ? "補貨" : "待實體盤點"}
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
