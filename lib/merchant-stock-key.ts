import { resolveRestockVariant } from '@/lib/restock-request/variant';
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

export function resolveTierIdFromWeightGrams(tiers: TierLike[], weightGrams: number | null | undefined, variantKey?: string | null) {
  return resolveRestockVariant(tiers, { weightGrams, variantKey }).variantKey ?? LEGACY_MERCHANT_STOCK_TIER_ID;
}
