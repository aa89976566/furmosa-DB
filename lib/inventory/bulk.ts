export type BulkTier = { id?: string; weightGrams: number | null; unit: string; unitQty: number };
export function bulkUnit(unit: string | null | undefined) {
  if (['g', '克', '公克'].includes(unit ?? '')) return 'g';
  return ['隻', '片', '顆', '條'].includes(unit ?? '') ? unit! : null;
}
/** Fail closed when a legacy line has lost the selected count/weight tier. */
export function bulkConsumption(product: { unit?: string | null; priceTiers?: BulkTier[] },
  line: { quantity: number; weightGrams?: number | null; variantKey?: string | null }) {
  const unit = bulkUnit(product.unit);
  if (!unit || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error('實際單位或數量尚未確認');
  const tiers = (product.priceTiers ?? []).filter(t => line.variantKey ? t.id === line.variantKey
    : unit === 'g' ? line.weightGrams != null && t.weightGrams === line.weightGrams
      : t.weightGrams === (line.weightGrams ?? null) && t.unit === unit);
  if (tiers.length !== 1) throw new Error('缺少或無法唯一確認商品規格');
  const tier = tiers[0];
  const perItem = unit === 'g' ? tier.weightGrams : tier.unitQty;
  if (!perItem || perItem <= 0 || (unit === 'g' && tier.weightGrams !== line.weightGrams) || (unit !== 'g' && tier.unit !== unit)) throw new Error('商品規格與實際單位不一致');
  const amount = perItem * line.quantity;
  if (!Number.isSafeInteger(amount) || amount > 2147483647) throw new Error('耗用量超出範圍');
  return amount;
}
