export function inventoryQuantityLabel(quantity: number): string {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  return `目前庫存：${qty} 件`;
}

export function inventorySummaryText(input: {
  totalCount: number;
  lowCount: number;
}): string {
  if (input.totalCount <= 0) return '目前沒有可管理的商品。';
  if (input.lowCount > 0) {
    return `共 ${input.totalCount} 項商品，其中 ${input.lowCount} 項庫存不足。`;
  }
  return `共 ${input.totalCount} 項商品。`;
}

export function inventoryHasActiveFilters(input: {
  query: string;
  group: string;
  lowStockOnly: boolean;
}): boolean {
  return input.query.trim() !== '' || input.group !== 'all' || input.lowStockOnly;
}

export function inventoryListState(input: {
  totalCount: number;
  visibleCount: number;
  query: string;
  group: string;
  lowStockOnly: boolean;
}): 'empty-store' | 'no-results' | 'ready' {
  if (input.totalCount <= 0) return 'empty-store';
  if (input.visibleCount <= 0) return 'no-results';
  return 'ready';
}

export function inventorySubmitBlockedReason(itemCount: number): string | null {
  if (itemCount <= 0) return '先從商品加入補貨單，才能送出補貨申請。';
  return null;
}

/** 商品卡快速加入：已在補貨單內就不要因連點再加數量。 */
export function shouldQuickAddToRestockCart(existingQty: number | undefined): boolean {
  return !(typeof existingQty === 'number' && existingQty > 0);
}

/** 送出補貨申請時只帶既有欄位，不新增 client 端金額或庫存。 */
export function inventoryRestockSubmitItems(
  lines: Array<{ productId: string; quantity: number }>,
): Array<{ productId: string; quantity: number }> {
  return lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
}
