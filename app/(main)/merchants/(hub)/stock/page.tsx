import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MerchantStockFilterLinks } from '@/components/merchants/merchant-stock-filter-links';
import { MerchantStockTxnTable } from '@/components/merchants/merchant-stock-txn-table';
import {
  buildMerchantStockTxnWhere,
  parseMerchantStockLedgerSearchParams,
} from '@/lib/merchant-stock-query';
import { formatDate } from '@/lib/format';
import { LEGACY_MERCHANT_STOCK_TIER_ID } from '@/lib/merchant-stock-key';
import { variationLabel } from '@/lib/product-variations';
import { PackagePlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function MerchantStockPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const view = searchParams.view === 'levels' ? 'levels' : 'txns';
  const filters = parseMerchantStockLedgerSearchParams(searchParams);
  const merchantId = filters.merchantId;

  const merchants = await prisma.merchant.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const toolbar = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/merchants/restock">
          <PackagePlus className="mr-1 h-4 w-4" />
          新增進貨
        </Link>
      </Button>
    </div>
  );

  if (view === 'levels') {
    const stocks = await prisma.merchantStock.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        quantity: { not: 0 },
      },
      include: {
        merchant: true,
        product: { include: { priceTiers: { orderBy: { price: 'asc' } } } },
      },
      orderBy: [{ merchant: { name: 'asc' } }, { product: { name: 'asc' } }],
      take: 500,
    });

    return (
      <MerchantWorkspace>
        {toolbar}
        <MerchantStockFilterLinks
          basePath="/merchants/stock"
          merchants={merchants}
          filters={{
            merchantId: filters.merchantId,
            type: filters.type,
            month: filters.month,
            settled: filters.settled,
          }}
          view="levels"
        />
        <Card>
          {stocks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">尚無庫存資料</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店家</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead className="text-right">現有數量</TableHead>
                  <TableHead>最近進貨</TableHead>
                  <TableHead>最近銷售</TableHead>
                  <TableHead>最近盤點</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((s) => {
                  const tier =
                    s.tierId === LEGACY_MERCHANT_STOCK_TIER_ID
                      ? null
                      : s.product.priceTiers.find((t) => t.id === s.tierId);
                  const tierLabel =
                    tier != null
                      ? variationLabel(tier)
                      : s.tierId === LEGACY_MERCHANT_STOCK_TIER_ID &&
                          s.product.priceTiers.filter((t) => t.weightGrams).length > 1
                        ? '未分規格'
                        : '—';
                  return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/merchants/${s.merchant.id}/products`}
                        className="font-medium hover:underline"
                      >
                        {s.merchant.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/products/${s.product.id}`} className="hover:underline">
                        {s.product.name}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">{s.product.sku}</div>
                    </TableCell>
                    <TableCell>
                      {tierLabel !== '—' ? (
                        <Badge variant="outline" className="text-[10px]">
                          {tierLabel}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-lg font-semibold tabular-nums">
                      {s.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(s.lastRestockAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(s.lastSaleAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(s.lastCountAt)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </MerchantWorkspace>
    );
  }

  const where = buildMerchantStockTxnWhere(filters);
  const txns = await prisma.merchantStockTxn.findMany({
    where,
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
      product: { select: { id: true, name: true, sku: true } },
      order: { select: { id: true, orderNumber: true } },
      settlement: { select: { id: true, settlementId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  return (
    <MerchantWorkspace>
      {toolbar}
      <MerchantStockFilterLinks
        basePath="/merchants/stock"
        merchants={merchants}
        filters={{
          merchantId: filters.merchantId,
          type: filters.type,
          month: filters.month,
          settled: filters.settled,
        }}
        view="txns"
      />
      <p className="text-xs text-muted-foreground">
        顯示最近 {txns.length} 筆異動
        {filters.month ? `（${filters.month}）` : ''}
      </p>
      <Card>
        <MerchantStockTxnTable txns={txns} showMerchant />
      </Card>
    </MerchantWorkspace>
  );
}
