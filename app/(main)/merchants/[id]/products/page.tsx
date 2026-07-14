import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { commissionBadgeLabel } from '@/lib/merchant-stock-movement';
import { Package, PackagePlus, Pencil, AlertTriangle } from 'lucide-react';
import { MerchantProductDeleteButton } from '@/components/merchants/merchant-product-delete-button';
import { MerchantProductsStockCell } from '@/components/merchants/merchant-products-stock-cell';
import { AutoFillCommissionButton } from '@/components/merchants/auto-fill-commission-button';
import { loadMerchantProductListRows } from '@/lib/merchants/load-merchant-products';

export const dynamic = 'force-dynamic';

export default async function MerchantProductsPage({ params }: { params: { id: string } }) {
  const data = await loadMerchantProductListRows(params.id);
  if (!data) notFound();

  const { merchantId, rows } = data;
  const productsReturnTo = `/merchants/${merchantId}/products`;

  return (
    <div className="space-y-6 p-6">
      <SectionCard
        title="寄賣商品 × 庫存 × 分潤"
        description="庫存請用「登記異動」登記原因；僅顯示有進貨紀錄的規格。分潤：肉乾／零食 20%、凍乾 30%。"
        action={
          <div className="flex flex-wrap gap-2">
            <AutoFillCommissionButton merchantId={merchantId} />
            <Button size="sm" variant="outline" asChild>
              <Link href={`/merchants/${merchantId}/rule`}>
                <Pencil className="mr-1 h-3 w-3" />
                分潤規則
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/merchants/${merchantId}/restock`}>
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
              <Link href={`/merchants/${merchantId}/restock`}>
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
              {rows.map((r) => {
                const badge = commissionBadgeLabel(r.commissionMode, r.commissionValue);
                return (
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
                    <TableCell className="text-right align-top">
                      <MerchantProductsStockCell
                        merchantId={merchantId}
                        productId={r.productInternalId}
                        productName={r.productName}
                        totalQuantity={r.quantity}
                        tierStocks={r.tierStocks}
                        returnTo={productsReturnTo}
                        unitPrice={r.suggestedPrice}
                        commissionPercent={
                          r.commissionMode === 'percent' ? r.commissionValue : null
                        }
                      />
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
                      {badge ? (
                        <div className="space-y-0.5">
                          <Badge
                            variant={
                              r.commissionValue === 30
                                ? 'success'
                                : r.commissionValue === 20
                                  ? 'info'
                                  : 'secondary'
                            }
                          >
                            {badge}
                          </Badge>
                          {r.commissionPerUnit != null && r.suggestedPrice ? (
                            <div className="text-[10px] text-muted-foreground">
                              約 {formatCurrency(r.commissionPerUnit)} / 件
                            </div>
                          ) : null}
                        </div>
                      ) : r.commissionMode === 'amount' && r.commissionValue != null ? (
                        <span className="text-xs text-muted-foreground">
                          舊制 {formatCurrency(r.commissionValue)}/件
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">未設定</span>
                      )}
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
                      <div className="flex items-center justify-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/merchants/${merchantId}/rule?productId=${r.productInternalId}`}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            {r.ruleId ? '編輯' : '設定'}
                          </Link>
                        </Button>
                        <MerchantProductDeleteButton
                          merchantId={merchantId}
                          productId={r.productInternalId}
                          productName={r.productName}
                          quantity={r.quantity}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
