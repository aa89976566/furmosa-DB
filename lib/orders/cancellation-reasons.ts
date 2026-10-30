export const ORDER_CANCELLATION_REASONS = [
  ['customer_request', '客戶要求取消'],
  ['out_of_stock', '商品缺貨'],
  ['duplicate_order', '重複下單'],
  ['payment_issue', '付款問題'],
  ['delivery_issue', '配送或地址問題'],
  ['merchant_request', '店家要求取消'],
  ['risk_review', '風險或異常訂單'],
  ['other', '其他'],
] as const;

export type OrderCancellationReasonCode = (typeof ORDER_CANCELLATION_REASONS)[number][0];

export const orderCancellationReasonLabel = (code: string) =>
  ORDER_CANCELLATION_REASONS.find(([value]) => value === code)?.[1] ?? '其他';

export function isOrderCancellationReasonCode(value: string): value is OrderCancellationReasonCode {
  return ORDER_CANCELLATION_REASONS.some(([code]) => code === value);
}

export type OrderCancellationRecord = {
  reasonCode: string;
  reasonLabel: string;
  note: string;
  actorName: string;
};

export function parseOrderCancellationRecord(metadataJson: string | null): OrderCancellationRecord | null {
  if (!metadataJson) return null;
  try {
    const value = JSON.parse(metadataJson) as Record<string, unknown>;
    const reasonCode = typeof value.reasonCode === 'string' ? value.reasonCode : 'other';
    return {
      reasonCode,
      reasonLabel: typeof value.reasonLabel === 'string' ? value.reasonLabel : orderCancellationReasonLabel(reasonCode),
      note: typeof value.note === 'string' ? value.note : '',
      actorName: typeof value.actorName === 'string' ? value.actorName : 'HQ 執行人員',
    };
  } catch {
    return null;
  }
}
