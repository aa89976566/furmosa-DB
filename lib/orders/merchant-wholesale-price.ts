export const BASE_VARIANT_KEY = 'base';

export type MerchantWholesalePriceRow = {
  merchantId: string;
  productId: string;
  variantKey: string;
  unitPrice: number;
};

export function wholesaleVariantKey(tierId: string | null | undefined): string {
  const normalized = tierId?.trim();
  return normalized || BASE_VARIANT_KEY;
}

export function normalizeWholesaleUnitPrice(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function findMerchantWholesalePrice(
  prices: MerchantWholesalePriceRow[],
  merchantId: string,
  productId: string,
  tierId: string | null | undefined,
): number | null {
  const variantKey = wholesaleVariantKey(tierId);
  const row = prices.find(
    (price) =>
      price.merchantId === merchantId &&
      price.productId === productId &&
      price.variantKey === variantKey,
  );
  return row ? normalizeWholesaleUnitPrice(row.unitPrice) : null;
}
