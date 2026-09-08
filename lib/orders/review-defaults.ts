import { record, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { matchShopifyItemToProduct } from '@/lib/shopify/match-line-item';
import { reviewDraft, type ReviewDraft } from './review-policy';

type MappingProduct = {
  id: string;
  name: string;
  sku: string;
  sourceSku: string | null;
  defaultTemperature: string | null;
};

export type ReviewLineMappingKind = 'auto' | 'saved' | 'conflict' | 'select';

/** Display-only line props for the review form. Not part of ReviewDraft. */
export type ReviewLineDisplay = {
  title: string;
  quantityLabel: string;
  mappingKind: ReviewLineMappingKind;
  conflictMessage: string;
};

const MAX_SOURCE_QUANTITY = 2147483647;

const containsAny = (value: string, words: string[]) => words.some(word => value.includes(word));

export function sourceQuantityLabel(quantity: unknown): string {
  const valid = typeof quantity === 'number'
    && Number.isSafeInteger(quantity)
    && quantity > 0
    && quantity <= MAX_SOURCE_QUANTITY;
  return valid ? `×${quantity}` : '數量待確認';
}

/** Exact sku / sourceSku hits only. The same product counted once; empty SKU matches nothing. */
export function skuMatchingProducts<T extends { id: string; sku: string; sourceSku: string | null }>(
  sku: string,
  products: T[],
): T[] {
  if (!sku) return [];
  const seen = new Set<string>();
  return products.filter(product => {
    if (product.sku !== sku && product.sourceSku !== sku) return false;
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function sourceLineRows(snapshot: Snapshot) {
  return Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
}

/**
 * OMS uses the same Shopify identity matcher as order sync.
 * Exact SKU/sourceSku remains highest priority and must be unique; only then may title/known-product fallback run.
 */
function autoMatchProduct(row: Record<string, unknown>, products: MappingProduct[]): MappingProduct | null {
  const sku = string(row.sku);
  if (sku) {
    const skuMatches = skuMatchingProducts(sku, products);
    if (skuMatches.length === 1) return skuMatches[0]!;
    if (skuMatches.length > 1) return null;
  }
  return matchShopifyItemToProduct({
    title: string(row.title),
    variant_title: string(row.variant_title),
    sku,
  }, products);
}

function lineMapping(
  savedProductId: string,
  matchedProductId: string,
): Pick<ReviewLineDisplay, 'mappingKind' | 'conflictMessage'> {
  if (savedProductId) {
    if (matchedProductId === savedProductId) {
      return { mappingKind: 'saved', conflictMessage: '' };
    }
    return {
      mappingKind: 'conflict',
      conflictMessage: matchedProductId
        ? '已保存對應與目前 Shopify 商品識別出的 HQ 商品不同，請確認後再選擇。'
        : '目前 Shopify 商品無法唯一對應 HQ 商品，請確認已保存對應是否正確。',
    };
  }
  if (matchedProductId) return { mappingKind: 'auto', conflictMessage: '' };
  return { mappingKind: 'select', conflictMessage: '' };
}

export function reviewLineDisplays(
  snapshot: Snapshot,
  products: MappingProduct[],
  draft: ReviewDraft,
  saved: ReviewDraft | null,
): ReviewLineDisplay[] {
  const rows = sourceLineRows(snapshot);
  return draft.lines.map((_, index) => {
    const row = rows[index] ?? {};
    const matchedProductId = autoMatchProduct(row, products)?.id ?? '';
    return {
      title: string(row.title) || '未命名商品',
      quantityLabel: sourceQuantityLabel(row.quantity),
      ...lineMapping(string(saved?.lines[index]?.productId), matchedProductId),
    };
  });
}

export function deliveryDefaults(snapshot: Snapshot) {
  const lines = Array.isArray(snapshot.order.shipping_lines)
    ? snapshot.order.shipping_lines.map(record) : [];
  const shippingText = lines.map(line => `${string(line.code)} ${string(line.title)}`.toLowerCase()).join(' ');
  const method = containsAny(shippingText, ['7-11', '711', 'seven', '超商', '門市'])
    ? 'convenience' : containsAny(shippingText, ['black cat', 'blackcat', 't-cat', '黑貓', '宅配', 'home'])
      ? 'home' : '';
  const temperature = containsAny(shippingText, ['冷凍', 'frozen', 'freeze'])
    ? 'frozen' : containsAny(shippingText, ['冷藏', 'chilled', 'refrigerated'])
      ? 'chilled' : containsAny(shippingText, ['常溫', 'ambient', 'room temperature'])
        ? 'ambient' : '';

  const attributes = new Map<string, string>();
  if (Array.isArray(snapshot.order.note_attributes)) {
    for (const raw of snapshot.order.note_attributes) {
      const item = record(raw);
      attributes.set(string(item.name).toLowerCase(), string(item.value));
    }
  }
  const first = (keys: string[]) => keys.map(key => attributes.get(key)).find(Boolean) ?? '';
  return {
    method,
    temperature,
    storeId: first(['取貨門市店號', '門市店號', 'cvs_store_id']),
    storeName: first(['取貨門市名稱', '門市名稱', 'cvs_store_name']),
  };
}

export function defaultReviewDraft(snapshot: Snapshot, products: MappingProduct[]): ReviewDraft {
  const view = snapshotView(snapshot)!;
  const rows = sourceLineRows(snapshot);
  const lines = rows.map(row => {
    const product = autoMatchProduct(row, products);
    return { productId: product?.id ?? '', temperature: product?.defaultTemperature ?? '' };
  });
  const delivery = deliveryDefaults(snapshot);
  const productTemperatures = new Set(lines.map(line => line.temperature).filter(Boolean));
  const temperature = delivery.temperature || (productTemperatures.size === 1 ? [...productTemperatures][0]! : '');
  return reviewDraft({
    lines,
    method: delivery.method,
    temperature,
    recipient: view.recipient,
    phone: view.phone,
    address: view.address,
    storeId: delivery.storeId,
    storeName: delivery.storeName,
  });
}

/** Fill only empty fields in an unconfirmed saved draft. Nothing is persisted here. */
export function fillReviewDraftBlanks(saved: ReviewDraft, suggested: ReviewDraft) {
  let applied = false;
  const pick = (current: string, fallback: string) => {
    if (current.trim() || !fallback.trim()) return current;
    applied = true;
    return fallback;
  };
  const lines = saved.lines.map((line, index) => {
    const fallback = suggested.lines[index];
    if (!fallback) return line;
    return {
      productId: pick(line.productId, fallback.productId),
      temperature: pick(line.temperature, fallback.temperature),
    };
  });
  const draft = {
    ...saved,
    lines,
    method: pick(saved.method, suggested.method),
    temperature: pick(saved.temperature, suggested.temperature),
    recipient: pick(saved.recipient, suggested.recipient),
    phone: pick(saved.phone, suggested.phone),
    address: pick(saved.address, suggested.address),
    storeId: pick(saved.storeId, suggested.storeId),
    storeName: pick(saved.storeName, suggested.storeName),
  };
  return { applied, draft };
}
