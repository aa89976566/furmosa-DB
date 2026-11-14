/** Pure planning only: no stock mutation or Shopify calls. Quantities are grams. */
export type GramPool = { productId: string; unit: string | null; onHand: number; reserved: number };
export type PackRequirement = { productId: string; gramsPerPack: number };
export type SellablePack = { tierId: string; shopifyVariantId: string; requirements: PackRequirement[] };
export type PackAvailability = {
  tierId: string;
  shopifyVariantId: string;
  available: number | null;
  issues: string[];
};

/**
 * reserved is outstanding, unposted consumption across ALL channels. Once an
 * order ships, onHand and reserved must both drop in the same source snapshot.
 * The caller must load one consistent warehouse snapshot; missing data blocks
 * publication rather than treating unknown reservations as zero.
 *
 * Two Shopify variants must never each publish the full capacity of one pool.
 * Shared pools need an explicit allocation policy before they can be published.
 */
export function planSellablePacks(input: {
  snapshotComplete: boolean;
  pools: GramPool[];
  packs: SellablePack[];
}): PackAvailability[] {
  const pools = new Map<string, GramPool>();
  const invalidPools = new Set<string>();
  for (const pool of input.pools) {
    if (pools.has(pool.productId)) invalidPools.add(pool.productId);
    pools.set(pool.productId, pool);
    if (!['g', '克', '公克'].includes(pool.unit ?? '') ||
      !Number.isSafeInteger(pool.onHand) || !Number.isSafeInteger(pool.reserved) || pool.reserved < 0) {
      invalidPools.add(pool.productId);
    }
  }
  const consumers = new Map<string, Set<number>>();
  const variants = new Map<string, number>();
  const tiers = new Map<string, number>();
  input.packs.forEach((pack, index) => {
    variants.set(pack.shopifyVariantId, (variants.get(pack.shopifyVariantId) ?? 0) + 1);
    tiers.set(pack.tierId, (tiers.get(pack.tierId) ?? 0) + 1);
    for (const requirement of pack.requirements) {
      const hits = consumers.get(requirement.productId) ?? new Set<number>();
      hits.add(index);
      consumers.set(requirement.productId, hits);
    }
  });
  return input.packs.map(pack => {
    const issues = new Set<string>();
    if (!input.snapshotComplete) issues.add('INCOMPLETE_SNAPSHOT');
    if (!pack.tierId || tiers.get(pack.tierId)! > 1 ||
      !/^[1-9]\d*$/.test(pack.shopifyVariantId) || variants.get(pack.shopifyVariantId)! > 1) {
      issues.add('AMBIGUOUS_BINDING');
    }
    if (!pack.requirements.length) issues.add('MISSING_RECIPE');
    const seen = new Set<string>();
    const capacities: number[] = [];
    for (const requirement of pack.requirements) {
      if (!requirement.productId || seen.has(requirement.productId) ||
        !Number.isSafeInteger(requirement.gramsPerPack) || requirement.gramsPerPack <= 0) {
        issues.add('INVALID_RECIPE');
        continue;
      }
      seen.add(requirement.productId);
      if ((consumers.get(requirement.productId)?.size ?? 0) > 1) issues.add('SHARED_POOL_REQUIRES_ALLOCATION');
      const pool = pools.get(requirement.productId);
      if (!pool || invalidPools.has(requirement.productId)) {
        issues.add('UNVERIFIED_GRAM_POOL');
        continue;
      }
      const free = Math.max(0, pool.onHand - pool.reserved);
      if (!Number.isSafeInteger(free)) { issues.add('INVALID_QUANTITY'); continue; }
      capacities.push(Math.floor(free / requirement.gramsPerPack));
    }
    return { tierId: pack.tierId, shopifyVariantId: pack.shopifyVariantId,
      available: issues.size ? null : Math.min(...capacities), issues: [...issues] };
  });
}
