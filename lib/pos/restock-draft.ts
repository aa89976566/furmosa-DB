import type { RestockCartLine } from './restock-cart';

const PREFIX = 'furmosa-pos-restock-cart-v2:';
const LEGACY_KEY = 'furmosa-pos-restock-cart-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function restockDraftKey(merchantId: string): string {
  if (!merchantId) throw new Error('缺少店家資料，請重新登入');
  return PREFIX + encodeURIComponent(merchantId);
}

export function readRestockDraft(storage: StorageLike, merchantId: string): RestockCartLine[] {
  try {
    // Old drafts cannot be attributed to a merchant; never migrate them.
    storage.removeItem(LEGACY_KEY);
    const rows: unknown = JSON.parse(storage.getItem(restockDraftKey(merchantId)) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is RestockCartLine =>
      row && typeof row.productId === 'string' && row.productId.length > 0 &&
      typeof row.name === 'string' && Number.isSafeInteger(row.quantity) && row.quantity > 0 &&
      (row.variantKey == null || typeof row.variantKey === 'string') &&
      (row.weightGrams == null || (Number.isSafeInteger(row.weightGrams) && row.weightGrams > 0)) &&
      (row.variantLabel == null || typeof row.variantLabel === 'string') &&
      (row.imageUrl == null || typeof row.imageUrl === 'string'));
  } catch { return []; }
}

export function writeRestockDraft(storage: StorageLike, merchantId: string, lines: RestockCartLine[]): void {
  try { storage.setItem(restockDraftKey(merchantId), JSON.stringify(lines)); } catch { /* The in-memory cart remains usable. */ }
}

export function clearRestockDrafts(storage: StorageLike): void {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      if (key && (key === LEGACY_KEY || key === 'furmosa_pos_restock_draft_v1' || key.startsWith(PREFIX))) storage.removeItem(key);
    }
  } catch { /* Signing out must still work when storage is unavailable. */ }
}
