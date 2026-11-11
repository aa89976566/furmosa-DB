import { record, snapshotHash, type Snapshot } from '../shopify/intake-policy';
import { moneyToCents } from './promotion-resolver';

export type AdjustmentLine = { sourceIndex?: number; tierId?: string; quantity: number; price: string };
export type AdjustmentData = { sourceHash: string; lines: Record<string, unknown>[]; shippingFee: string; subtotal: string; total: string; reason: string };
export const centsText = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
export function parseAdjustment(metadata: string | null | undefined): AdjustmentData | null {
  if (!metadata) return null;
  const data = JSON.parse(metadata);
  if (data.version !== 1 || !Array.isArray(data.after?.lines) || typeof data.sourceHash !== 'string') throw new Error('HQ 調整紀錄格式錯誤，請聯絡管理員');
  return { ...data.after, sourceHash: data.sourceHash, reason: data.reason };
}
export function adjustedSnapshot(source: Snapshot, audit: { id: string; metadataJson: string | null } | null): Snapshot {
  if (!audit) return source;
  const adjustment = parseAdjustment(audit.metadataJson);
  if (!adjustment || adjustment.sourceHash !== snapshotHash(source)) throw new Error('Shopify 原單已有更新，請先核對並重新儲存 HQ 調整');
  return { ...source, order: { ...source.order,
    line_items: adjustment.lines as Snapshot['order'][string], subtotal_price: adjustment.subtotal,
    total_price: adjustment.total, total_discounts: '0.00',
    total_shipping_price_set: { shop_money: { amount: adjustment.shippingFee, currency_code: source.order.currency ?? 'TWD' } },
    _hq_adjustment_revision: audit.id,
  } };
}
export function adjustmentTotals(lines: Record<string, unknown>[], shippingFee: string) {
  const shipping = moneyToCents(shippingFee);
  if (shipping === null) throw new Error('運費必須為非負金額，最多兩位小數');
  let subtotal = 0;
  for (const line of lines) {
    const price = moneyToCents(line.price);
    const discount = moneyToCents(line.total_discount ?? '0');
    const quantity = line.quantity;
    if (price === null || discount === null || typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 9999) throw new Error('商品數量或金額無效');
    const amount = price * quantity - discount;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('商品金額無效');
    subtotal += amount;
  }
  if (!lines.length || !Number.isSafeInteger(subtotal + shipping) || subtotal + shipping > 100000000) throw new Error('請保留至少一項商品，總額不可超過一百萬元');
  return { shippingFee: centsText(shipping), subtotal: centsText(subtotal), total: centsText(subtotal + shipping) };
}
export function sourceRows(snapshot: Snapshot) { return Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : []; }
