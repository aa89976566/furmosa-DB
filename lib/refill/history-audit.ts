import type { PrismaClient } from '@prisma/client';

import {
  REFILL_ACTIVE_STATUSES,
  REFILL_PAID_OPEN_STATUSES,
  REFILL_PRICES,
} from '@/lib/refill/constants';
import { storeCollectionSourceKey } from '@/lib/settlements/source-snapshot';

export const REFILL_HISTORY_ANOMALY_TYPES = [
  'DUPLICATE_ELIGIBILITY',
  'PRICE_MISMATCH',
  'PAID_NOT_DELIVERED',
  'DELIVERED_WITHOUT_STOCK_TXN',
  'DUPLICATE_POINTS',
  'MISSING_RECONCILIATION',
] as const;

export type RefillHistoryAnomalyType = (typeof REFILL_HISTORY_ANOMALY_TYPES)[number];

export type RefillHistoryOrder = {
  id: string;
  appointmentId: string;
  merchantId: string;
  orderType: string;
  deliveryMode: string;
  status: string;
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
  oldContainerSerial: string | null;
  deliveredFlavourId: string | null;
  deliveredQuantity: number | null;
  paidAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type RefillHistoryPayment = {
  id: string;
  refillOrderId: string;
  purpose: string;
  provider: string;
  status: string;
  amount: number;
  paidAt: Date | null;
  createdAt: Date;
};

export type RefillHistoryStockTxn = {
  id: string;
  reason: string;
  note: string | null;
};

export type RefillHistoryPointsLedger = {
  id: string;
  sourceType: string;
  sourceRefId: string | null;
  pointsChange: number;
};

export type RefillHistorySettlementItem = {
  id: string;
  sourceKey: string;
  voidedAt: Date | null;
};

export type RefillHistorySnapshot = {
  orders: RefillHistoryOrder[];
  payments: RefillHistoryPayment[];
  stockTxns: RefillHistoryStockTxn[];
  pointsLedger: RefillHistoryPointsLedger[];
  settlementItems: RefillHistorySettlementItem[];
};

export type RefillHistoryAnomaly = {
  type: RefillHistoryAnomalyType;
  key: string;
  orderIds: string[];
  evidenceIds: string[];
  summary: string;
};

export type RefillHistoryAuditReport = {
  generatedAt: string;
  paidNotDeliveredBefore: string;
  totals: Record<RefillHistoryAnomalyType, number>;
  anomalies: RefillHistoryAnomaly[];
};

const STORE_PAYMENT_PROVIDERS = new Set(['cash', 'store_cash', 'pos_cash']);

function addGrouped<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function expectedAmounts(order: RefillHistoryOrder) {
  if (order.orderType === 'first') {
    return { base: REFILL_PRICES.first, extra: 0, total: REFILL_PRICES.first };
  }
  if (order.orderType === 'exchange' && order.deliveryMode === 'first') {
    return {
      base: REFILL_PRICES.exchange,
      extra: REFILL_PRICES.extraTopup,
      total: REFILL_PRICES.exchange + REFILL_PRICES.extraTopup,
    };
  }
  if (order.orderType === 'exchange') {
    return { base: REFILL_PRICES.exchange, extra: 0, total: REFILL_PRICES.exchange };
  }
  return null;
}

function anomalySortKey(anomaly: RefillHistoryAnomaly) {
  return `${anomaly.type}:${anomaly.key}`;
}

export function analyzeRefillHistory(
  snapshot: RefillHistorySnapshot,
  options: { now?: Date; paidNotDeliveredAfterDays?: number } = {},
): RefillHistoryAuditReport {
  const now = options.now ?? new Date();
  const staleDays = options.paidNotDeliveredAfterDays ?? 7;
  const paidNotDeliveredBefore = new Date(now.getTime() - staleDays * 86_400_000);
  const anomalies: RefillHistoryAnomaly[] = [];

  const activeOrders = snapshot.orders.filter((order) => REFILL_ACTIVE_STATUSES.includes(order.status as never));
  const byAppointment = new Map<string, RefillHistoryOrder[]>();
  const byOldSerial = new Map<string, RefillHistoryOrder[]>();
  for (const order of activeOrders) {
    addGrouped(byAppointment, order.appointmentId, order);
    const serial = order.oldContainerSerial?.trim();
    if (serial) addGrouped(byOldSerial, serial, order);
  }
  for (const [appointmentId, orders] of byAppointment) {
    if (orders.length < 2) continue;
    anomalies.push({
      type: 'DUPLICATE_ELIGIBILITY',
      key: `appointment:${appointmentId}`,
      orderIds: orders.map((order) => order.id).sort(),
      evidenceIds: [],
      summary: '同一預約存在多張有效未完成換罐訂單',
    });
  }
  for (const [serial, orders] of byOldSerial) {
    if (orders.length < 2) continue;
    anomalies.push({
      type: 'DUPLICATE_ELIGIBILITY',
      key: `old-container:${serial}`,
      orderIds: orders.map((order) => order.id).sort(),
      evidenceIds: [],
      summary: '同一空罐序號同時被多張有效訂單使用',
    });
  }

  for (const order of snapshot.orders) {
    const expected = expectedAmounts(order);
    if (
      !expected ||
      order.baseAmount !== expected.base ||
      order.extraAmount !== expected.extra ||
      order.totalAmount !== expected.total ||
      order.totalAmount !== order.baseAmount + order.extraAmount
    ) {
      anomalies.push({
        type: 'PRICE_MISMATCH',
        key: order.id,
        orderIds: [order.id],
        evidenceIds: [],
        summary: expected
          ? `價格不符規則，應為 ${expected.base}+${expected.extra}=${expected.total}`
          : `不支援的訂單類型 ${order.orderType}`,
      });
    }
  }

  const paidDatesByOrder = new Map<string, Date[]>();
  for (const payment of snapshot.payments) {
    if (payment.status !== 'paid') continue;
    addGrouped(paidDatesByOrder, payment.refillOrderId, payment.paidAt ?? payment.createdAt);
  }
  for (const order of snapshot.orders) {
    if (!REFILL_PAID_OPEN_STATUSES.includes(order.status as never)) continue;
    const paidDates = paidDatesByOrder.get(order.id) ?? [];
    const reference = order.paidAt ?? paidDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? order.createdAt;
    if (reference > paidNotDeliveredBefore) continue;
    anomalies.push({
      type: 'PAID_NOT_DELIVERED',
      key: order.id,
      orderIds: [order.id],
      evidenceIds: [],
      summary: `已付款超過 ${staleDays} 天仍未完成交付`,
    });
  }

  const deliveredStockOrderIds = new Set<string>();
  for (const txn of snapshot.stockTxns) {
    if (txn.reason !== 'refill_delivery') continue;
    const match = txn.note?.match(/^換罐交付\s+(.+)$/);
    if (match?.[1]) deliveredStockOrderIds.add(match[1]);
  }
  for (const order of snapshot.orders) {
    if (
      order.status !== 'completed' ||
      !order.deliveredFlavourId ||
      !order.deliveredQuantity ||
      order.deliveredQuantity <= 0 ||
      deliveredStockOrderIds.has(order.id)
    ) {
      continue;
    }
    anomalies.push({
      type: 'DELIVERED_WITHOUT_STOCK_TXN',
      key: order.id,
      orderIds: [order.id],
      evidenceIds: [],
      summary: '訂單已交付，但找不到對應的店家換罐庫存扣除紀錄',
    });
  }

  const pointsByOrder = new Map<string, RefillHistoryPointsLedger[]>();
  for (const ledger of snapshot.pointsLedger) {
    if (ledger.sourceType === 'refill_completed' && ledger.sourceRefId) {
      addGrouped(pointsByOrder, ledger.sourceRefId, ledger);
    }
  }
  for (const [orderId, rows] of pointsByOrder) {
    if (rows.length < 2) continue;
    anomalies.push({
      type: 'DUPLICATE_POINTS',
      key: orderId,
      orderIds: [orderId],
      evidenceIds: rows.map((row) => row.id).sort(),
      summary: '同一換罐訂單被重複加點',
    });
  }

  const activeSettlementKeys = new Set(
    snapshot.settlementItems.filter((item) => item.voidedAt === null).map((item) => item.sourceKey),
  );
  for (const payment of snapshot.payments) {
    if (
      payment.status !== 'paid' ||
      payment.purpose !== 'extra_topup' ||
      !STORE_PAYMENT_PROVIDERS.has(payment.provider.toLowerCase()) ||
      activeSettlementKeys.has(storeCollectionSourceKey(payment.id))
    ) {
      continue;
    }
    anomalies.push({
      type: 'MISSING_RECONCILIATION',
      key: payment.id,
      orderIds: [payment.refillOrderId],
      evidenceIds: [payment.id],
      summary: '店家代收的換罐補差額尚未進入對帳來源',
    });
  }

  anomalies.sort((left, right) => anomalySortKey(left).localeCompare(anomalySortKey(right)));
  const totals = Object.fromEntries(REFILL_HISTORY_ANOMALY_TYPES.map((type) => [type, 0])) as Record<
    RefillHistoryAnomalyType,
    number
  >;
  for (const anomaly of anomalies) totals[anomaly.type] += 1;

  return {
    generatedAt: now.toISOString(),
    paidNotDeliveredBefore: paidNotDeliveredBefore.toISOString(),
    totals,
    anomalies,
  };
}

type RefillHistoryReadClient = Pick<
  PrismaClient,
  'refillOrder' | 'paymentOrder' | 'refillStockTxn' | 'memberPointsLedger' | 'settlementSourceItem'
>;

/** 唯讀：只使用 findMany，不得在此函式加入 update/create/delete/raw write。 */
export async function loadRefillHistoryAudit(
  db: RefillHistoryReadClient,
  options: { now?: Date; paidNotDeliveredAfterDays?: number } = {},
): Promise<RefillHistoryAuditReport> {
  const [orders, payments, stockTxns, pointsLedger, settlementItems] = await Promise.all([
    db.refillOrder.findMany({
      select: {
        id: true,
        appointmentId: true,
        merchantId: true,
        orderType: true,
        deliveryMode: true,
        status: true,
        baseAmount: true,
        extraAmount: true,
        totalAmount: true,
        oldContainerSerial: true,
        deliveredFlavourId: true,
        deliveredQuantity: true,
        paidAt: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.paymentOrder.findMany({
      select: {
        id: true,
        refillOrderId: true,
        purpose: true,
        provider: true,
        status: true,
        amount: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    db.refillStockTxn.findMany({
      where: { reason: 'refill_delivery' },
      select: { id: true, reason: true, note: true },
    }),
    db.memberPointsLedger.findMany({
      where: { sourceType: 'refill_completed' },
      select: { id: true, sourceType: true, sourceRefId: true, pointsChange: true },
    }),
    db.settlementSourceItem.findMany({
      where: { sourceKind: 'store_collection' },
      select: { id: true, sourceKey: true, voidedAt: true },
    }),
  ]);

  return analyzeRefillHistory({ orders, payments, stockTxns, pointsLedger, settlementItems }, options);
}
