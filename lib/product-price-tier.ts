export type TierLike = {
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  cost: number | null;
};

/** 規格成本：排除誤把重量 (g) 存成成本的情況 */
export function resolveTierCost(
  cost: number | null | undefined,
  weightGrams: number | null | undefined,
): number | null {
  if (cost == null || !Number.isFinite(cost)) return null;
  if (weightGrams != null && weightGrams > 0 && cost === weightGrams) return null;
  return cost;
}

/** 此規格是否為「依重量 (g)」的變體 */
export function isWeightTier(tier: Pick<TierLike, 'weightGrams'>): boolean {
  return tier.weightGrams != null && tier.weightGrams > 0;
}

export function tierPricePerGram(tier: Pick<TierLike, 'price' | 'weightGrams'>): number | null {
  if (!isWeightTier(tier)) return null;
  return tier.price / tier.weightGrams!;
}

/** 毛利：僅用該規格自己的售價 − 成本（不從主檔推算） */
export function computeTierMargin(tier: TierLike): number | null {
  const cost = resolveTierCost(tier.cost, tier.weightGrams);
  if (cost == null) return null;
  return tier.price - cost;
}

export function tierCostDisplay(tier: TierLike): number | null {
  return resolveTierCost(tier.cost, tier.weightGrams);
}

/** 同步主檔：從最便宜的重量規格帶入列表參考價；若有填成本則換算每克成本 */
export function costPerUnitFromTierTotal(
  totalCost: number,
  weightGrams: number,
): number {
  return totalCost / weightGrams;
}

export function isGramUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return u === 'g' || u === '克';
}
