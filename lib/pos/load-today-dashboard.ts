import { prisma } from '@/lib/prisma';
import {
  buildTodayTaskRows,
  isInventoryReliable,
  type TodayDashboardInput,
  type TodayTaskRow,
} from '@/lib/pos/today-dashboard';

const OPEN_RESTOCK_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'converted_to_shipment',
] as const;

export type LoadedTodayDashboard = {
  rows: TodayTaskRow[];
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
  console.error(`[pos] loadTodayDashboard:${label}`, result.reason);
  return null;
}

function coerceDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 載入本店「今天」列資料。
 * - 不依賴 `@/lib/booking/service`（避免拖進通知／叫貨整條模組圖）
 * - appointment 只 select 需要欄位（避開 migrate soft-fail 缺的 line_* 欄）
 * - 各查詢獨立 settled：單一表失敗不拖垮整頁
 * - 待換罐計數失敗時視為 0（表尚未就緒也不炸）
 */
export async function loadTodayDashboard(
  merchantId: string,
): Promise<LoadedTodayDashboard> {
  try {
    const [pendingResult, nextResult, restockResult, stockResult, refillResult] =
      await Promise.allSettled([
        prisma.appointment.count({
          where: { merchantId, status: 'requested' },
        }),
        prisma.appointment.findFirst({
          where: {
            merchantId,
            status: { in: ['confirmed', 'requested', 'reschedule_proposed'] },
            startsAt: { gte: new Date() },
          },
          orderBy: { startsAt: 'asc' },
          select: {
            id: true,
            petName: true,
            startsAt: true,
            status: true,
            customer: { select: { name: true } },
          },
        }),
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
            product: { select: { name: true, reorderPoint: true, status: true } },
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

    const failures = [
      pendingResult,
      nextResult,
      restockResult,
      stockResult,
    ].filter((r) => r.status === 'rejected');
    const pendingConfirmCount = settledValue(pendingResult, 'pending') ?? 0;
    const nextAppt = settledValue(nextResult, 'next');
    const openRestocks = settledValue(restockResult, 'restock') ?? [];
    const stockRows = settledValue(stockResult, 'stock');
    const pendingRefillCount = settledValue(refillResult, 'refill') ?? 0;

    let lowStock: TodayDashboardInput['lowStock'] = null;
    if (stockRows && isInventoryReliable(stockRows.length)) {
      lowStock = stockRows
        .filter(
          (s) =>
            s.product != null &&
            s.product.status === 'active' &&
            s.quantity <= Math.max(0, s.product.reorderPoint ?? 0),
        )
        .map((s) => ({
          productName: s.product!.name,
          quantity: s.quantity,
        }))
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 10);
    }

    const startsAt = nextAppt ? coerceDate(nextAppt.startsAt) : null;
    const input: TodayDashboardInput = {
      pendingConfirmCount,
      nextGuest:
        nextAppt && startsAt
          ? {
              id: nextAppt.id,
              petName: nextAppt.petName,
              customerName: nextAppt.customer?.name ?? '顧客',
              startsAt,
              status: nextAppt.status,
            }
          : null,
      pendingRefillCount,
      lowStock,
      openRestockCount: openRestocks.length,
      firstOpenRestockId: openRestocks[0]?.id ?? null,
    };

    const warning =
      failures.length === 0
        ? null
        : failures.some((f) => isMissingRelationError(f.reason))
          ? '部分資料表尚未就緒。今天仍可從下方叫貨。'
          : '部分今日資料暫時讀取失敗，可先從下方叫貨或稍後再試。';

    return { rows: buildTodayTaskRows(input), warning };
  } catch (err) {
    console.error('[pos] loadTodayDashboard', err);
    return {
      rows: [],
      warning: isMissingRelationError(err)
        ? '部分資料表尚未就緒。今天仍可從下方叫貨。'
        : '資料暫時載不進來，請稍後再試。',
    };
  }
}
