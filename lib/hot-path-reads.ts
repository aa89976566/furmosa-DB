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
    'order-hub-totals-v1',
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
        ['order-hub-totals-v1'],
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
  const key = `shipment-queue-counts-v1:${JSON.stringify(countWhere)}`;
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
        ['shipment-queue-counts-v1', JSON.stringify(countWhere)],
        { revalidate: 20, tags: [CACHE_TAGS.shipmentQueueCounts] },
      )(),
  );
}
