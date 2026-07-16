/** 舊版未分規格的庫存列（合計） */
export const LEGACY_MERCHANT_STOCK_TIER_ID = '';

export function merchantStockUniqueWhere(
  merchantId: string,
  productId: string,
  tierId = LEGACY_MERCHANT_STOCK_TIER_ID,
) {
  return {
    merchantId_productId_tierId: { merchantId, productId, tierId },
  };
}

/** 前端／目錄用：productId + tierId 對應庫存數量 */
export function merchantStockTierMapKey(productId: string, tierId: string) {
  return `${productId}::${tierId}`;
}

type TierLike = { id: string; weightGrams: number | null; unit: string; unitQty: number };

export function weightTiersForProduct(tiers: TierLike[]) {
  return tiers.filter((tier) => tier.weightGrams != null && tier.weightGrams > 0);
}

export function isMultiWeightProduct(tiers: TierLike[]) {
  return weightTiersForProduct(tiers).length > 1;
}

export function resolveTierIdFromWeightGrams(
  tiers: TierLike[],
  weightGrams: number | null | undefined,
) {
  if (weightGrams && weightGrams > 0) {
    const match = tiers.find((tier) => tier.weightGrams === weightGrams);
    if (match) return match.id;
  }
  // 有克數規格時，不要落到未分規格（空 tierId），否則清點／列表看不到克數
  const weightTiers = weightTiersForProduct(tiers);
  if (weightTiers.length === 1) return weightTiers[0]!.id;
  // 多克數但沒帶 weightGrams：仍取第一個有克數規格，避免寫入 legacy
  // （進貨表單應強制選克數；這裡是防線）
  if (weightTiers.length > 1) return weightTiers[0]!.id;
  // 無克數商品（例如「片」）
  if (tiers[0]) return tiers[0].id;
  return LEGACY_MERCHANT_STOCK_TIER_ID;
}
