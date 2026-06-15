import { variationLabel } from '@/lib/product-variations';
import { LEGACY_MERCHANT_STOCK_TIER_ID } from '@/lib/merchant-stock-key';

export type MerchantProductTierOption = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  notes: string | null;
};

export function hasMultipleTierOptions(tiers: MerchantProductTierOption[]) {
  return tiers.length > 1;
}

export function pickDefaultTier(tiers: MerchantProductTierOption[]) {
  return tiers[0] ?? null;
}

export function findTier(tiers: MerchantProductTierOption[], tierId: string) {
  return tiers.find((tier) => tier.id === tierId) ?? null;
}

export function tierWeightGramsValue(tier: MerchantProductTierOption | null) {
  if (!tier?.weightGrams || tier.weightGrams <= 0) return '';
  return String(tier.weightGrams);
}

/** 與銷售表單一致：有店家分潤規則時用建議售價，否則用規格售價 */
export function unitPriceForTierSale(
  tiers: MerchantProductTierOption[],
  tierId: string,
  options: {
    suggestedPrice: number | null;
    hasMerchantRule: boolean;
    fallbackPrice?: number;
  },
) {
  if (options.hasMerchantRule && options.suggestedPrice != null) {
    return options.suggestedPrice;
  }
  const tier = findTier(tiers, tierId) ?? pickDefaultTier(tiers);
  return tier?.price ?? options.fallbackPrice ?? options.suggestedPrice ?? 0;
}

export function tierSpecLabel(tier: MerchantProductTierOption | null) {
  if (!tier) return null;
  return variationLabel(tier);
}

export function parseTierIdFromForm(
  formData: FormData,
  tiers: MerchantProductTierOption[],
): string {
  const tierId = String(formData.get('tierId') ?? '').trim();
  if (hasMultipleTierOptions(tiers)) {
    if (tierId) {
      if (!findTier(tiers, tierId)) throw new Error('規格不存在');
      return tierId;
    }
    return LEGACY_MERCHANT_STOCK_TIER_ID;
  }
  return tierId || pickDefaultTier(tiers)?.id || LEGACY_MERCHANT_STOCK_TIER_ID;
}

export function noteWithSpec(spec: string | null, body: string) {
  return spec ? `${spec} · ${body}` : body;
}
