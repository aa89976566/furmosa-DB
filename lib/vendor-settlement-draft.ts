import { calculateVendorSettlement, VENDOR_SETTLEMENT_RULES_VERSION } from './vendor-settlement';

export type VendorSettlementDraftLine = {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  vendorId: string;
  grossCollectedTwd: number;
  refundTwd: number;
  furmosaShareBps: number;
  furmosaShareTwd: number;
  vendorPayableTwd: number;
  occurredAt: Date;
  sourceKey: string;
  sourceSnapshot: {
    rulesVersion: string;
    orderNumber: string;
    orderItemId: string;
    lineSubtotalTwd: number;
    allocatedDiscountTwd: number;
    productName: string;
    sku: string;
    quantity: number;
    weightGrams: number | null;
    unit: string | null;
  };
};

export type VendorSettlementDraftOrder = {
  id: string;
  orderNumber: string;
  orderedAt: Date;
  paymentStatus: string;
  status: string;
  subtotalTwd: number;
  discountTwd: number;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    weightGrams: number | null;
    unit: string | null;
    subtotalTwd: number;
    isGift: boolean;
    supplierVendorIdSnapshot: string | null;
    supplierFurmosaShareBpsSnapshot: number | null;
  }>;
};

export type VendorSettlementDraft = {
  lines: VendorSettlementDraftLine[];
  blockers: string[];
};

function isSafeMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Allocate an integer TWD discount by largest remainder.
 * The sum is exact and ties are deterministic by item id.
 */
export function allocateOrderDiscount(
  items: Array<{ id: string; subtotalTwd: number }>,
  discountTwd: number,
): Map<string, number> {
  if (!isSafeMoney(discountTwd)) throw new Error('訂單折扣必須是非負整數台幣');
  if (!items.length) throw new Error('訂單沒有可分攤折扣的商品');
  if (items.some((item) => !item.id || !isSafeMoney(item.subtotalTwd))) {
    throw new Error('商品小計必須是非負整數台幣');
  }

  const subtotalTwd = items.reduce((sum, item) => sum + item.subtotalTwd, 0);
  if (!Number.isSafeInteger(subtotalTwd) || subtotalTwd <= 0) {
    throw new Error('訂單商品小計必須大於 0');
  }
  if (discountTwd > subtotalTwd) throw new Error('訂單折扣不可超過商品小計');

  const rows = items.map((item) => {
    const numerator = discountTwd * item.subtotalTwd;
    const floor = Math.floor(numerator / subtotalTwd);
    return { ...item, allocated: floor, remainder: numerator % subtotalTwd };
  });
  let left = discountTwd - rows.reduce((sum, row) => sum + row.allocated, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (let index = 0; index < rows.length && left > 0; index += 1, left -= 1) {
    rows[index]!.allocated += 1;
  }
  if (left !== 0) throw new Error('折扣分攤失敗');
  return new Map(rows.map((row) => [row.id, row.allocated]));
}

/** Build an auditable vendor draft from paid orders without writing the database. */
export function buildVendorSettlementDraft(
  vendorId: string,
  orders: VendorSettlementDraftOrder[],
): VendorSettlementDraft {
  const lines: VendorSettlementDraftLine[] = [];
  const blockers: string[] = [];

  for (const order of orders) {
    const prefix = `訂單 ${order.orderNumber}`;
    if (order.paymentStatus !== 'paid') {
      blockers.push(`${prefix}：尚非已付款，不能列入供應商對帳`);
      continue;
    }
    if (order.status === 'cancelled') {
      blockers.push(`${prefix}：訂單已取消，需先確認退款資料`);
      continue;
    }
    if (!isSafeMoney(order.subtotalTwd) || !isSafeMoney(order.discountTwd)) {
      blockers.push(`${prefix}：小計或折扣不是整數台幣`);
      continue;
    }

    const billable = order.items.filter((item) => !item.isGift && item.subtotalTwd > 0);
    const itemSubtotal = billable.reduce((sum, item) => sum + item.subtotalTwd, 0);
    if (itemSubtotal !== order.subtotalTwd) {
      blockers.push(`${prefix}：商品明細合計與訂單小計不一致`);
      continue;
    }

    let allocated: Map<string, number>;
    try {
      allocated = allocateOrderDiscount(
        billable.map(({ id, subtotalTwd }) => ({ id, subtotalTwd })),
        order.discountTwd,
      );
    } catch (error) {
      blockers.push(`${prefix}：${error instanceof Error ? error.message : '折扣無法分攤'}`);
      continue;
    }

    for (const item of billable) {
      if (item.supplierVendorIdSnapshot !== vendorId) continue;
      if (item.supplierFurmosaShareBpsSnapshot == null) {
        blockers.push(`${prefix}：供應商商品缺少分潤比例快照`);
        continue;
      }
      const allocatedDiscountTwd = allocated.get(item.id) ?? 0;
      const grossCollectedTwd = item.subtotalTwd - allocatedDiscountTwd;
      try {
        const amounts = calculateVendorSettlement({
          grossCollectedTwd,
          furmosaShareBps: item.supplierFurmosaShareBpsSnapshot,
        });
        lines.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderItemId: item.id,
          vendorId,
          grossCollectedTwd,
          refundTwd: 0,
          furmosaShareBps: item.supplierFurmosaShareBpsSnapshot,
          furmosaShareTwd: amounts.furmosaShareTwd,
          vendorPayableTwd: amounts.vendorPayableTwd,
          occurredAt: order.orderedAt,
          sourceKey: `order-item:${item.id}:sale`,
          sourceSnapshot: {
            rulesVersion: VENDOR_SETTLEMENT_RULES_VERSION,
            orderNumber: order.orderNumber,
            orderItemId: item.id,
            lineSubtotalTwd: item.subtotalTwd,
            allocatedDiscountTwd,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            weightGrams: item.weightGrams,
            unit: item.unit,
          },
        });
      } catch (error) {
        blockers.push(`${prefix}：${error instanceof Error ? error.message : '分潤無法計算'}`);
      }
    }
  }

  return { lines, blockers };
}
