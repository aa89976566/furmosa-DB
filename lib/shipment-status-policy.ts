export const MERCHANT_RESTOCK_SHIPMENT_TYPE = 'merchant_restock';

export const MERCHANT_RESTOCK_DELIVERED_LOCKED_MESSAGE =
  '此出貨單已完成到貨，不能退回先前狀態';

/** HQ 出貨狀態機（非寄賣 delivered 仍可退回）。 */
export const SHIPMENT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['shipped', 'cancelled'],
  packed: ['shipped', 'pending', 'cancelled'],
  shipped: ['delivered', 'pending'],
  delivered: ['shipped', 'pending'],
  cancelled: [],
};

export type ShipmentStatusChangeDecision =
  | { kind: 'noop'; next: 'delivered' }
  | { kind: 'apply'; next: string };

export function allowedNextShipmentStatuses(type: string, status: string): string[] {
  if (type === MERCHANT_RESTOCK_SHIPMENT_TYPE && status === 'delivered') {
    return [];
  }
  return [...(SHIPMENT_STATUS_TRANSITIONS[status] ?? [])];
}

/**
 * 寄賣到貨後 fail-closed：不得再轉任何其他狀態。
 * delivered → delivered 視為 no-op，避免重複入庫。
 */
export function decideShipmentStatusChange(input: {
  type: string;
  status: string;
  next: string;
}): ShipmentStatusChangeDecision {
  const { type, status, next } = input;
  if (type === MERCHANT_RESTOCK_SHIPMENT_TYPE && status === 'delivered') {
    if (next === 'delivered') {
      return { kind: 'noop', next: 'delivered' };
    }
    throw new Error(MERCHANT_RESTOCK_DELIVERED_LOCKED_MESSAGE);
  }

  const allowed = SHIPMENT_STATUS_TRANSITIONS[status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`「${status}」無法直接轉到「${next}」`);
  }
  return { kind: 'apply', next };
}
