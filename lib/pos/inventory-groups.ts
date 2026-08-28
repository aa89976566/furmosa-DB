export const INVENTORY_LOW_STOCK_THRESHOLD = 3;

export type InventoryGroupId = 'freeze_dried' | 'baked' | 'chicken' | 'fish' | 'other';

export const INVENTORY_GROUPS: { id: InventoryGroupId | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'freeze_dried', label: '凍乾' },
  { id: 'baked', label: '烘烤' },
  { id: 'chicken', label: '雞肉' },
  { id: 'fish', label: '魚類' },
  { id: 'other', label: '其他' },
];

export type InventoryTone = 'sold_out' | 'low' | 'ok';

export type InventoryStockStatus = {
  tone: InventoryTone;
  label: '已售完' | '庫存偏低' | '庫存正常';
};

export function inventoryStockStatus(
  quantity: number,
  lowStockThreshold = INVENTORY_LOW_STOCK_THRESHOLD,
): InventoryStockStatus {
  if (quantity <= 0) return { tone: 'sold_out', label: '已售完' };
  if (quantity <= lowStockThreshold) return { tone: 'low', label: '庫存偏低' };
  return { tone: 'ok', label: '庫存正常' };
}

export function isLowOrSoldOutStock(
  quantity: number,
  lowStockThreshold = INVENTORY_LOW_STOCK_THRESHOLD,
): boolean {
  return quantity <= lowStockThreshold;
}

/** 一商品只落在一個分頁，凍乾優先於口味。 */
export function inventoryGroupForProduct(input: {
  name: string;
  category?: string | null;
  style?: string | null;
}): InventoryGroupId {
  const name = input.name;
  const category = (input.category ?? '').toLowerCase();
  const style = input.style ?? '';
  const blob = `${name} ${style}`;

  if (category === 'freeze_dried' || blob.includes('凍乾')) return 'freeze_dried';
  if (blob.includes('烘烤') || blob.includes('烘焙') || blob.includes('烤')) return 'baked';
  if (blob.includes('雞')) return 'chicken';
  if (blob.includes('魚') || blob.includes('鮭') || blob.includes('柳葉')) return 'fish';
  return 'other';
}

export type InventorySearchItem = {
  name: string;
  sku?: string | null;
  sourceSku?: string | null;
  group: InventoryGroupId;
  quantity: number;
};

export function filterInventoryItems<T extends InventorySearchItem>(
  items: T[],
  input: {
    query: string;
    group: InventoryGroupId | 'all';
    lowStockOnly: boolean;
    lowStockThreshold?: number;
  },
): T[] {
  const q = input.query.trim().toLowerCase();
  const threshold = input.lowStockThreshold ?? INVENTORY_LOW_STOCK_THRESHOLD;
  return items.filter((item) => {
    if (input.group !== 'all' && item.group !== input.group) return false;
    if (input.lowStockOnly && !isLowOrSoldOutStock(item.quantity, threshold)) return false;
    if (!q) return true;
    const haystack = `${item.name} ${item.sku ?? ''} ${item.sourceSku ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
