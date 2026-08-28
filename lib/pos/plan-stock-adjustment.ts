import { LEGACY_MERCHANT_STOCK_TIER_ID } from '@/lib/merchant-stock-key';

export type StockRowPlan = {
  id: string | null;
  tierId: string;
  quantity: number;
};

export function planProductStockAdjustment(
  rows: StockRowPlan[],
  newQuantity: number,
): { previousTotal: number; delta: number; nextRows: StockRowPlan[] } {
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    throw new Error('庫存數量不合法');
  }
  const nextQty = Math.floor(newQuantity);
  const previousTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
  const delta = nextQty - previousTotal;
  if (delta === 0) {
    throw new Error('數量沒有變化');
  }

  if (rows.length === 0) {
    return {
      previousTotal,
      delta,
      nextRows: [{ id: null, tierId: LEGACY_MERCHANT_STOCK_TIER_ID, quantity: nextQty }],
    };
  }

  const primary = [...rows].sort((a, b) => b.quantity - a.quantity || a.tierId.localeCompare(b.tierId))[0]!;
  const nextRows = rows.map((row) =>
    row.id === primary.id && row.tierId === primary.tierId
      ? { ...row, quantity: nextQty }
      : { ...row, quantity: 0 },
  );
  return { previousTotal, delta, nextRows };
}
