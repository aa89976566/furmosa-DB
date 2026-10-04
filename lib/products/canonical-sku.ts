export type CanonicalSkuTier = {
  weightGrams?: number | null;
  unit?: string | null;
  unitQty?: number | null;
};

export function normalizeCanonicalSku(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

/**
 * sourceSku is the stable product-family code.
 * One active sellable tier keeps the family code itself.
 * Multi-tier products add the physical variant dimension.
 */
export function canonicalTierSku(
  sourceSku: string | null | undefined,
  tier: CanonicalSkuTier,
  activeTierCount: number,
): string | null {
  const family = normalizeCanonicalSku(sourceSku);
  if (!family) return null;
  if (activeTierCount <= 1) return family;

  if (tier.weightGrams != null && Number.isInteger(tier.weightGrams) && tier.weightGrams > 0) {
    return `${family}-${tier.weightGrams}G`;
  }

  const qty = tier.unitQty ?? 1;
  if (Number.isInteger(qty) && qty > 0) {
    return `${family}-${qty}PC`;
  }
  return null;
}
