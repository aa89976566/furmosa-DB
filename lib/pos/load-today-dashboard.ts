import { prisma } from '@/lib/prisma';
import { findRestockShipmentsAlreadyPosted } from '@/lib/merchant-restock-inventory';
import {
  loadDirectRestockShipments,
  type DirectRestockShipment,
} from '@/lib/pos/load-merchant-events';
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

const RECEIPT_TAKE = 20;

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

type ReceiptCandidate = {
  shipmentId: string | null;
  shipmentNumber: string | null;
  deliveredAt: Date | null;
  href: string;
};

function compareReceiptCandidates(a: ReceiptCandidate, b: ReceiptCandidate): number {
  const aTime = a.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTime = b.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return (a.shipmentNumber ?? '').localeCompare(b.shipmentNumber ?? '');
}

export async function loadHomeTasks(merchantId: string): Promise<LoadedHomeTasks> {
  try {
    const [
      restockResult,
      stockResult,
      refillResult,
      deliveredRequestResult,
      directResult,
    ] = await Promise.allSettled([
      prisma.restockRequest.findMany({
        where: {
          merchantId,
          status: { in: [...OPEN_RESTOCK_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, shipment: { select: { status: true } } },
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
      prisma.restockRequest.findMany({
        where: {
          merchantId,
          status: { in: [...OPEN_RESTOCK_STATUSES] },
          shipment: { status: 'delivered' },
        },
        orderBy: [
          { shipment: { deliveredAt: 'asc' } },
          { shipment: { shipmentNumber: 'asc' } },
        ],
        take: RECEIPT_TAKE,
        select: {
          id: true,
          shipment: {
            select: {
              id: true,
              shipmentNumber: true,
              deliveredAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      loadDirectRestockShipments(merchantId, {
        statuses: ['delivered'],
        take: RECEIPT_TAKE,
        order: 'oldest',
      }),
    ]);

    const failures = [restockResult, stockResult, deliveredRequestResult, directResult].filter(
      (r) => r.status === 'rejected',
    );
    const openRestocks = settledValue(restockResult, 'restock') ?? [];
    const stockRows = settledValue(stockResult, 'stock');
    const pendingRefillCount = settledValue(refillResult, 'refill') ?? 0;
    const deliveredRequestRows = settledValue(deliveredRequestResult, 'deliveredRequest');
    const directRows = settledValue(directResult, 'direct');

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

    const deliveredRequests: ReceiptCandidate[] =
      deliveredRequestRows !== null
        ? deliveredRequestRows.flatMap((request) =>
            request.shipment
              ? [
                  {
                    shipmentId: request.shipment.id,
                    shipmentNumber: request.shipment.shipmentNumber,
                    deliveredAt: request.shipment.deliveredAt,
                    href: `/pos/restock/${request.id}`,
                  },
                ]
              : [],
          )
        : openRestocks
            .filter((request) => request.shipment?.status === 'delivered')
            .map((request) => ({
              shipmentId: null,
              shipmentNumber: null,
              deliveredAt: null,
              href: `/pos/restock/${request.id}`,
            }));

    const directs: DirectRestockShipment[] = directRows ?? [];
    let postedDirectIds = new Set<string>();
    let evidenceFailed = false;
    let evidenceError: unknown = null;
    if (directs.length > 0) {
      try {
        const evidence = await findRestockShipmentsAlreadyPosted(prisma, merchantId, directs);
        postedDirectIds = evidence.posted;
      } catch (error) {
        evidenceFailed = true;
        evidenceError = error;
        console.error('[pos] loadHomeTasks:directEvidence', error);
      }
    }

    const candidates: ReceiptCandidate[] = [];
    const seenShipmentIds = new Set<string>();
    for (const request of deliveredRequests) {
      const key = request.shipmentId ?? request.href;
      if (seenShipmentIds.has(key)) continue;
      seenShipmentIds.add(key);
      candidates.push(request);
    }
    for (const shipment of directs) {
      if (postedDirectIds.has(shipment.id)) continue;
      if (seenShipmentIds.has(shipment.id)) continue;
      seenShipmentIds.add(shipment.id);
      candidates.push({
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        deliveredAt: shipment.deliveredAt,
        href: `/pos/shipments/${shipment.id}`,
      });
    }
    candidates.sort(compareReceiptCandidates);

    const first = candidates[0];
    const awaitingRestockReceiptCount = candidates.length;
    const capped =
      (deliveredRequestRows?.length === RECEIPT_TAKE) ||
      (directRows?.length === RECEIPT_TAKE);

    const ongoingRestocks = openRestocks.filter(
      (request) => request.shipment?.status !== 'delivered' && request.shipment?.status !== 'received',
    );

    const input: HomeTasksInput = {
      pendingRefillCount,
      awaitingRestockReceiptCount,
      firstAwaitingRestockReceiptHref: first?.href ?? null,
      firstAwaitingRestockShipmentNumber: first?.shipmentNumber ?? null,
      awaitingRestockReceiptCountCapped: capped,
      lowStock,
      openRestockCount: ongoingRestocks.length,
      firstOpenRestockId: ongoingRestocks[0]?.id ?? null,
    };

    const warningReasons: unknown[] = failures.map((failure) => failure.reason);
    if (evidenceFailed) warningReasons.push(evidenceError);
    const warning =
      warningReasons.length === 0
        ? null
        : warningReasons.some((reason) => isMissingRelationError(reason))
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
