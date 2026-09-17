import { intakeSummary, record, string, type Snapshot } from '../shopify/intake-policy';
import { snapshotView } from '../shopify/snapshot-view';
import { deliveryDefaults, skuMatchingProducts } from './review-defaults';
import { reviewDraft, type ReviewProduct } from './review-policy';
import { moneyToCents, multiplySafe } from './promotion-resolver';
import type { OmsIssue } from './oms';

export const SOURCE_REVIEW_VERSION = 'shopify-source-v1';

/** Keep Shopify product lines authoritative while allowing HQ to correct fulfillment fields. */
export function mergeShopifyFulfillmentDraft(source: ReturnType<typeof shopifySourceDraft>, override: ReturnType<typeof reviewDraft>) {
  return reviewDraft({
    ...source,
    method: override.method || source.method,
    temperature: override.temperature || source.temperature,
    recipient: override.recipient || source.recipient,
    phone: override.phone || source.phone,
    address: override.address || source.address,
    storeId: override.storeId || source.storeId,
    storeName: override.storeName || source.storeName,
    duplicateConfirmed: override.duplicateConfirmed,
  });
}

/** Source fields are reconstructed on the server; submitted HQ overrides are never authoritative. */
export function shopifySourceDraft(snapshot: Snapshot, products: ReviewProduct[] = [], duplicateConfirmed = false) {
  const view = snapshotView(snapshot)!;
  const delivery = deliveryDefaults(snapshot);
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  return reviewDraft({
    ...delivery, recipient: view.recipient, phone: view.phone, address: view.address, duplicateConfirmed,
    lines: rows.map(row => {
      const matches = skuMatchingProducts(string(row.sku), products.map(p => ({ ...p, sourceSku: p.sourceSku ?? null })));
      return { productId: matches.length === 1 && matches[0].status === 'active' ? matches[0].id : '', temperature: delivery.temperature };
    }),
  });
}

export function shopifyShippingLabel(snapshot: Snapshot) {
  return (Array.isArray(snapshot.order.shipping_lines) ? snapshot.order.shipping_lines.map(record) : [])
    .map(row => string(row.title) || string(row.code)).filter(Boolean).join('、');
}

/** Reviewing a Shopify order does not require an HQ stock identity or an invented temperature. */
export function checkShopifySource(snapshot: Snapshot, duplicate: boolean, duplicateConfirmed: boolean, fulfillmentDraft?: ReturnType<typeof reviewDraft>): OmsIssue[] {
  const issues = intakeSummary(snapshot).issues.slice(1).filter(i => i.code !== 'SKU_MISSING');
  const add = (code: OmsIssue['code'], message: string) => issues.push({ code, severity: 'blocking', message });
  const sourceDraft = shopifySourceDraft(snapshot);
  const draft = fulfillmentDraft ? mergeShopifyFulfillmentDraft(sourceDraft, fulfillmentDraft) : sourceDraft;
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  rows.forEach((row, index) => {
    const quantity = row.quantity;
    const cents = moneyToCents(row.price);
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
      add('ORDER_CHANGED', `第 ${index + 1} 項數量無效，請在 Shopify 修正`);
    } else if (cents === null || multiplySafe(cents, quantity) === null) {
      add('ORDER_CHANGED', `第 ${index + 1} 項金額無效，請在 Shopify 修正`);
    }
    if (!string(row.title)) add('ORDER_CHANGED', `第 ${index + 1} 項缺少商品名稱，請在 Shopify 修正`);
  });
  if (snapshot.order.fulfillment_status && snapshot.order.fulfillment_status !== 'unfulfilled') {
    add('ORDER_CHANGED', 'Shopify 已有履約狀態，請先核對既有出貨，避免重複寄送');
  }
  if (rows.some(row => row.requires_shipping !== false)) {
    if (!draft.recipient) add('RECIPIENT_MISSING', 'Shopify 缺少收件人，請在來源訂單補齊');
    if (!/^\+?[\d ()-]{8,25}$/.test(draft.phone)) add('PHONE_MISSING', 'Shopify 缺少有效收件電話，請在來源訂單補齊');
    if (!draft.address) add('ADDRESS_MISSING', 'Shopify 缺少收件地址，請在來源訂單補齊');
    if (!['home', 'convenience'].includes(draft.method)) add('SHIPPING_METHOD_UNKNOWN', '請確認配送方式');
    if (draft.method === 'convenience' && (!/^\d{6}$/.test(draft.storeId) || !draft.storeName)) add('PICKUP_STORE_MISSING', '7-11 需要六位數門市店號及門市名稱');
  }
  if (duplicate && !duplicateConfirmed) add('POSSIBLE_DUPLICATE', '相同聯絡資料及金額有近期訂單，請確認不是重複下單');
  return issues;
}
