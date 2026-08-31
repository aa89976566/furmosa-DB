import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { OmsIssue } from '../orders/oms';

export const SHOPIFY_ORDER_TOPICS = ['orders/create', 'orders/paid', 'orders/updated'] as const;
export type ShopifyOrderTopic = (typeof SHOPIFY_ORDER_TOPICS)[number];
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Snapshot = { schemaVersion: 1; order: Record<string, Json> };

export function record(value: unknown): Record<string, Json> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json> : {};
}
export function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function pick(value: unknown, keys: string[]) {
  const input = record(value);
  return Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
}

/** Allowlist excludes tokens, browser/device data, payment credentials and arbitrary metafields. */
export function shopifySnapshot(value: unknown): Snapshot {
  const input = record(value);
  const id = input.id;
  if (!((typeof id === 'string' && /^\d+$/.test(id) && /[1-9]/.test(id)) ||
    (typeof id === 'number' && Number.isSafeInteger(id) && id > 0))) {
    throw new Error('INVALID_ORDER_ID');
  }
  const order = pick(input, ['id', 'name', 'order_number', 'email', 'phone', 'financial_status',
    'fulfillment_status', 'cancelled_at', 'created_at', 'updated_at', 'processed_at',
    'currency', 'subtotal_price', 'total_discounts', 'total_price']);
  order.id = String(id);
  order.customer = pick(input.customer, ['first_name', 'last_name', 'email', 'phone']);
  order.shipping_address = pick(input.shipping_address, ['name', 'first_name', 'last_name', 'phone',
    'company', 'address1', 'address2', 'city', 'province', 'zip', 'country']);
  const shipping = record(input.total_shipping_price_set);
  order.total_shipping_price_set = { shop_money: pick(shipping.shop_money, ['amount', 'currency_code']) };
  order.line_items = Array.isArray(input.line_items) ? input.line_items.map(item =>
    pick(item, ['id', 'title', 'variant_title', 'sku', 'quantity', 'price', 'grams', 'requires_shipping',
      'total_discount'])) : [];
  order.shipping_lines = Array.isArray(input.shipping_lines) ? input.shipping_lines.map(item =>
    pick(item, ['title', 'code', 'price'])) : [];
  const pickupKeys = new Set(['超商品牌', '取貨超商', 'cvs_brand', '取貨縣市', '門市縣市', 'cvs_city',
    '取貨區域', '門市區域', 'cvs_district', '取貨門市名稱', '門市名稱', 'cvs_store_name',
    '取貨門市店號', '門市店號', 'cvs_store_id']);
  order.note_attributes = Array.isArray(input.note_attributes) ? input.note_attributes
    .filter(item => pickupKeys.has(string(record(item).name).toLowerCase()))
    .map(item => pick(item, ['name', 'value'])) : [];
  return { schemaVersion: 1, order };
}

export function sourceDate(value: unknown): Date | null {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function snapshotHash(snapshot: Snapshot): string {
  const stable = (value: Json): Json => Array.isArray(value) ? value.map(stable) :
    value !== null && typeof value === 'object' ? Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(stable(snapshot))).digest('hex');
}

export function verifyIntakeSignature(body: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest();
  const actual = Buffer.from(signature, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function intakePaymentStatus(value: unknown): string {
  switch (value) {
    case 'paid': return 'paid';
    case 'partially_paid': case 'partially_refunded': return 'partial';
    case 'refunded': case 'voided': return 'refunded';
    default: return 'unpaid';
  }
}

/** Snapshot is the source of truth; invalid/missing money is visibly quarantined, not approved. */
export function intakeSummary(snapshot: Snapshot) {
  const order = snapshot.order;
  const issues: OmsIssue[] = [{ code: 'ORDER_CHANGED', severity: 'blocking',
    message: '訂單已保存；商品對應與出貨檢查尚未完成，不可建立物流' }];
  const amount = (value: Json | undefined, label: string) => {
    if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value) ||
      !Number.isSafeInteger(Math.round(Number(value) * 100))) {
      issues.push({ code: 'ORDER_CHANGED', severity: 'blocking', message: `${label}格式待確認，請查看 Shopify 快照` });
      return 0;
    }
    return Number(value);
  };
  const subtotal = amount(order.subtotal_price, '商品小計');
  const discount = amount(order.total_discounts, '折扣');
  const total = amount(order.total_price, '總額');
  const shippingFee = amount(record(record(order.total_shipping_price_set).shop_money).amount, '運費');
  if (order.financial_status !== 'paid') issues.push({
    code: ['refunded', 'voided', 'partially_refunded'].includes(string(order.financial_status))
      ? 'PAYMENT_REFUNDED' : 'PAYMENT_PENDING', severity: 'blocking', message: '付款狀態需確認',
  });
  if (order.cancelled_at) issues.push({ code: 'ORDER_CANCELLED', severity: 'blocking', message: 'Shopify 訂單已取消' });
  if (!sourceDate(order.updated_at)) issues.push({ code: 'SOURCE_VERSION_UNKNOWN', severity: 'blocking', message: '缺少有效來源更新時間' });
  if (order.currency !== 'TWD') issues.push({ code: 'ORDER_CHANGED', severity: 'blocking', message: '非 TWD 或幣別缺失；金額不可直接用於本地結算' });
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  if (!items.length) issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '沒有商品明細，需確認原訂單' });
  for (const row of items) {
    const item = record(row);
    if (!string(item.sku)) issues.push({ code: 'SKU_MISSING', severity: 'blocking',
      message: `商品缺少 SKU：${string(item.title) || '未命名商品'}` });
  }
  return { subtotal, discount, shippingFee, total, issues,
    paymentStatus: intakePaymentStatus(order.financial_status) };
}

/** Legacy shipment/terminal states are not reset by incoming order snapshots. */
export function preserveOperationalOrder(order: { status: string; fulfillmentStatus: string; omsStatus: string | null }) {
  return ['cancelled', 'packed', 'shipped', 'delivered', 'completed'].includes(order.status) ||
    ['packed', 'shipped', 'delivered', 'returned'].includes(order.fulfillmentStatus) ||
    ['FULFILLMENT_PENDING', 'FULFILLED'].includes(order.omsStatus ?? '');
}
