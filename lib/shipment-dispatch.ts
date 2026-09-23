/** 交寄與寄件單是兩段狀態。已交寄才會進入 shipped 並觸發庫存扣帳。 */

export const SHIPMENT_OPERATOR_ROLES = ['admin', 'staff', 'warehouse'] as const;
export const ORDER_ROLLBACK_ROLES = ['admin', 'staff'] as const;

const HANDED_OVER_STATUSES = ['shipped', 'delivered', 'received'] as const;
const ORDER_RANK: Record<string, number> = {
  draft: 0,
  pending_review: 1,
  awaiting_shipping_payment: 1,
  confirmed: 2,
  packed: 3,
  shipped: 4,
  delivered: 5,
  completed: 6,
};

export type CarrierKind = '711' | 'tcat' | 'other';

export type DispatchAction =
  | { type: 'hidden' }
  | { type: 'create-label'; label: string }
  | { type: 'confirm-handoff'; label: '確認已交寄' };

export function canOperateShipment(role: string | null | undefined) {
  return (SHIPMENT_OPERATOR_ROLES as readonly string[]).includes(role ?? '');
}

export function isValidTrackingNumber(value: string | null | undefined) {
  const text = (value ?? '').trim();
  if (text.length < 4 || text.length > 40) return false;
  if (!/[0-9A-Za-z]/.test(text)) return false;
  const compact = text.replace(/[\s-]/g, '');
  if (!compact || /^0+$/.test(compact)) return false;
  return true;
}

export function resolveCarrierKind(input: {
  carrier?: string | null;
  shippingMethod?: string | null;
  cvsBrand?: string | null;
}): CarrierKind {
  const carrier = (input.carrier ?? '').trim();
  const method = (input.shippingMethod ?? '').trim();
  const brand = (input.cvsBrand ?? '').trim();
  if (
    carrier === '7-11' ||
    carrier.includes('7-11') ||
    carrier.includes('7-ELEVEN') ||
    brand === '711'
  ) {
    return '711';
  }
  if (carrier.includes('黑貓')) return 'tcat';
  if (method === 'convenience' && (brand === '711' || brand === '')) return '711';
  if (method === 'home') return 'tcat';
  return 'other';
}

export function carrierKindLabel(kind: CarrierKind) {
  if (kind === '711') return '7-11';
  if (kind === 'tcat') return '黑貓宅配';
  return '其他物流';
}

export function createLabelButtonLabel(kind: CarrierKind) {
  if (kind === '711') return '建立 7-11 寄件單';
  if (kind === 'tcat') return '建立黑貓託運單';
  return '建立寄件單';
}

/** 已交寄後不再提供可重複送出的按鈕。沒有有效單號時只建立寄件單。 */
export function dispatchAction(input: {
  status: string;
  carrier?: string | null;
  shippingMethod?: string | null;
  cvsBrand?: string | null;
  trackingNumber?: string | null;
}): DispatchAction {
  if (
    input.status === 'cancelled' ||
    (HANDED_OVER_STATUSES as readonly string[]).includes(input.status)
  ) {
    return { type: 'hidden' };
  }
  if (input.status !== 'pending' && input.status !== 'packed') return { type: 'hidden' };
  if (isValidTrackingNumber(input.trackingNumber)) {
    return { type: 'confirm-handoff', label: '確認已交寄' };
  }
  return {
    type: 'create-label',
    label: createLabelButtonLabel(resolveCarrierKind(input)),
  };
}

/** 有效物流單號，或操作者在確認窗明確勾選，才可以進入已交寄。 */
export function canMarkHandedOver(input: {
  trackingNumber?: string | null;
  explicitHandoff: boolean;
}) {
  return input.explicitHandoff || isValidTrackingNumber(input.trackingNumber);
}

export function orderStatusChangeError(input: {
  role: string | null | undefined;
  current: string;
  next: string;
  reason: string;
  confirmed: boolean;
}): string | null {
  if (!input.role) return '請先登入 HQ';
  if (['shipped', 'delivered', 'completed'].includes(input.next)) {
    return '寄出、送達與完成只能在確認已交寄後更新，不會在這裡自動標記';
  }
  const rollback =
    input.next === 'cancelled' ||
    (ORDER_RANK[input.next] ?? 99) < (ORDER_RANK[input.current] ?? 0);
  if (rollback) {
    if (!(ORDER_ROLLBACK_ROLES as readonly string[]).includes(input.role)) {
      return '沒有取消或退回訂單狀態的權限';
    }
    if (!input.confirmed || input.reason.trim().length < 2) {
      return '取消或退回狀態需要確認，並填寫原因';
    }
    return null;
  }
  if (!canOperateShipment(input.role)) return '沒有變更訂單狀態的權限';
  return null;
}

export type FulfillmentTimelineStep = {
  key: 'paid' | 'packed' | 'label' | 'handed' | 'delivered';
  label: string;
  done: boolean;
  at: Date | null;
};

export function buildFulfillmentTimeline(input: {
  paymentStatus: string;
  orderedAt: Date | null;
  orderStatus: string;
  shipmentStatus?: string | null;
  packedAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  trackingNumber?: string | null;
}): FulfillmentTimelineStep[] {
  const shipmentStatus = input.shipmentStatus ?? '';
  const paid = ['paid', 'cod', 'partial'].includes(input.paymentStatus);
  const packed =
    Boolean(input.packedAt) ||
    ['packed', 'shipped', 'delivered', 'received', 'completed'].includes(input.orderStatus) ||
    ['packed', 'shipped', 'delivered', 'received'].includes(shipmentStatus);
  const labelCreated = isValidTrackingNumber(input.trackingNumber);
  const handed =
    Boolean(input.shippedAt) ||
    ['shipped', 'delivered', 'received'].includes(shipmentStatus);
  const delivered =
    Boolean(input.deliveredAt) ||
    shipmentStatus === 'delivered' ||
    shipmentStatus === 'received';
  return [
    { key: 'paid', label: '付款', done: paid, at: paid ? input.orderedAt : null },
    { key: 'packed', label: '備貨', done: packed, at: input.packedAt ?? null },
    { key: 'label', label: '建立寄件單', done: labelCreated, at: labelCreated ? input.packedAt ?? null : null },
    { key: 'handed', label: '已交寄', done: handed, at: input.shippedAt ?? null },
    { key: 'delivered', label: '送達', done: delivered, at: input.deliveredAt ?? null },
  ];
}
