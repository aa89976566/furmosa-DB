export type StockTone = 'sold_out' | 'low' | 'ok';

export type StockStatus = {
  tone: StockTone;
  label: '已售完' | '快沒了' | '庫存正常';
};

/** 店員看得到的庫存狀態，不用英文等級名稱。 */
export function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return { tone: 'sold_out', label: '已售完' };
  if (quantity <= 3) return { tone: 'low', label: '快沒了' };
  return { tone: 'ok', label: '庫存正常' };
}

export function isLowOrSoldOut(quantity: number): boolean {
  return quantity <= 3;
}

/** 現在 0 → 建議補 6；現在 2 → 建議補 4。已超過目標則建議 0。 */
export function suggestedRestockQty(current: number, fillTo = 6): number {
  const qty = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  return Math.max(0, fillTo - qty);
}

export function lowStockSubtitle(items: { productName: string; quantity: number }[]): {
  title: string;
  subtitle: string;
  count: number;
} {
  const count = items.length;
  const first = items[0];
  if (!first) {
    return { title: '庫存不足', subtitle: '', count: 0 };
  }
  const firstStatus = stockStatus(first.quantity).label;
  const more = count - 1;
  const subtitle =
    more > 0
      ? `${first.productName} ${firstStatus}\n另外 ${more} 項快沒了`
      : `${first.productName} ${firstStatus}`;
  return { title: '庫存不足', subtitle, count };
}
