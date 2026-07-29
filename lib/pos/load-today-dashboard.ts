import { prisma } from '@/lib/prisma';
import { countPendingAppointments } from '@/lib/booking/service';
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

/** 避免 DB 連線掛住拖到 Vercel function timeout → SSR digest 錯誤頁 */
const DASHBOARD_QUERY_TIMEOUT_MS = 8_000;

function isMissingRelationError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2022' || code === 'P2010') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(msg);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[pos] ${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * 載入本店「今天」列資料。查詢失敗時回傳空列＋警告，不丟 SSR。
 */
export async function loadTodayDashboard(
  merchantId: string,
): Promise<LoadedTodayDashboard> {
  try {
    const [pendingConfirmCount, nextAppt, openRestocks, stockRows, pendingRefillCount] =
      await withTimeout(
        Promise.all([
          countPendingAppointments(merchantId),
          prisma.appointment.findFirst({
            where: {
              merchantId,
              status: { in: ['confirmed', 'requested', 'reschedule_proposed'] },
              startsAt: { gte: new Date() },
            },
            orderBy: { startsAt: 'asc' },
            include: { customer: { select: { name: true } } },
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
              product: {
                select: { name: true, reorderPoint: true, status: true },
              },
            },
            take: 500,
          }),
          prisma.refillOrder
            .count({
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
            })
            .catch(() => 0),
        ]),
        DASHBOARD_QUERY_TIMEOUT_MS,
        'loadTodayDashboard',
      );

    let lowStock: TodayDashboardInput['lowStock'] = null;
    if (isInventoryReliable(stockRows.length)) {
      lowStock = stockRows
        .filter(
          (s) =>
            s.product != null &&
            s.product.status === 'active' &&
            s.quantity <= Math.max(0, s.product.reorderPoint),
        )
        .map((s) => ({
          productName: s.product!.name,
          quantity: s.quantity,
        }))
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 10);
    }

    const input: TodayDashboardInput = {
      pendingConfirmCount,
      nextGuest: nextAppt
        ? {
            id: nextAppt.id,
            petName: nextAppt.petName,
            customerName: nextAppt.customer?.name ?? '顧客',
            startsAt: nextAppt.startsAt,
            status: nextAppt.status,
          }
        : null,
      pendingRefillCount,
      lowStock,
      openRestockCount: openRestocks.length,
      firstOpenRestockId: openRestocks[0]?.id ?? null,
    };

    return { rows: buildTodayTaskRows(input), warning: null };
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
