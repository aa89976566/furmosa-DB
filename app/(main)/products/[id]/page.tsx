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
import { ArrowLeft, Boxes, Layers } from 'lucide-react';
import { ProductForm } from './product-form';
import { updateProduct, deleteProduct } from '../actions';
import { PriceTierManager } from './price-tier-manager';
import { VendorInfoCard } from '@/components/vendors/vendor-info-card';
import { summarizeVariations } from '@/lib/product-variations';

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
  const variations = product.priceTiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    cost: tier.cost,
    notes: tier.notes,
  }));
  const variationSummary = summarizeVariations(variations);

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
            <Badge variant="info">可變商品</Badge>
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="規格數" value={formatNumber(variationSummary.count)} />
          <SummaryMetric label="售價區間" value={variationSummary.priceRange} />
          <SummaryMetric label="毛利區間" value={variationSummary.marginRange} />
          <SummaryMetric label="總庫存" value={formatNumber(totalOnHand)} />
        </div>

        <SectionCard
          title="商品規格"
          description="依重量（30g / 50g / 100g…）設定各規格的售價與成本"
          icon={Layers}
          contentClassName="pt-6"
        >
          <PriceTierManager
            productId={product.id}
            productUnit={product.unit}
            tiers={variations}
          />
        </SectionCard>

        <SectionCard
          title="商品主檔"
          description="共用名稱、分類、廠商與補貨設定；售價請在上方規格維護"
          contentClassName="pt-6"
        >
          <ProductForm
            layout="studio"
            productType="variable"
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
              defaultTemperature: product.defaultTemperature,
            }}
            vendors={vendors}
            saveAction={updateProduct}
            deleteAction={deleteProduct}
          />
          <dl className="mt-6 grid gap-3 border-t pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {product.sourceSku && (
              <MetaItem
                label="單價表 SKU"
                value={<span className="font-mono text-xs">{product.sourceSku}</span>}
              />
            )}
            <MetaItem label="建立時間" value={formatDateTime(product.createdAt)} />
            <MetaItem label="補貨點" value={formatNumber(product.reorderPoint)} />
            <MetaItem label="列表參考售價" value={formatCurrency(Number(product.price))} />
          </dl>
        </SectionCard>

        <SectionCard
          title="供應與庫存"
          description="廠商來源與各倉庫現有數量"
          contentClassName="space-y-6 pt-6"
        >
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              廠商
            </p>
            {product.vendor ? (
              <VendorInfoCard
                vendor={{
                  id: product.vendor.id,
                  vendorId: product.vendor.vendorId,
                  name: product.vendor.name,
                  contactName: product.vendor.contactName,
                  phone: product.vendor.phone,
                  email: product.vendor.email,
                  address: product.vendor.address,
                  paymentTerms: product.vendor.paymentTerms,
                  notes: product.vendor.notes,
                  status: product.vendor.status,
                }}
              />
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                尚未指定廠商
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              各倉庫庫存
            </p>
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
          </div>
        </SectionCard>

        <SectionCard
          title="近期庫存異動"
          description="最新 12 筆"
          icon={Boxes}
          contentClassName="pt-6"
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

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
