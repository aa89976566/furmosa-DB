import { intakeSummary, record, string, type Snapshot } from '../shopify/intake-policy';
import { buildFulfillmentPlan, type FulfillmentPlan } from './fulfillment-plan';
import type { OmsIssue } from './oms';

export type ReviewDraft = {
  lines: { productId: string; temperature: string }[];
  method: string; temperature: string; recipient: string; phone: string; address: string;
  storeId: string; storeName: string; giftsConfirmed: boolean; duplicateConfirmed: boolean;
};
export type ReviewProduct = {
  id: string; name: string; sku: string; status: string; available: number | null;
  sourceSku?: string | null; cost?: number | null; unit?: string | null;
  productCategory?: string | null; defaultTemperature?: string | null;
  priceTiers?: { id?: string; weightGrams: number | null; unit: string; unitQty: number; cost?: number | null }[];
};

/** Normalize untrusted form/audit data. Amounts and quantities never come from the form. */
export function reviewDraft(value: unknown): ReviewDraft {
  const data = record(value);
  const field = (key: string) => string(data[key]).slice(0, 500);
  return {
    lines: Array.isArray(data.lines) ? data.lines.map(row => ({
      productId: string(record(row).productId), temperature: string(record(row).temperature),
    })) : [],
    method: field('method'), temperature: field('temperature'), recipient: field('recipient'),
    phone: field('phone'), address: field('address'), storeId: field('storeId'), storeName: field('storeName'),
    giftsConfirmed: data.giftsConfirmed === true, duplicateConfirmed: data.duplicateConfirmed === true,
  };
}

export function checkReview(snapshot: Snapshot, draft: ReviewDraft, products: ReviewProduct[], duplicate: boolean) {
  // The first intake issue is the initial quarantine, replaced by these concrete checks.
  const issues: OmsIssue[] = intakeSummary(snapshot).issues.slice(1).filter(i => i.code !== 'SKU_MISSING');
  const add = (code: OmsIssue['code'], message: string) => issues.push({ code, severity: 'blocking', message });
  if (snapshot.order.fulfillment_status && snapshot.order.fulfillment_status !== 'unfulfilled') add('ORDER_CHANGED', 'Shopify 已有履約狀態，請先核對既有出貨，避免重複寄送');
  const plan = buildFulfillmentPlan(snapshot, draft, products);
  issues.push(...plan.issues);
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  for (const [id, quantity] of Object.entries(plan.neededQuantities)) {
    const product = products.find(item => item.id === id);
    if (!product) continue;
    if (product.available === null || !Number.isFinite(product.available)) add('STOCK_UNKNOWN', `${product.name}：尚無可用庫存資料`);
    else if (product.available < quantity) add('STOCK_INSUFFICIENT', `${product.name}：庫存不足（可用 ${product.available}，需要 ${quantity}）`);
  }
  const physical = rows.some(row => row.requires_shipping !== false);
  if (!physical || rows.some(row => row.requires_shipping === false)) add('SHIPPING_METHOD_UNKNOWN', '本版僅支援純實體商品出貨；包含非實體商品請人工處理');
  if (!['home', 'convenience'].includes(draft.method)) add('SHIPPING_METHOD_UNKNOWN', '請選擇黑貓或 7-11 配送');
  if (!draft.recipient) add('RECIPIENT_MISSING', '缺少收件人');
  if (!/^\+?[\d ()-]{8,25}$/.test(draft.phone)) add('PHONE_MISSING', '請填寫有效收件電話');
  if (!draft.address) add('ADDRESS_MISSING', '缺少收件地址／門市地址');
  if (draft.method === 'convenience' && (!/^\d{6}$/.test(draft.storeId) || !draft.storeName)) add('PICKUP_STORE_MISSING', '7-11 需要六位數門市店號及門市名稱');
  if (!['ambient', 'chilled', 'frozen'].includes(draft.temperature)) add('TEMPERATURE_UNKNOWN', '請確認配送溫層');
  if (draft.method === 'convenience' && draft.temperature === 'chilled') add('TEMPERATURE_CONFLICT', '本版未接 7-11 冷藏配送');
  // Promotion/product verification is now system-derived in buildFulfillmentPlan.
  // A generic human checkbox must not override or duplicate those deterministic checks.
  if (duplicate && !draft.duplicateConfirmed) add('POSSIBLE_DUPLICATE', '相同聯絡資料及金額有近期訂單，請確認不是重複下單');
  const items = plan.items.map(({ productId, productName, sku, quantity, unitPrice, subtotal, isGift, unitCost, weightGrams, unit }) => ({
    productId, productName, sku, quantity, unitPrice, subtotal, isGift, unitCost, weightGrams, unit,
  }));
  return { issues, items, plan };
}

export type { FulfillmentPlan };
