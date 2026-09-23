import { pushLineText } from '@/lib/line/push';

export type ShipmentLineNotificationInput = {
  shipmentNumber: string;
  orderNumber?: string | null;
  customerName?: string | null;
  lineUserId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
};

export type MerchantShipmentLineNotificationInput = {
  shipmentNumber: string;
  merchantName: string;
  lineUserId?: string | null;
  notificationEnabled?: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
};

export type ShipmentLineNotificationResult =
  | { status: 'sent' }
  | { status: 'unbound' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

export function shouldNotifyShipmentSent(previousStatus: string, nextStatus: string): boolean {
  return nextStatus === 'shipped' && (previousStatus === 'pending' || previousStatus === 'packed');
}

export function buildShipmentSentLineText(input: ShipmentLineNotificationInput): string {
  const reference = input.orderNumber?.trim() || input.shipmentNumber.trim();
  const lines = [
    `${input.customerName?.trim() ? `${input.customerName.trim()}您好，` : ''}您的訂單已寄出。`,
    `訂單編號：${reference}`,
  ];

  if (input.carrier?.trim()) lines.push(`物流方式：${input.carrier.trim()}`);
  if (input.trackingNumber?.trim()) lines.push(`追蹤碼：${input.trackingNumber.trim()}`);
  lines.push('實際到貨時間依物流配送為準。');
  return lines.join('\n');
}

export function buildMerchantShipmentSentLineText(
  input: MerchantShipmentLineNotificationInput,
): string {
  const lines = [
    `${input.merchantName.trim()}您好，您的補貨已寄出。`,
    `出貨單號：${input.shipmentNumber.trim()}`,
  ];

  if (input.carrier?.trim()) lines.push(`物流方式：${input.carrier.trim()}`);
  if (input.trackingNumber?.trim()) lines.push(`追蹤碼：${input.trackingNumber.trim()}`);
  lines.push('可登入 POS「補貨單」查看最新進度。');
  return lines.join('\n');
}

/**
 * 未綁定即略過；API 未設定或失敗皆不影響出貨狀態。
 * 呼叫端只應在首次 pending/packed → shipped 時執行，避免狀態修正造成重送。
 */
export async function notifyShipmentSentLine(
  input: ShipmentLineNotificationInput,
): Promise<ShipmentLineNotificationResult> {
  const lineUserId = input.lineUserId?.trim();
  if (!lineUserId) return { status: 'unbound' };

  const result = await pushLineText(lineUserId, buildShipmentSentLineText(input));
  if (result.ok) return { status: 'sent' };
  if (result.skipped) return { status: 'skipped', reason: result.error };
  return { status: 'failed', error: result.error };
}

export async function notifyMerchantShipmentSentLine(
  input: MerchantShipmentLineNotificationInput,
): Promise<ShipmentLineNotificationResult> {
  if (input.notificationEnabled === false) {
    return { status: 'skipped', reason: '店家已關閉 LINE 通知' };
  }

  const lineUserId = input.lineUserId?.trim();
  if (!lineUserId) return { status: 'unbound' };

  const result = await pushLineText(lineUserId, buildMerchantShipmentSentLineText(input));
  if (result.ok) return { status: 'sent' };
  if (result.skipped) return { status: 'skipped', reason: result.error };
  return { status: 'failed', error: result.error };
}
