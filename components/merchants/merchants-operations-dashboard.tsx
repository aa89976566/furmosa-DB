import Link from 'next/link';
import {
  MerchantSection,
  MerchantStat,
  MerchantStatGrid,
} from '@/components/merchants/merchant-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import type { MerchantsPortfolioReport } from '@/lib/merchant-report';
import { merchantTypeLabel } from '@/lib/labels';
import { ChevronRight } from 'lucide-react';

export function MerchantsOperationsDashboard({ report }: { report: MerchantsPortfolioReport }) {
  const periodLabel = `${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}`;

  return (
    <div className="space-y-4">
      <MerchantSection title="期間銷售" description={periodLabel}>
        <MerchantStatGrid className="sm:grid-cols-2 xl:grid-cols-4">
          <MerchantStat label="銷售件數" value={report.totals.soldQty} suffix="件" />
          <MerchantStat label="銷售額" value={formatCurrency(report.totals.grossSales)} />
          <MerchantStat label="店家分潤" value={formatCurrency(report.totals.commissionAmount)} />
          <MerchantStat label="公司實收" value={formatCurrency(report.totals.companyRevenue)} />
        </MerchantStatGrid>
      </MerchantSection>

      {report.topProducts.length > 0 && (
        <MerchantSection title="熱銷商品" description="全通路本期間銷售件數" contentClassName="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>商品</TableHead>
                <TableHead className="text-right">件數</TableHead>
                <TableHead className="text-right">銷售額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.topProducts.map((row) => (
                <TableRow key={row.productInternalId}>
                  <TableCell>
                    <Link
                      href={`/products/${row.productInternalId}`}
                      className="font-medium hover:underline"
                    >
                      {row.productName}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.quantity}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(row.grossSales)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MerchantSection>
      )}

      <MerchantSection
        title="店家營運一覽"
        description="依本期間銷售與目前在店庫存整理"
        contentClassName="px-0 py-0"
      >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>編號</TableHead>
                <TableHead>店家名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>城市</TableHead>
                <TableHead className="text-right">在店庫存</TableHead>
                <TableHead className="text-right">期間銷售</TableHead>
                <TableHead className="text-right">期間銷售額</TableHead>
                <TableHead className="text-right">分潤</TableHead>
                <TableHead className="text-right">訂單</TableHead>
                <TableHead className="text-right">結算</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.merchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  <TableCell className="font-mono text-xs">{merchant.merchantId}</TableCell>
                  <TableCell className="font-medium">{merchant.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{merchantTypeLabel[merchant.type]}</Badge>
                  </TableCell>
                  <TableCell>{merchant.city ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <StockQty quantity={merchant.stockUnits} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {merchant.periodSoldQty}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(merchant.periodGrossSales)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPercent(merchant.commissionRate, 0)}
                  </TableCell>
                  <TableCell className="text-right">{merchant.orderCount}</TableCell>
                  <TableCell className="text-right">{merchant.settlementCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/merchants/${merchant.id}`}>
                        查看
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </MerchantSection>
    </div>
  );
}

function StockQty({ quantity }: { quantity: number }) {
  const tone =
    quantity === 0 ? 'text-destructive' : quantity <= 3 ? 'text-warning' : 'text-foreground';
  return <span className={`font-mono font-semibold tabular-nums ${tone}`}>{quantity}</span>;
}
