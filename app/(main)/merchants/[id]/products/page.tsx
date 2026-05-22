import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { formatConsignmentCommission } from '@/lib/merchant-commission';
import { Package, PackagePlus, Pencil, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantProductsPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { include: { product: true } },
      stocks: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  type Row = {
    productId: string;
    productName: string;
    sku: string;
    productInternalId: string;
    quantity: number;
    suggestedPrice: number | null;
    commissionMode: string | null;
    commissionValue: number | null;
    commissionPerUnit: number | null;
    companyRevenuePerUnit: number | null;
    ruleId: string | null;
    lastRestockAt: Date | null;
  };
  const productRows = new Map<string, Row>();
  for (const stock of merchant.stocks) {
    productRows.set(stock.productId, {
      productId: stock.product.productId,
      productName: stock.product.name,
      sku: stock.product.sku,
      productInternalId: stock.productId,
      quantity: stock.quantity,
      suggestedPrice: null,
      commissionMode: null,
      commissionValue: null,
      commissionPerUnit: null,
      companyRevenuePerUnit: null,
      ruleId: null,
      lastRestockAt: stock.lastRestockAt,
    });
  }
  for (const rule of merchant.productRules) {
    const perUnit =
      rule.commissionMode === 'percent'
        ? (rule.suggestedPrice * rule.commissionValue) / 100
        : rule.commissionValue;
    const existing = productRows.get(rule.productId);
    if (existing) {
      existing.suggestedPrice = rule.suggestedPrice;
      existing.commissionMode = rule.commissionMode;
      existing.commissionValue = rule.commissionValue;
      existing.commissionPerUnit = perUnit;
      existing.companyRevenuePerUnit = rule.suggestedPrice - perUnit;
      existing.ruleId = rule.id;
    } else {
      productRows.set(rule.productId, {
        productId: rule.product.productId,
        productName: rule.product.name,
        sku: rule.product.sku,
        productInternalId: rule.productId,
        quantity: 0,
        suggestedPrice: rule.suggestedPrice,
        commissionMode: rule.commissionMode,
        commissionValue: rule.commissionValue,
        commissionPerUnit: perUnit,
        companyRevenuePerUnit: rule.suggestedPrice - perUnit,
        ruleId: rule.id,
        lastRestockAt: null,
      });
    }
  }
  const rows = [...productRows.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName, 'zh-Hant'),
  );

  return (
    <div className="space-y-6 p-6">
      <SectionCard
        title="寄賣商品 × 庫存 × 分潤"
        description="寄賣分潤依商品設定為 20% 或 30%"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/merchants/${merchant.id}/rule`}>
                <Pencil className="mr-1 h-3 w-3" />
                分潤規則
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/merchants/${merchant.id}/restock`}>
                <PackagePlus className="mr-1 h-4 w-4" />
                新增進貨
              </Link>
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">這家店還沒設定寄賣商品</p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/merchants/${merchant.id}/restock`}>
                <PackagePlus className="mr-1 h-4 w-4" />
                建立第一筆進貨
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">店家庫存</TableHead>
                <TableHead className="text-right">建議售價</TableHead>
                <TableHead className="text-center">寄賣分潤</TableHead>
                <TableHead className="text-right">公司實收</TableHead>
                <TableHead className="text-right">最近進貨</TableHead>
                <TableHead className="w-px"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.productInternalId}>
                  <TableCell>
                    <Link
                      href={`/products/${r.productInternalId}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {r.productName}
                    </Link>
                    <div className="ml-6 font-mono text-xs text-muted-foreground">{r.sku}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        r.quantity === 0
                          ? 'font-mono font-semibold text-destructive'
                          : r.quantity <= 3
                            ? 'font-mono font-semibold text-warning'
                            : 'font-mono font-semibold'
                      }
                    >
                      {r.quantity}
                    </span>
                    {r.quantity === 0 && r.ruleId && (
                      <div className="text-[10px] text-destructive">缺貨</div>
                    )}
                    {r.quantity > 0 && r.quantity <= 3 && (
                      <div className="flex items-center justify-end gap-1 text-[10px] text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        待補
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {r.suggestedPrice ? formatCurrency(r.suggestedPrice) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const label = formatConsignmentCommission(
                        r.commissionMode,
                        r.commissionValue,
                      );
                      if (label) {
                        const isStandard =
                          r.commissionMode === 'percent' &&
                          (r.commissionValue === 20 || r.commissionValue === 30);
                        return (
                          <div className="space-y-0.5">
                            <Badge variant={isStandard ? 'info' : 'secondary'}>
                              {label}
                            </Badge>
                            {r.commissionPerUnit != null && r.suggestedPrice ? (
                              <div className="text-[10px] text-muted-foreground">
                                約 {formatCurrency(r.commissionPerUnit)} / 件
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      if (r.commissionMode === 'amount' && r.commissionValue != null) {
                        return (
                          <span className="text-xs text-muted-foreground">
                            舊制 {formatCurrency(r.commissionValue)}/件
                          </span>
                        );
                      }
                      return (
                        <span className="text-xs text-muted-foreground">未設定</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {r.companyRevenuePerUnit != null
                      ? formatCurrency(r.companyRevenuePerUnit)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.lastRestockAt ? formatDate(r.lastRestockAt) : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={
                          r.ruleId
                            ? `/merchants/${merchant.id}/rule?productId=${r.productInternalId}`
                            : `/merchants/${merchant.id}/rule?productId=${r.productInternalId}&new=1`
                        }
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        {r.ruleId ? '編輯' : '設定'}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
