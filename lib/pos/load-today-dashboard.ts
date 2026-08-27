import { prisma } from '@/lib/prisma';
import {
  buildHomeTaskCards,
  isInventoryReliable,
  type HomeTaskCard,
  type HomeTasksInput,
} from '@/lib/pos/home-tasks';
import { isLowOrSoldOut } from '@/lib/pos/stock-status';

const OPEN_RESTOCK_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'converted_to_shipment',
] as const;

export type LoadedHomeTasks = {
  cards: HomeTaskCard[];
  warning: string | null;
};

function isMissingRelationError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2022' || code === 'P2010') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /does not exist/i.test(msg) ||
    /relation .+ does not exist/i.test(msg) ||
    /column .+ does not exist/i.test(msg) ||
    /Inconsistent query result/i.test(msg)
  );
}

function settledValue<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.error(`[pos] loadHomeTasks:${label}`, result.reason);
  return null;
}

export async function loadHomeTasks(merchantId: string): Promise<LoadedHomeTasks> {
  try {
    const [restockResult, stockResult, refillResult] = await Promise.allSettled([
      prisma.restockRequest.findMany({
        where: {
          merchantId,
          status: { in: [...OPEN_RESTOCK_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true },
      }),
      prisma.merchantStock.findMany({
        where: { merchantId },
        select: {
          quantity: true,
          product: { select: { name: true, status: true } },
        },
        take: 500,
      }),
      prisma.refillOrder.count({
        where: {
          merchantId,
          status: {
            in: [
              'paid_waiting_return',
              'old_container_verified',
              'awaiting_extra_payment',
            ],
          },
        },
      }),
    ]);

    const failures = [restockResult, stockResult].filter((r) => r.status === 'rejected');
    const openRestocks = settledValue(restockResult, 'restock') ?? [];
    const stockRows = settledValue(stockResult, 'stock');
    const pendingRefillCount = settledValue(refillResult, 'refill') ?? 0;

    let lowStock: HomeTasksInput['lowStock'] = null;
    if (stockRows && isInventoryReliable(stockRows.length)) {
      const byName = new Map<string, number>();
      for (const s of stockRows) {
        if (!s.product || s.product.status !== 'active') continue;
        byName.set(s.product.name, (byName.get(s.product.name) ?? 0) + s.quantity);
      }
      lowStock = [...byName.entries()]
        .filter(([, quantity]) => isLowOrSoldOut(quantity))
        .map(([productName, quantity]) => ({ productName, quantity }))
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 20);
    }

    const input: HomeTasksInput = {
      pendingRefillCount,
      lowStock,
      openRestockCount: openRestocks.length,
      firstOpenRestockId: openRestocks[0]?.id ?? null,
    };

    const warning =
      failures.length === 0
        ? null
        : failures.some((f) => isMissingRelationError(f.reason))
          ? '部分資料暫時讀不到。需要時可從下方選單進庫存或補貨。'
          : '部分資料暫時讀取失敗，請稍後再試。';

    return { cards: buildHomeTaskCards(input), warning };
  } catch (err) {
    console.error('[pos] loadHomeTasks', err);
    return {
      cards: [],
      warning: isMissingRelationError(err)
        ? '部分資料暫時讀不到。需要時可從下方選單進庫存或補貨。'
        : '資料暫時載不進來，請稍後再試。',
    };
  }
}

/** @deprecated 首頁改用 loadHomeTasks */
export const loadTodayDashboard = loadHomeTasks;
