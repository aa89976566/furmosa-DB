import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import {
  ProductManagementList,
  type ProductManagementRow,
} from '@/components/products/product-management-list';
import { Button } from '@/components/ui/button';
import { productCategoryLabel } from '@/lib/labels';
import { formatCurrency } from '@/lib/format';
import { formatPriceRange } from '@/lib/product-variations';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { productSearchWhere } from '@/lib/site-search';
import { deriveProductReadiness } from '@/lib/products/readiness';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['active', 'inactive', 'draft'] as const;

export default async function ProductsPage(
  props: {
    searchParams?: Promise<{ q?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams?.q ?? '').trim();
  const status =
    searchParams?.status && (VALID_STATUSES as readonly string[]).includes(searchParams.status)
      ? searchParams.status
      : '';

  const where: Prisma.ProductWhereInput = {
    ...(productSearchWhere(q) ?? {}),
    ...(status ? { status } : {}),
  };

  const [products, totalAll, activeCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        productId: true,
        name: true,
        sku: true,
        category: true,
        status: true,
        imageUrl: true,
        price: true,
        reorderPoint: true,
        consignmentEnabled: true,
        wholesaleEnabled: true,
        defaultConsignmentCommissionMode: true,
        defaultConsignmentCommissionValue: true,
        vendor: { select: { id: true, name: true } },
        priceTiers: {
          select: {
            price: true,
            status: true,
            sku: true,
            shopifySku: true,
            defaultWholesaleUnitPrice: true,
          },
        },
        inventoryBalances: { select: { quantity: true } },
      },
      orderBy: { productId: 'asc' },
      take: 200,
    }),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'active' } }),
  ]);

  const rows: ProductManagementRow[] = products.map((product) => {
    const onHand = product.inventoryBalances.reduce((sum, balance) => sum + balance.quantity, 0);
    const activeTiers = product.priceTiers.filter((tier) => tier.status !== 'archived');
    return {
      id: product.id,
      productId: product.productId,
      name: product.name,
      sku: product.sku,
      searchableSkus: activeTiers.flatMap((tier) => [tier.sku, tier.shopifySku]).filter((value): value is string => Boolean(value)),
      imageUrl: product.imageUrl,
      categoryLabel: productCategoryLabel[product.category] ?? product.category,
      vendorName: product.vendor?.name ?? null,
      status: product.status,
      statusLabel: product.status === 'active' ? '上架' : product.status === 'draft' ? '草稿' : '下架',
      priceRange: activeTiers.length > 0
        ? formatPriceRange(activeTiers.map((tier) => tier.price))
        : formatCurrency(Number(product.price)),
      onHand,
      lowStock: onHand <= product.reorderPoint,
      readiness: deriveProductReadiness({
        consignmentEnabled: product.consignmentEnabled,
        wholesaleEnabled: product.wholesaleEnabled,
        defaultConsignmentCommissionMode: product.defaultConsignmentCommissionMode,
        defaultConsignmentCommissionValue: product.defaultConsignmentCommissionValue,
        priceTiers: product.priceTiers,
      }),
    };
  });

  return (
    <>
      <PageHeader
        title="產品管理"
        description={
          q || status
            ? `篩選結果 ${products.length} 筆 · 資料庫共 ${totalAll} 個商品`
            : `共 ${totalAll} 個商品（上架 ${activeCount}）· 管理規格、SKU 與店家合作條件`
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/products/new">
              <Plus className="mr-1 h-4 w-4" />
              新增商品
            </Link>
          </Button>
        }
      />
      <div className="min-w-0 p-4 sm:p-6">
        <ProductManagementList rows={rows} initialQuery={q} />
      </div>
    </>
  );
}
