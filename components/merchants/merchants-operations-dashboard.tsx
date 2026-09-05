import Link from 'next/link';
import type { ReactNode } from 'react';
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
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { merchantIndustryDisplay } from '@/lib/labels';
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
        <div className="divide-y divide-border/60 md:hidden">
          {report.merchants.map((merchant) => (
            <Link
              key={merchant.id}
              href={`/merchants/${merchant.id}`}
              className="block min-w-0 px-4 py-4 transition-colors active:bg-muted/50"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{merchant.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {merchant.merchantId}
                    <span className="px-1.5">·</span>
                    {merchant.city ?? '未填城市'}
                    <span className="px-1.5">·</span>
                    {merchantIndustryDisplay(merchant.industry)}
                  </p>
                </div>
                <div className="flex max-w-[48%] shrink items-center gap-1.5">
                  <MerchantTypeBadges types={merchant.types} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
                <MobileMetric label="在店庫存">
                  <StockQty quantity={merchant.stockUnits} />
                  <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">件</span>
                </MobileMetric>
                <MobileMetric label="期間銷售" value={`${merchant.periodSoldQty} 件`} />
                <MobileMetric label="訂單" value={`${merchant.orderCount} 筆`} />
                <MobileMetric label="銷售額" value={formatCurrency(merchant.periodGrossSales)} />
                <MobileMetric label="分潤" value={formatPercent(merchant.commissionRate, 0)} />
                <MobileMetric label="結算" value={`${merchant.settlementCount} 筆`} />
              </dl>
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>編號</TableHead>
                <TableHead>店家名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>產業</TableHead>
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
                    <MerchantTypeBadges types={merchant.types} />
                  </TableCell>
                  <TableCell>{merchantIndustryDisplay(merchant.industry)}</TableCell>
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
        </div>
      </MerchantSection>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-foreground">
        {children ?? value}
      </dd>
    </div>
  );
}

function StockQty({ quantity }: { quantity: number }) {
  const tone =
    quantity === 0 ? 'text-destructive' : quantity <= 3 ? 'text-warning' : 'text-foreground';
  return <span className={`font-mono font-semibold tabular-nums ${tone}`}>{quantity}</span>;
}
