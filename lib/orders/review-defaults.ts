import { record, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { reviewDraft, type ReviewDraft } from './review-policy';

type MappingProduct = {
  id: string;
  sku: string;
  sourceSku: string | null;
  defaultTemperature: string | null;
};

const containsAny = (value: string, words: string[]) => words.some(word => value.includes(word));

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
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  const lines = rows.map(row => {
    const sku = string(row.sku);
    const matches = sku ? products.filter(product => product.sku === sku || product.sourceSku === sku) : [];
    const product = matches.length === 1 ? matches[0] : null;
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
