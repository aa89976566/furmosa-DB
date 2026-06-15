export type QuickSaleProduct = {
  currentStock: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
};

export function calcQuickSalePreview(
  product: QuickSaleProduct,
  quantity: number,
  unitPriceOverride?: number | null,
) {
  if (quantity <= 0) return null;
  const unitPrice = unitPriceOverride ?? product.suggestedPrice ?? 0;
  const perUnit =
    product.commissionMode === 'percent'
      ? (unitPrice * (product.commissionValue ?? 0)) / 100
      : product.commissionMode === 'amount'
        ? (product.commissionValue ?? 0)
        : 0;
  const gross = unitPrice * quantity;
  const commission = perUnit * quantity;
  return {
    gross,
    commission,
    revenue: gross - commission,
    afterStock: product.currentStock - quantity,
  };
}
