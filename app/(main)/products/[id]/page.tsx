import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
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
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { productCategoryLabel } from '@/lib/labels';
import { ArrowLeft, Building2, Store, Scale, DollarSign } from 'lucide-react';
import { ProductForm } from './product-form';
import { updateProduct, deleteProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, vendors] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        priceTiers: {
          orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
        },
        inventoryBalances: { include: { warehouse: true } },
        inventoryTransactions: {
          include: { warehouse: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        merchantRules: {
          include: { merchant: true },
          orderBy: { suggestedPrice: 'desc' },
        },
      },
    }),
    prisma.vendor.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, vendorId: true },
    }),
  ]);
  if (!product) notFound();

  const totalOnHand = product.inventoryBalances.reduce((sum, b) => sum + b.quantity, 0);
  const margin = Number(product.price) - Number(product.cost);
  const marginRate = Number(product.price) > 0 ? margin / Number(product.price) : 0;

  // 計算每個 rule 的「公司收入」(售價 - 抽成)
  const ruleRows = product.merchantRules.map((r) => {
    const commissionAmount =
      r.commissionMode === 'percent'
        ? (r.suggestedPrice * r.commissionValue) / 100
        : r.commissionValue;
    const companyRevenue = r.suggestedPrice - commissionAmount;
    const effectivePercent = r.suggestedPrice > 0 ? (commissionAmount / r.suggestedPrice) * 100 : 0;
    return { ...r, commissionAmount, companyRevenue, effectivePercent };
  });

  const statusLabel =
    product.status === 'active' ? '上架' : product.status === 'draft' ? '草稿' : '下架';

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{product.productId}</span>
            <span>·</span>
            <span className="font-mono text-xs">{product.sku}</span>
            <Badge variant="secondary">{productCategoryLabel[product.category]}</Badge>
            <Badge variant={product.status === 'active' ? 'success' : 'muted'}>{statusLabel}</Badge>
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/products">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="商品資訊" className="lg:col-span-1">
          <ProductForm
            product={{
              id: product.id,
              productId: product.productId,
              sku: product.sku,
              name: product.name,
              category: product.category,
              style: product.style,
              unit: product.unit,
              price: Number(product.price),
              cost: Number(product.cost),
              reorderPoint: product.reorderPoint,
              status: product.status,
              vendorId: product.vendorId,
              notes: product.notes,
            }}
            vendors={vendors}
            saveAction={updateProduct}
            deleteAction={deleteProduct}
          />
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            {product.sourceSku && (
              <Row
                label="單價表 SKU"
                value={<span className="font-mono text-xs">{product.sourceSku}</span>}
              />
            )}
            <Row
              label="毛利"
              value={`${formatCurrency(margin)} (${(marginRate * 100).toFixed(1)}%)`}
            />
            <Row label="總庫存" value={formatNumber(totalOnHand)} />
            <Row label="建立時間" value={formatDateTime(product.createdAt)} />
          </dl>
        </SectionCard>

        <SectionCard
          title="廠商資訊"
          description="點擊可看廠商完整資料"
          className="lg:col-span-2"
        >
          {product.vendor ? (
            <div className="flex items-start justify-between rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-mono text-muted-foreground">
                    {product.vendor.vendorId}
                  </div>
                  <div className="text-base font-semibold">{product.vendor.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.vendor.contactName ?? '-'} · {product.vendor.phone ?? '-'} ·{' '}
                    {product.vendor.email ?? '-'}
                  </div>
                  {product.vendor.paymentTerms ? (
                    <div className="text-xs text-muted-foreground">
                      付款條件：{product.vendor.paymentTerms}
                    </div>
                  ) : null}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/vendors/${product.vendor.id}`}>查看廠商</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">尚未指定廠商</p>
          )}

          <h4 className="mt-6 mb-2 text-sm font-medium">各倉庫庫存</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>倉庫</TableHead>
                <TableHead>代碼</TableHead>
                <TableHead className="text-right">數量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.inventoryBalances.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.warehouse.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {b.warehouse.code}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(b.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              售價對照表
            </span>
          }
          description="各規格的售價（依單價表）；可在搜尋頁輸入名稱+重量直接查詢"
          className="lg:col-span-3"
        >
          {product.priceTiers.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              尚無價格資料 — 請在單價表填入該商品後重新匯入
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {product.priceTiers.map((t) => {
                const label = t.weightGrams
                  ? `${t.weightGrams}g`
                  : `${t.unitQty} ${t.unit}`;
                const perGramPrice =
                  t.weightGrams && t.weightGrams > 0 ? t.price / t.weightGrams : null;
                const tierMargin =
                  Number(product.cost) > 0 && t.weightGrams
                    ? t.price - Number(product.cost) * t.weightGrams
                    : null;
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Scale className="h-3.5 w-3.5" />
                        {label}
                      </div>
                      {t.notes && (
                        <Badge variant="info" className="text-xs">
                          {t.notes}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {formatCurrency(t.price)}
                    </div>
                    {perGramPrice !== null && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        = {perGramPrice.toFixed(2)} /g
                      </div>
                    )}
                    {tierMargin !== null && (
                      <div className="mt-2 text-xs text-success">
                        毛利 {formatCurrency(tierMargin)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="各寄賣店銷售規則"
          description="這個商品在每家寄賣店的建議售價、抽成方式、公司每件實收"
          className="lg:col-span-3"
        >
          {ruleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無寄賣規則</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>寄賣店</TableHead>
                  <TableHead className="text-right">建議售價</TableHead>
                  <TableHead>抽成方式</TableHead>
                  <TableHead className="text-right">店家抽成</TableHead>
                  <TableHead className="text-right">每件抽成換算</TableHead>
                  <TableHead className="text-right">公司每件實收</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ruleRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/merchants/${r.merchant.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {r.merchant.name}
                      </Link>
                      <div className="ml-6 text-xs text-muted-foreground">
                        {r.merchant.merchantId}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.suggestedPrice)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.commissionMode === 'percent' ? 'info' : 'warning'}>
                        {r.commissionMode === 'percent' ? '百分比抽成' : '固定金額'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {r.commissionMode === 'percent'
                        ? `${r.commissionValue}%`
                        : formatCurrency(r.commissionValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(r.commissionAmount)}
                      <span className="ml-1 text-xs">({r.effectivePercent.toFixed(1)}%)</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {formatCurrency(r.companyRevenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="近期庫存異動"
          description="最新 12 筆"
          className="lg:col-span-3"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>異動單號</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>倉庫</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead>關聯</TableHead>
                <TableHead>時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.inventoryTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.txnNumber}</TableCell>
                  <TableCell>
                    <StatusBadge kind="inventory" value={t.type} />
                  </TableCell>
                  <TableCell className="text-sm">{t.warehouse.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(t.quantity)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.reference ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
