import { intakeSummary, record, string, type Snapshot } from '../shopify/intake-policy';
import type { OmsIssue } from './oms';

export type ReviewDraft = {
  lines: { productId: string; temperature: string }[];
  method: string; temperature: string; recipient: string; phone: string; address: string;
  storeId: string; storeName: string; giftsConfirmed: boolean; duplicateConfirmed: boolean;
};
export type ReviewProduct = { id: string; name: string; sku: string; status: string; available: number | null };

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
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  const quantities = new Map<string, number>();
  const temperatures = new Set<string>();
  if (draft.lines.length !== rows.length) add('PRODUCT_UNMAPPED', '商品對應數量與來源不一致');
  const items = rows.flatMap((row, index) => {
    const choice = draft.lines[index];
    const product = products.find(p => p.id === choice?.productId && p.status === 'active');
    if (!product) add('PRODUCT_UNMAPPED', `第 ${index + 1} 項商品尚未對應有效商品`);
    const quantity = row.quantity;
    const validQuantity = typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 2147483647;
    if (!validQuantity) add('ORDER_CHANGED', `第 ${index + 1} 項數量無效`);
    const validPrice = typeof row.price === 'string' && /^\d+(?:\.\d{1,2})?$/.test(row.price) && Number.isSafeInteger(Math.round(Number(row.price) * 100));
    if (!validPrice) add('ORDER_CHANGED', `第 ${index + 1} 項金額無效`);
    if (validPrice && validQuantity && !Number.isSafeInteger(Math.round(Number(row.price) * 100) * quantity)) add('ORDER_CHANGED', `第 ${index + 1} 項小計超過安全計算範圍`);
    if (row.requires_shipping !== false) {
      if (!['ambient', 'chilled', 'frozen'].includes(choice?.temperature ?? '')) add('TEMPERATURE_UNKNOWN', `第 ${index + 1} 項請確認商品溫層`);
      else temperatures.add(choice.temperature);
    }
    if (!string(row.sku) && product) issues.push({ code: 'SKU_MISSING', severity: 'warning', message: `第 ${index + 1} 項無來源 SKU，已人工指定商品` });
    if (!product || !validQuantity || !validPrice) return [];
    quantities.set(product.id, (quantities.get(product.id) ?? 0) + quantity);
    return [{ productId: product.id, productName: product.name, sku: product.sku, quantity,
      unitPrice: Number(row.price), subtotal: Math.round(Number(row.price) * 100) * quantity / 100,
      isGift: Number(row.price) === 0 }];
  });
  for (const [id, quantity] of quantities) {
    const product = products.find(p => p.id === id)!;
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
  if (temperatures.size > 1 || [...temperatures].some(t => t !== draft.temperature)) add('TEMPERATURE_CONFLICT', '商品與配送溫層不同，請先確認是否需要拆單');
  if (draft.method === 'convenience' && draft.temperature === 'chilled') add('TEMPERATURE_CONFLICT', '本版未接 7-11 冷藏配送');
  if (!draft.giftsConfirmed) add('GIFT_REVIEW_REQUIRED', '請核對贈品及優惠內容');
  if (duplicate && !draft.duplicateConfirmed) add('POSSIBLE_DUPLICATE', '相同聯絡資料及金額有近期訂單，請確認不是重複下單');
  return { issues, items };
}
