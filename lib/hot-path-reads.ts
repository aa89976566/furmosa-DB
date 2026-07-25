import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { activeOrderWhere } from '@/lib/order-list';
import { revenueEligibleOrderWhere } from '@/lib/jar-exchange/revenue';
import { prisma } from '@/lib/prisma';
import { withRuntimeCache } from '@/lib/runtime-cache';
import type { Prisma } from '@prisma/client';

export type OrderSourceTotal = {
  source: string;
  total: number;
  count: number;
};

/** 訂單 Hub 來源合計 — 短 TTL 熱快取 */
export async function getOrderSourceTotals(): Promise<OrderSourceTotal[]> {
  return withRuntimeCache(
    'order-hub-totals-v2',
    {
      ttlSeconds: 30,
      tags: [CACHE_TAGS.orderHubTotals],
      name: 'order-hub-totals',
    },
    () =>
      unstable_cache(
        async () => {
          const rows = await prisma.order.groupBy({
            by: ['source'],
            _sum: { total: true },
            _count: { _all: true },
            where: { ...activeOrderWhere, ...revenueEligibleOrderWhere },
          });
          return rows.map((t) => ({
            source: t.source,
            total: Number(t._sum.total ?? 0),
            count: t._count._all,
          }));
        },
        ['order-hub-totals-v2'],
        { revalidate: 30, tags: [CACHE_TAGS.orderHubTotals] },
      )(),
  );
}

export type ShipmentQueueCounts = {
  byStatus: Record<string, number>;
  pendingCount: number;
  total: number;
};

/** 出貨佇列狀態計數 — 短 TTL 熱快取 */
export async function getShipmentQueueCounts(
  countWhere: Prisma.ShipmentWhereInput,
): Promise<ShipmentQueueCounts> {
  const key = `shipment-queue-counts-v2:${JSON.stringify(countWhere)}`;
  return withRuntimeCache(
    key,
    {
      ttlSeconds: 20,
      tags: [CACHE_TAGS.shipmentQueueCounts],
      name: 'shipment-queue-counts',
    },
    () =>
      unstable_cache(
        async () => {
          const counts = await prisma.shipment.groupBy({
            by: ['status'],
            where: countWhere,
            _count: { _all: true },
          });
          const byStatus = Object.fromEntries(
            counts.map((c) => [c.status, c._count._all]),
          );
          const pendingCount = (byStatus.pending ?? 0) + (byStatus.packed ?? 0);
          const total =
            pendingCount + (byStatus.shipped ?? 0) + (byStatus.delivered ?? 0);
          return { byStatus, pendingCount, total };
        },
        ['shipment-queue-counts-v2', JSON.stringify(countWhere)],
        { revalidate: 20, tags: [CACHE_TAGS.shipmentQueueCounts] },
      )(),
  );
}

export type ProductCatalogRow = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  category: string;
  status: string;
  price: number;
  reorderPoint: number;
  vendor: { id: string; name: string } | null;
  priceTiers: { price: number }[];
  inventoryBalances: { quantity: number }[];
};

export type ProductsCatalogResult = {
  products: ProductCatalogRow[];
  totalAll: number;
  activeCount: number;
};

/** 產品列表（含篩選 key）— 減少 Origin 往返，接近 CDN HIT 的體感 */
export async function getProductsCatalog(
  where: Prisma.ProductWhereInput,
  cacheKey: string,
): Promise<ProductsCatalogResult> {
  const key = `products-catalog-v2:${cacheKey}`;
  return withRuntimeCache(
    key,
    {
      ttlSeconds: 45,
      tags: [CACHE_TAGS.productsCatalog],
      name: 'products-catalog',
    },
    () =>
      unstable_cache(
        async () => {
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
                price: true,
                reorderPoint: true,
                vendor: { select: { id: true, name: true } },
                priceTiers: { select: { price: true } },
                inventoryBalances: { select: { quantity: true } },
              },
              orderBy: { productId: 'asc' },
              take: 200,
            }),
            prisma.product.count(),
            prisma.product.count({ where: { status: 'active' } }),
          ]);
          return {
            products: products.map((p) => ({
              ...p,
              price: Number(p.price),
              priceTiers: p.priceTiers.map((tier) => ({
                price: Number(tier.price),
              })),
            })),
            totalAll,
            activeCount,
          };
        },
        ['products-catalog-v2', cacheKey],
        { revalidate: 45, tags: [CACHE_TAGS.productsCatalog] },
      )(),
  );
}

export type VendorListRow = {
  id: string;
  vendorId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  paymentTerms: string | null;
  productCount: number;
  status: string;
};

/** 廠商列表 — 短 TTL 熱快取 */
export async function getVendorsList(): Promise<VendorListRow[]> {
  return withRuntimeCache(
    'vendors-list-v2',
    {
      ttlSeconds: 60,
      tags: [CACHE_TAGS.vendorsList],
      name: 'vendors-list',
    },
    () =>
      unstable_cache(
        async () => {
          const vendors = await prisma.vendor.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { vendorId: 'asc' },
          });
          return vendors.map((vendor) => ({
            id: vendor.id,
            vendorId: vendor.vendorId,
            name: vendor.name,
            contactName: vendor.contactName,
            phone: vendor.phone,
            paymentTerms: vendor.paymentTerms,
            productCount: vendor._count.products,
            status: vendor.status,
          }));
        },
        ['vendors-list-v2'],
        { revalidate: 60, tags: [CACHE_TAGS.vendorsList] },
      )(),
  );
}
