/** 魚類凍乾：品名同時含「魚」與「凍乾」 */
export function isFishFreezeDriedName(name: string): boolean {
  return name.includes('魚') && name.includes('凍乾');
}

/** 參考柳葉魚：30g $174 → 1 條 $58（成本 $75 → $10） */
const STRIP_PRICE_RATIO = 58 / 174;
const STRIP_COST_RATIO = 10 / 75;

export type StripTierDraft = {
  unitQty: 1;
  unit: '條';
  price: number;
  cost: number;
  notes: '單條';
};

export function deriveFishStripTierFromWeightPrice(
  weightTierPrice: number,
  weightTierCost?: number | null,
): StripTierDraft {
  const price = Math.max(1, Math.round(weightTierPrice * STRIP_PRICE_RATIO));
  const cost =
    weightTierCost != null && weightTierCost > 0
      ? Math.max(1, Math.round(weightTierCost * STRIP_COST_RATIO))
      : Math.max(1, Math.round(price * (10 / 58)));
  return { unitQty: 1, unit: '條', price, cost, notes: '單條' };
}

export function appendFishStripTierIfMissing<
  T extends { weightGrams?: number; unitQty?: number; unit?: string; price: number; cost?: number; notes?: string },
>(name: string, prices: T[]): T[] {
  if (!isFishFreezeDriedName(name)) return prices;
  const hasStrip = prices.some(
    (p) => p.weightGrams == null && p.unit === '條' && (p.unitQty ?? 1) === 1,
  );
  if (hasStrip) return prices;

  const weightTier = prices
    .filter((p) => p.weightGrams != null && p.weightGrams > 0)
    .sort((a, b) => (a.weightGrams ?? 0) - (b.weightGrams ?? 0))[0];
  if (!weightTier) return prices;

  const strip = deriveFishStripTierFromWeightPrice(weightTier.price, weightTier.cost);
  return [...prices, strip as T];
}
