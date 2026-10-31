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
import { ArrowLeft, Layers } from 'lucide-react';
import { ProductForm } from './product-form';
import { updateProduct, deleteProduct } from '../actions';
import { PriceTierManager } from './price-tier-manager';
import { VendorInfoCard } from '@/components/vendors/vendor-info-card';
import { summarizeVariations } from '@/lib/product-variations';
import { getCurrentUser } from '@/lib/auth';
import { inventoryUnit } from '@/lib/inventory/workbench';
import { OperatorProductStock } from './operator-product-stock';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [product, vendors, user] = await Promise.all([
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
    getCurrentUser(),
  ]);
  if (!product) notFound();

  const variations = product.priceTiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    cost: tier.cost,
    defaultWholesaleUnitPrice: tier.defaultWholesaleUnitPrice,
    status: tier.status,
    sku: tier.sku,
    shopifySku: tier.shopifySku,
    shopifyVariantId: tier.shopifyVariantId,
    notes: tier.notes,
  }));

  if (user?.role === 'inventory_reviewer') {
    const mainBalance = product.inventoryBalances.find((balance) => balance.warehouse.code === 'WH-MAIN');
    const unit = inventoryUnit(mainBalance?.unit);
    const productUnit = inventoryUnit(product.unit);
    const canCount = product.status === 'active'
      && product.productCategory === 'STANDARD'
      && !!mainBalance
      && !!unit
      && unit === productUnit;
    const blockedReason = product.status !== 'active'
      ? '商品目前未上架，請由管理員確認商品狀態。'
      : product.productCategory !== 'STANDARD'
        ? '此商品不是一般庫存商品，請盤點實際組成品項。'
        : !mainBalance
          ? '尚未建立主倉庫存，請由管理員完成首次設定。'
          : !unit || unit !== productUnit
            ? '庫存單位尚未確認，請由管理員完成設定。'
            : undefined;
    return <OperatorProductStock
      productId={product.id}
      productName={product.name}
      sku={product.sourceSku ?? product.sku}
      quantity={unit ? mainBalance!.quantity : null}
      unit={unit}
      expectedVersion={mainBalance?.updatedAt.toISOString() ?? null}
      canCount={canCount}
      blockedReason={blockedReason}
      lastCountedAt={mainBalance?.lastCountedAt?.toISOString() ?? null}
      tiers={variations.map((tier) => ({
        id: tier.id,
        label: tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty}${tier.unit}`,
        price: formatCurrency(Number(tier.price)),
      }))}
    />;
  }

  const totalOnHand = product.inventoryBalances.reduce((sum, b) => sum + b.quantity, 0);
  const variationSummary = summarizeVariations(variations);

  const statusLabel =
    product.status === 'active' ? '上架' : product.status === 'draft' ? '草稿' : '下架';

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {product.sourceSku ? (
              <span className="font-mono font-semibold">{product.sourceSku}</span>
            ) : (
              <span className="font-mono font-semibold">{product.sku}</span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">HQ {product.sku}</span>
            <span className="font-mono text-xs text-muted-foreground">{product.productId}</span>
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SummaryChip label="規格" value={`${formatNumber(variationSummary.count)} 個`} />
          <SummaryChip label="售價" value={variationSummary.priceRange} />
          <SummaryChip label="庫存" value={formatNumber(totalOnHand)} />
        </div>

        <div
          id="product-variants"
          className="scroll-mt-28 rounded-2xl target:ring-4 target:ring-foreground/10"
        >
          <SectionCard
            title="商品規格"
            description="重量、售價與成本"
            icon={Layers}
            contentClassName="pt-6"
          >
            <PriceTierManager
              productId={product.id}
              productUnit={product.unit}
              productSourceSku={product.sourceSku}
              tiers={variations}
            />
          </SectionCard>
        </div>

        <SectionCard
          title="基本資料"
          description="只保留日常需要修改的內容"
          contentClassName="pt-6"
        >
          <ProductForm
            key={`${product.id}:${product.commercialTermsVersion ?? 0}`}
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
              productCategory: product.productCategory,
              businessTier: product.businessTier,
              defaultConsignmentCommissionMode: product.defaultConsignmentCommissionMode,
              defaultConsignmentCommissionValue: product.defaultConsignmentCommissionValue,
              defaultWholesaleUnitPrice: product.defaultWholesaleUnitPrice,
              consignmentEnabled: product.consignmentEnabled,
              wholesaleEnabled: product.wholesaleEnabled,
              jarExchangeEnabled: product.jarExchangeEnabled,
              commercialTermsVersion: product.commercialTermsVersion,
            }}
            vendors={vendors}
            variationCount={product.priceTiers.length}
            saveAction={updateProduct}
            deleteAction={deleteProduct}
          />
        </SectionCard>

        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
            供應與庫存
            <span className="text-sm font-normal text-muted-foreground group-open:hidden">展開</span>
            <span className="hidden text-sm font-normal text-muted-foreground group-open:inline">收合</span>
          </summary>
          <div className="space-y-6 border-t px-5 py-5">
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
                    <TableCell className="text-right">{formatNumber(b.quantity)} {b.unit ?? "（舊數字）"}<div className="text-xs text-muted-foreground">最近盤點：{b.lastCountedAt ? b.lastCountedAt.toISOString().slice(0, 10) : "尚未盤點"}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </div>
        </details>

        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
            庫存紀錄
            <span className="text-sm font-normal text-muted-foreground">最新 12 筆</span>
          </summary>
          <div className="overflow-x-auto border-t px-5 py-5">
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
                  <TableCell className="text-right">{formatNumber(t.quantity)} {t.unit ?? "（舊紀錄）"}</TableCell>
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
          </div>
        </details>
      </div>
    </>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
    </span>
  );
}
