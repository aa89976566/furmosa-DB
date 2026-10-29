import { LEGACY_MERCHANT_STOCK_TIER_ID } from '@/lib/merchant-stock-key';

export type StockRowPlan = {
  id: string | null;
  tierId: string;
  quantity: number;
};

export function planProductStockAdjustment(
  rows: StockRowPlan[],
  newQuantity: number,
  tierId?: string,
): { previousTotal: number; delta: number; nextRows: StockRowPlan[] } {
  if (!Number.isSafeInteger(newQuantity) || newQuantity < 0) {
    throw new Error('庫存數量不合法');
  }
  const nextQty = Math.floor(newQuantity);
  const previousTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (tierId === undefined && rows.length > 1) throw new Error('請選擇要盤點的規格');
  const targetTier = tierId ?? rows[0]?.tierId ?? LEGACY_MERCHANT_STOCK_TIER_ID;
  const existing = rows.find(row => row.tierId === targetTier);
  const delta = nextQty - (existing?.quantity ?? 0);
  if (delta === 0) {
    throw new Error('數量沒有變化');
  }

  if (!existing) {
    return {
      previousTotal,
      delta,
      nextRows: [...rows, { id: null, tierId: targetTier, quantity: nextQty }],
    };
  }

  const nextRows = rows.map((row) =>
    row.tierId === targetTier
      ? { ...row, quantity: nextQty }
      : row,
  );
  return { previousTotal, delta, nextRows };
}
