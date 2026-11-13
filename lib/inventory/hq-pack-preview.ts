import { planSellablePacks, type GramPool, type SellablePack } from './sellable-packs.ts';

export type HqPackTier = {
  id: string; productId: string; weightGrams: number | null;
  shopifyVariantId: string | null; inventoryPolicy: string;
  product: { inventorySourceProductId: string | null };
  bundleComponents: { componentProductId: string; gramsPerPack: number }[];
};
export type HqGramBalance = { productId: string; quantity: number; unit: string | null };

/** Read-only diagnostic. Stock capacity is NOT publishable availability. */
export function previewHqPacks(tiers: HqPackTier[], balances: HqGramBalance[]) {
  const packs: SellablePack[] = tiers.map(tier => {
    const components = tier.bundleComponents;
    const validWeight = Number.isSafeInteger(tier.weightGrams) && (tier.weightGrams ?? 0) > 0;
    const validRecipe = !components.length || components.reduce((sum, c) => sum + c.gramsPerPack, 0) === tier.weightGrams;
    return {
      tierId: tier.id,
      // Unbound HQ tiers still participate in shared-pool detection.
      shopifyVariantId: tier.shopifyVariantId ?? '',
      requirements: tier.inventoryPolicy !== 'shared' || !validWeight || !validRecipe ? [] :
        components.length ? components.map(c => ({ productId: c.componentProductId, gramsPerPack: c.gramsPerPack })) :
          [{ productId: tier.product.inventorySourceProductId ?? tier.productId, gramsPerPack: tier.weightGrams! }],
    };
  });
  const pools: GramPool[] = balances.map(b => ({ productId: b.productId, unit: b.unit, onHand: b.quantity, reserved: 0 }));
  const capacity = planSellablePacks({ snapshotComplete: true, pools, packs });
  const availability = planSellablePacks({ snapshotComplete: false, pools, packs });
  return availability.filter(row => row.shopifyVariantId).map(row => ({
    ...row,
    stockCapacityBeforeReservations: capacity.find(c => c.tierId === row.tierId)?.available ?? null,
    issues: [...row.issues, 'RESERVATION_COVERAGE_NOT_VERIFIED'],
  }));
}
