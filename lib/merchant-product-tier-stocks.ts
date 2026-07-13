import {
  isMultiWeightProduct,
  LEGACY_MERCHANT_STOCK_TIER_ID,
  weightTiersForProduct,
} from '@/lib/merchant-stock-key';
import {
  pickDefaultTier,
  tierSpecLabel,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';

export type MerchantProductTierStock = {
  tierId: string;
  label: string;
  quantity: number;
};

export function toMerchantProductTierOptions(
  tiers: {
    id: string;
    weightGrams: number | null;
    unit: string;
    unitQty: number;
    price: number;
    notes: string | null;
  }[],
): MerchantProductTierOption[] {
  return tiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    notes: tier.notes,
  }));
}

export function buildMerchantProductTierStocks(
  productId: string,
  priceTiers: MerchantProductTierOption[],
  stocks: { productId: string; tierId: string; quantity: number }[],
): { tierStocks: MerchantProductTierStock[]; totalQuantity: number; multiWeightTiers: boolean } {
  const multiWeightTiers = isMultiWeightProduct(priceTiers);
  const productStocks = stocks.filter((s) => s.productId === productId);
  const totalQuantity = productStocks.reduce((sum, s) => sum + s.quantity, 0);

  if (!multiWeightTiers) {
    const defaultTier = pickDefaultTier(priceTiers);
    return {
      multiWeightTiers: false,
      totalQuantity,
      tierStocks: [
        {
          tierId: defaultTier?.id ?? LEGACY_MERCHANT_STOCK_TIER_ID,
          label: tierSpecLabel(defaultTier) ?? '預設',
          quantity: totalQuantity,
        },
      ],
    };
  }

  return {
    multiWeightTiers: true,
    totalQuantity,
    tierStocks: weightTiersForProduct(priceTiers).map((tier) => {
      const fullTier = priceTiers.find((t) => t.id === tier.id) ?? null;
      const stock = productStocks.find((s) => s.tierId === tier.id);
      return {
        tierId: tier.id,
        label: tierSpecLabel(fullTier) ?? '規格',
        quantity: stock?.quantity ?? 0,
      };
    }),
  };
}
